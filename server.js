const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Determine static file directory: use 'public' subfolder if it exists, otherwise root
const publicDir = fs.existsSync(path.join(__dirname, 'public')) 
  ? path.join(__dirname, 'public') 
  : __dirname;

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});
app.use(express.static(publicDir));

// Broadcast message helper
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// REST API Endpoints

// Get schedule for month
app.get('/api/schedule', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "Month key is required" });
  try {
    const data = await db.getSchedule(month);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update schedule cell
app.post('/api/schedule/update', async (req, res) => {
  const { monthKey, category, name, day, status, border } = req.body;
  if (!monthKey || !category || !name || !day) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const updateResult = await db.updateCell(monthKey, category, name, day, status, border);
    if (!updateResult) {
      return res.status(404).json({ error: "Doctor not found or invalid category" });
    }

    // Generate Hebrew descriptions of values for logs
    const statusLabels = {
      ward: 'מחלקה', clinic: 'מרפאה', off: 'חופש', daytreat: 'ט.יום', radio: 'רדיותרפיה',
      basic: 'מדעי יסוד', scopuscl: 'מרפאה הר הצופים', elective: 'אלקטיב', postcall: 'אחרי תורנות',
      augusta: 'אוגוסטה', scopusday: 'אשפוז יום הר הצופים', shabbat: 'שישי/שבת', internal: 'פנימית',
      postcallfri: 'אחרי תורנות שישי', research: 'מחקר', reserve: 'מילואים', weoff: 'סוף שבוע'
    };
    const borderLabels = {
      none: 'ללא', oncall: 'תורן 🔴', halfoncall: 'תורן חצי 🟡',
      er_standby: 'כונן מיון ⬛', ward_standby: 'כונן מחלקה ⬜'
    };

    let changeParts = [];
    if (status !== undefined && updateResult.previous.s !== updateResult.current.s) {
      const prevL = statusLabels[updateResult.previous.s] || updateResult.previous.s;
      const currL = statusLabels[updateResult.current.s] || updateResult.current.s;
      changeParts.push(`מיקום מ-"${prevL}" ל-"${currL}"`);
    }
    if (border !== undefined && updateResult.previous.b !== updateResult.current.b) {
      const prevB = borderLabels[updateResult.previous.b] || updateResult.previous.b;
      const currB = borderLabels[updateResult.current.b] || updateResult.current.b;
      changeParts.push(`תפקיד מ-"${prevB}" ל-"${currB}"`);
    }

    let notif = null;
    if (changeParts.length > 0) {
      const changeText = changeParts.join(', ');
      notif = await db.addNotification(name, monthKey, day, changeText);
    }

    // Broadcast cell update to other clients
    broadcast({
      type: 'cell_update',
      data: {
        monthKey,
        category,
        name,
        day,
        s: updateResult.current.s,
        b: updateResult.current.b,
        notification: notif
      }
    });

    res.json({ success: true, cell: updateResult.current, notification: notif });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add doctor
app.post('/api/staff/add', async (req, res) => {
  const { monthKey, category, name } = req.body;
  if (!monthKey || !category || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const success = await db.addDoctor(monthKey, category, name);
    if (!success) {
      return res.status(400).json({ error: "Doctor already exists or invalid category" });
    }

    broadcast({ type: 'roster_update', data: { monthKey } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove doctor
app.post('/api/staff/remove', async (req, res) => {
  const { monthKey, name } = req.body;
  if (!monthKey || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const success = await db.removeDoctor(monthKey, name);
    if (!success) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    broadcast({ type: 'roster_update', data: { monthKey } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get notifications
app.get('/api/notifications', async (req, res) => {
  const { doctor } = req.query;
  try {
    const list = await db.getNotifications(doctor);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ REQUEST SYSTEM ENDPOINTS ═══

// Submit a request (from doctor)
app.post('/api/requests', async (req, res) => {
  const { doctor, type, details, targetDay, targetMonth, attachment } = req.body;
  if (!doctor || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const request = await db.addRequest(doctor, type, details, targetDay, targetMonth, attachment);
    broadcast({ type: 'new_request', data: request });
    res.json({ success: true, request });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all requests
app.get('/api/requests', async (req, res) => {
  try {
    const list = await db.getRequests();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update request status (admin approve/reject)
app.post('/api/requests/update', async (req, res) => {
  const { requestId, status } = req.body;
  if (!requestId || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const dbData = await db.getRequests();
    const request = dbData.find(r => r.id === requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const updated = await db.updateRequestStatus(requestId, status);
    
    // Auto-apply scheduling changes upon approval
    if (status === 'approved' && request.targetDay && request.targetMonth) {
      const { doctor, type, targetDay, targetMonth } = request;
      
      // Determine category (seniors or resident)
      const schedule = await db.getSchedule(targetMonth);
      let category = 'seniors';
      if (schedule.resident.some(r => r.name === doctor)) {
        category = 'resident';
      }
      
      let cellStatus = undefined;
      if (type === 'חופש') cellStatus = 'off';
      else if (type === 'מילואים') cellStatus = 'reserve';

      if (cellStatus) {
        const cellUpdate = await db.updateCell(targetMonth, category, doctor, targetDay, cellStatus, undefined);
        if (cellUpdate) {
          // Broadcast the cell update to all connected UIs in real-time
          broadcast({
            type: 'cell_update',
            data: {
              monthKey: targetMonth,
              category,
              name: doctor,
              day: targetDay,
              s: cellUpdate.current.s,
              b: cellUpdate.current.b,
              notification: null
            }
          });
        }
      }
    }

    broadcast({ type: 'request_update', data: { requestId, status } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ BATCH UPDATE ENDPOINT ═══
app.post('/api/schedule/batch-update', async (req, res) => {
  const { monthKey, updates } = req.body;
  if (!monthKey || !Array.isArray(updates)) {
    return res.status(400).json({ error: "Missing required fields or invalid updates format" });
  }
  try {
    const results = await db.batchUpdateCells(monthKey, updates);
    if (!results) {
      return res.status(404).json({ error: "Roster not found or invalid month" });
    }
    
    const doctorEmailGroups = {};
    
    results.forEach(resItem => {
      broadcast({
        type: 'cell_update',
        data: {
          monthKey,
          category: resItem.category,
          name: resItem.name,
          day: resItem.day,
          s: resItem.s,
          b: resItem.b,
          notification: resItem.notification
        }
      });
      
      if (resItem.notification) {
        if (!doctorEmailGroups[resItem.name]) {
          doctorEmailGroups[resItem.name] = [];
        }
        doctorEmailGroups[resItem.name].push(`יום ${resItem.day}: ${resItem.notification.changeText}`);
      }
    });
    
    const monthLabelHeb = monthLabel(monthKey);
    Object.entries(doctorEmailGroups).forEach(([docName, changeList]) => {
      const subject = `עדכון בסידור העבודה שלך - ${monthLabelHeb}`;
      const htmlBody = `
        <div style="direction: rtl; text-align: right; font-family: sans-serif; line-height: 1.6;">
          <h2>שלום ${docName},</h2>
          <p>מנהל המערכת עדכן את סידור העבודה שלך עבור חודש <strong>${monthLabelHeb}</strong>.</p>
          <p>להלן הפירוט של השינויים שבוצעו:</p>
          <ul>
            ${changeList.map(change => `<li>${change}</li>`).join('')}
          </ul>
          <p>באפשרותך לצפות בלוח השנה המעודכן באפליקציה.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 0.85em; color: #666;">מחלקת אונקולוגיה - הדסה</p>
        </div>
      `;
      sendEmailNotification(docName, subject, htmlBody);
    });
    
    res.json({ success: true, count: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ DIRECT CALENDAR SUBSCRIPTION FEED ═══
app.get('/api/calendar/feed', async (req, res) => {
  const { doctor } = req.query;
  if (!doctor) return res.status(400).send("Doctor name is required");
  
  try {
    const dbData = await db.loadDatabase();
    const schedules = dbData.schedules || {};
    
    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hadassah Oncology//Roster Live Subscription//HE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:סידור עבודה אונקולוגיה - ' + doctor,
      'X-WR-TIMEZONE:Asia/Jerusalem'
    ];
    
    Object.entries(schedules).forEach(([monthKey, monthData]) => {
      const [mStr, yStr] = monthKey.split('-');
      const monthNum = parseInt(mStr) + 1; // 1-12
      const yearNum = parseInt(yStr);
      
      let person = null;
      for (const cat of ['seniors', 'resident']) {
        person = (monthData[cat] || []).find(p => p.name === doctor);
        if (person) break;
      }
      
      if (!person) return;
      
      const totalDays = new Date(yearNum, monthNum, 0).getDate();
      
      const ST = {
        ward: 'מחלקה', clinic: 'מרפאה', off: 'חופש', daytreat: 'ט.יום', radio: 'רדיותרפיה',
        basic: 'מדעי יסוד', scopuscl: 'מרפאה הר הצופים', elective: 'אלקטיב', postcall: 'אחרי תורנות',
        augusta: 'אוגוסטה', scopusday: 'אשפוז יום הר הצופים', shabbat: 'שישי/שבת', internal: 'פנימית',
        postcallfri: 'אחרי תורנות שישי', research: 'מחקר', reserve: 'מילואים', weoff: 'סוף שבוע'
      };
      const BD = {
        oncall: 'תורן 🔴', halfoncall: 'תורן חצי 🟡',
        er_standby: 'כונן מיון ⬛', ward_standby: 'כונן מחלקה ⬜'
      };
      
      for (let d = 1; d <= totalDays; d++) {
        const cellVal = person.schedule[d];
        if (!cellVal) continue;
        
        const isWork = cellVal.s !== 'off' && cellVal.s !== 'weoff';
        const isDuty = cellVal.b !== 'none';
        
        if (isWork || isDuty) {
          const yyyy = String(yearNum);
          const mm = String(monthNum).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          const dateStart = `${yyyy}${mm}${dd}`;
          
          const nextDate = new Date(yearNum, monthNum - 1, d + 1);
          const nyyyy = String(nextDate.getFullYear());
          const nmm = String(nextDate.getMonth() + 1).padStart(2, '0');
          const ndd = String(nextDate.getDate()).padStart(2, '0');
          const dateEnd = `${nyyyy}${nmm}${ndd}`;
          
          const locLabel = ST[cellVal.s] || cellVal.s;
          const dutyLabel = BD[cellVal.b] || '';
          
          let summaryParts = [];
          if (isWork) summaryParts.push(`מיקום: ${locLabel}`);
          if (isDuty) summaryParts.push(dutyLabel);
          
          const summary = `תורנות אונקולוגיה - ${summaryParts.join(' | ')}`;
          const uid = `onco-sched-sub-${monthKey}-${d}-${encodeURIComponent(doctor)}@hadassah.org`;
          
          icsLines.push('BEGIN:VEVENT');
          icsLines.push(`UID:${uid}`);
          icsLines.push(`DTSTART;VALUE=DATE:${dateStart}`);
          icsLines.push(`DTEND;VALUE=DATE:${dateEnd}`);
          icsLines.push(`SUMMARY:${summary}`);
          icsLines.push(`DESCRIPTION:שיבוץ מסונכרן ליומן מחלקת אונקולוגיה עבור ${doctor}\\nמיקום: ${locLabel}\\nתפקיד: ${dutyLabel || 'ללא'}`);
          icsLines.push('END:VEVENT');
        }
      }
    });
    
    icsLines.push('END:VCALENDAR');
    const icsString = icsLines.join('\r\n');
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
    res.send(icsString);
  } catch (e) {
    res.status(500).send("Error generating calendar feed: " + e.message);
  }
});

// ═══ ADMIN SECURITY & SETTINGS ENDPOINTS ═══
app.post('/api/admin/auth', async (req, res) => {
  const { password } = req.body;
  try {
    const settings = await db.getAdminSettings();
    if (settings.adminPassword === password) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "סיסמה שגויה" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/settings', async (req, res) => {
  try {
    const settings = await db.getAdminSettings();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  const { adminPassword, thresholds } = req.body;
  try {
    const updated = await db.updateAdminSettings({ adminPassword, thresholds });
    res.json({ success: true, settings: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ BIRTHDAY ENDPOINTS ═══
app.get('/api/birthdays', async (req, res) => {
  try {
    const list = await db.getBirthdays();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/birthdays', async (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: "Missing fields" });
  try {
    await db.setBirthday(name, date);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ EMAIL SETTINGS ═══
app.post('/api/settings/email', async (req, res) => {
  const { doctor, email } = req.body;
  if (!doctor) return res.status(400).json({ error: "Missing fields" });
  try {
    await db.setEmail(doctor, email || '');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/settings/email', async (req, res) => {
  const { doctor } = req.query;
  try {
    const email = await db.getEmail(doctor);
    res.json({ email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reset database
app.post('/api/reset', async (req, res) => {
  try {
    await db.resetDatabase();
    broadcast({ type: 'reset' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Handle WebSocket connection
wss.on('connection', ws => {
  ws.on('message', message => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch(e) {}
  });

  ws.on('close', () => {});
});

// Helper variables & function for emailing and Hebrew strings
const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function monthLabel(mk) {
  const [m, y] = mk.split('-').map(Number);
  return HEB_MONTHS[m] + ' ' + y;
}

const https = require('https');
async function sendEmailNotification(doctorName, subject, htmlBody) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Email sending skipped: RESEND_API_KEY is not configured.");
    return;
  }
  
  try {
    const doctorEmail = await db.getEmail(doctorName);
    if (!doctorEmail) {
      console.log(`Skipping email: No email registered for doctor ${doctorName}`);
      return;
    }
    
    const data = JSON.stringify({
      from: 'Oncology Schedule <onboarding@resend.dev>',
      to: doctorEmail,
      subject: subject,
      html: htmlBody
    });
    
    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, res => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        console.log(`Resend response for ${doctorName}:`, res.statusCode, responseBody);
      });
    });
    
    req.on('error', error => {
      console.error(`Resend request error for ${doctorName}:`, error);
    });
    
    req.write(data);
    req.end();
  } catch (e) {
    console.error(`Error sending email to ${doctorName}:`, e);
  }
}

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
