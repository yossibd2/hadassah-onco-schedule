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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(__dirname));

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
    const statusLabels = {
      ward: '\u05de\u05d7\u05dc\u05e7\u05d4', clinic: '\u05de\u05e8\u05e4\u05d0\u05d4', off: '\u05d7\u05d5\u05e4\u05e9', daytreat: '\u05d8.\u05d9\u05d5\u05dd', radio: '\u05e8\u05d3\u05d9\u05d5\u05ea\u05e8\u05e4\u05d9\u05d4',
      basic: '\u05de\u05d3\u05e2\u05d9 \u05d9\u05e1\u05d5\u05d3', scopuscl: '\u05de\u05e8\u05e4\u05d0\u05d4 \u05d4\u05e8 \u05d4\u05e6\u05d5\u05e4\u05d9\u05dd', elective: '\u05d0\u05dc\u05e7\u05d8\u05d9\u05d1', postcall: '\u05d0\u05d7\u05e8\u05d9 \u05ea\u05d5\u05e8\u05e0\u05d5\u05ea',
      augusta: '\u05d0\u05d5\u05d2\u05d5\u05e1\u05d8\u05d4', scopusday: '\u05d0\u05e9\u05e4\u05d5\u05d6 \u05d9\u05d5\u05dd \u05d4\u05e8 \u05d4\u05e6\u05d5\u05e4\u05d9\u05dd', shabbat: '\u05e9\u05d9\u05e9\u05d9/\u05e9\u05d1\u05ea', internal: '\u05e4\u05e0\u05d9\u05de\u05d9\u05ea',
      postcallfri: '\u05d0\u05d7\u05e8\u05d9 \u05ea\u05d5\u05e8\u05e0\u05d5\u05ea \u05e9\u05d9\u05e9\u05d9', research: '\u05de\u05d7\u05e7\u05e8', reserve: '\u05de\u05d9\u05dc\u05d5\u05d0\u05d9\u05dd', weoff: '\u05e1\u05d5\u05e3 \u05e9\u05d1\u05d5\u05e2'
    };
    const borderLabels = {
      none: '\u05dc\u05dc\u05d0', oncall: '\u05ea\u05d5\u05e8\u05df \ud83d\udd34', halfoncall: '\u05ea\u05d5\u05e8\u05df \u05d7\u05e6\u05d9 \ud83d\udfe1',
      er_standby: '\u05db\u05d5\u05e0\u05df \u05de\u05d9\u05d5\u05df \u2b1b', ward_standby: '\u05db\u05d5\u05e0\u05df \u05de\u05d7\u05dc\u05e7\u05d4 \u2b1c'
    };
    let changeParts = [];
    if (status !== undefined && updateResult.previous.s !== updateResult.current.s) {
      const prevL = statusLabels[updateResult.previous.s] || updateResult.previous.s;
      const currL = statusLabels[updateResult.current.s] || updateResult.current.s;
      changeParts.push(`\u05de\u05d9\u05e7\u05d5\u05dd \u05de-"${prevL}" \u05dc-"${currL}"`);
    }
    if (border !== undefined && updateResult.previous.b !== updateResult.current.b) {
      const prevB = borderLabels[updateResult.previous.b] || updateResult.previous.b;
      const currB = borderLabels[updateResult.current.b] || updateResult.current.b;
      changeParts.push(`\u05ea\u05e4\u05e7\u05d9\u05d3 \u05de-"${prevB}" \u05dc-"${currB}"`);
    }
    let notif = null;
    if (changeParts.length > 0) {
      const changeText = changeParts.join(', ');
      notif = await db.addNotification(name, monthKey, day, changeText);
    }
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
  ws.on('message', message => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch(e) {}
  });
  ws.on('close', () => {
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running in collaborative mode on http://localhost:${PORT}`);
});
