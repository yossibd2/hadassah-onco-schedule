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

app.use(express.json());

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
  const { doctor, type, details, targetDay, targetMonth } = req.body;
  if (!doctor || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const request = await db.addRequest(doctor, type, details, targetDay, targetMonth);
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
    const updated = await db.updateRequestStatus(requestId, status);
    if (!updated) return res.status(404).json({ error: "Request not found" });
    broadcast({ type: 'request_update', data: { requestId, status } });
    res.json({ success: true });
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

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
