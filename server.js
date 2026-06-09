const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

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
  // console.log("WebSocket client connected");
  
  ws.on('message', message => {
    // We can handle incoming client websocket queries if needed in the future
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch(e) {}
  });

  ws.on('close', () => {
    // console.log("WebSocket client disconnected");
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running in collaborative mode on http://localhost:${PORT}`);
});
