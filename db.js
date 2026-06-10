const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_FILE = path.join(__dirname, 'database.json');
const JUNE_SEED_FILE = path.join(__dirname, 'june_schedule.json');

// Hebrew months calendar helpers
const DOW = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
function getMI(mk) {
  const [m, y] = mk.split('-').map(Number);
  const d = new Date(y, m, 1);
  return {
    month: m,
    year: y,
    startDow: d.getDay(),
    totalDays: new Date(y, m + 1, 0).getDate()
  };
}

function isWE(day, mi) {
  return ((mi.startDow + day - 1) % 7) >= 5;
}

function mkCell(s, b) {
  return { s: s, b: b || 'none' };
}

function buildS(days, special, total, minfo) {
  const sc = {};
  for (let d = 1; d <= total; d++) {
    if (special[d]) sc[d] = mkCell(special[d], 'none');
    else if (days.includes(d)) sc[d] = mkCell(isWE(d, minfo) ? 'shabbat' : 'ward', 'none');
    else sc[d] = mkCell(isWE(d, minfo) ? 'weoff' : 'off', 'none');
  }
  return sc;
}

function getDefaultMayData() {
  const m = getMI('4-2026'); // May 2026
  const N = m.totalDays;
  const A = Array.from({ length: N }, (_, i) => i + 1);
  function ws(days, sp) { return buildS(days, sp, N, m); }
  
  return {
    seniors: [
      { name: 'אילה הוברט', schedule: ws([1, 2, 6, 7, 8, 9, 13, 14, 15, 16, 19, 20, 21, 22, 23, 27, 28, 29, 30, 31], {}) },
      { name: 'לונה כדורי', schedule: ws([1, 2, 3, 4, 6, 8, 9, 10, 11, 13, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 27, 29, 30, 31], {}) },
      { name: 'מרק ויגודה', schedule: ws(A, {}) },
      { name: 'מרק טמפר', schedule: ws(A, {}) },
      { name: 'מיכל לוטם', schedule: ws([1, 2, 6, 7, 8, 9, 13, 14, 15, 16, 19, 20, 21, 22, 23, 27, 28, 29, 30], {}) },
      { name: 'אלכסנדר לוסוס', schedule: ws([1, 2, 6, 8, 9, 13, 15, 16, 19, 20, 21, 22, 25, 27, 28], {}) },
      { name: 'ליניצקי אדוארד', schedule: ws([1, 2, 4, 8, 9, 11, 15, 16, 18, 21, 22, 23, 25, 29, 30], {}) },
      { name: 'מרימס שרון', schedule: ws([1, 2, 4, 7, 8, 9, 11, 14, 15, 16, 18, 20, 21, 22, 23, 25, 28, 29, 30], {}) },
      { name: 'חובב נחושתן', schedule: ws([1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26, 28, 29, 30, 31], {}) },
      { name: 'נמירובסקי איגור', schedule: ws(A, {}) },
      { name: 'סלאח עזאם', schedule: ws([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], {}) },
      { name: 'עוזיאלי ביאטריס', schedule: ws([1, 2, 3, 4, 8, 9, 10, 11, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29, 30, 31], {}) },
      { name: 'פרנק סטיבן', schedule: ws([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29, 30, 31], {}) },
      { name: 'יקיר רוטנברג', schedule: ws(A, {}) },
      { name: 'שי רוזנברג', schedule: ws([1, 2, 5, 7, 8, 9, 12, 14, 15, 16, 19, 21, 22, 23, 26, 28, 29, 30], {}) },
      { name: 'שני פאלוך', schedule: ws([1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31], {}) },
      { name: 'זיק אביעד', schedule: ws([1, 2, 3, 6, 8, 9, 10, 13, 15, 16, 17, 20, 21, 22, 23, 24, 27, 29, 30, 31], {}) },
      { name: 'עפרה מימון', schedule: ws(A, {}) },
      { name: 'עליאן פיראס', schedule: ws([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31], {}) },
      { name: 'נבו שושן', schedule: ws([1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30], {}) },
      { name: 'לוי עדי', schedule: ws(A, {}) },
      { name: 'מרלה עירית', schedule: ws([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31], {}) },
      { name: 'פיליפ בלומנפלד', schedule: ws(A, {}) },
      { name: 'אימן סלהב', schedule: ws(A, {}) },
      { name: 'פאנג מרסל', schedule: ws(A, {}) },
      { name: 'שרון נורדהיימר', schedule: ws([1, 2, 3, 6, 7, 8, 9, 10, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30], {}) },
      { name: 'שרגא גראס', schedule: ws(A, {}) },
      { name: 'דליה צורף', schedule: ws([1, 2, 3, 7, 8, 9, 10, 11, 14, 15, 16, 17, 19, 21, 22, 23, 24, 28, 29, 30, 31], {}) },
      { name: 'יעל ויגודה', schedule: ws([1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31], {}) },
      { name: 'מוטי אבנר', schedule: ws([1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31], {}) },
      { name: 'יהונתן זרביב', schedule: ws([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31], {}) },
      { name: 'בהאא בשיר', schedule: ws([1, 2, 3, 7, 8, 9, 10, 14, 15, 16, 17, 21, 22, 23, 24, 28, 29, 30, 31], {}) },
      { name: 'אוסאמה עבדאללה', schedule: ws(A, {}) },
    ],
    resident: [
      { name: 'סטניסלב בגליי', schedule: ws(A, { 14: 'postcall', 24: 'postcall', 28: 'postcall' }) },
      { name: "ג'וש מוס", schedule: ws(A, { 19: 'postcall', 26: 'postcall' }) },
      { name: 'ליאנה יאסין', schedule: ws(A, {}) },
      { name: 'בוהדנה חן', schedule: ws(A, { 10: 'postcall' }) },
      { name: "מוחמד ח'טיב", schedule: ws(A, { 3: 'postcallfri', 5: 'postcall', 7: 'postcall', 11: 'postcall' }) },
      { name: 'אולגה מקסימוב', schedule: ws(A, { 7: 'internal', 10: 'postcallfri' }) },
      { name: 'מלכי אנה', schedule: ws(A, { 6: 'internal', 11: 'internal', 17: 'internal', 20: 'postcallfri' }) },
      { name: 'אסתר ברייטברט', schedule: ws(A, {}) },
      { name: 'יוסי בן דור', schedule: ws(A, { 4: 'postcall', 11: 'postcall', 18: 'postcall', 25: 'postcall' }) },
      { name: 'טריין קבלסקי', schedule: ws(A, {}) },
      { name: 'זוהר שמואליאן', schedule: ws(A, { 3: 'internal', 4: 'internal', 6: 'internal', 7: 'internal', 10: 'internal', 11: 'internal', 13: 'internal', 14: 'internal', 17: 'internal', 18: 'internal', 20: 'internal', 24: 'internal', 25: 'internal', 27: 'internal', 28: 'internal', 31: 'internal' }) },
      { name: 'בשיר אבו עקיל', schedule: ws([], {}) },
      { name: "עדלי ג'עברי", schedule: ws([], {}) }
    ]
  };
}

// ═══ DATABASE DUAL-MODE CONTROLLER (Postgres vs JSON file) ═══
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Necessary for hosting providers like Supabase/Neon
    }
  });
}

let initPromise = null;
async function ensureInit() {
  if (!pool) return;
  if (!initPromise) {
    initPromise = initDB();
  }
  await initPromise;
}

async function initDB() {
  try {
    // Create the schema if it does not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onco_schedule_store (
        id INT PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    const res = await pool.query('SELECT data FROM onco_schedule_store WHERE id = 1');
    if (res.rows.length === 0) {
      console.log("PostgreSQL store is empty. Seeding initial data...");
      
      const initial = {
        notifications: [],
        schedules: {
          '4-2026': getDefaultMayData()
        }
      };

      if (fs.existsSync(JUNE_SEED_FILE)) {
        try {
          const juneRaw = fs.readFileSync(JUNE_SEED_FILE, 'utf-8');
          const juneData = JSON.parse(juneRaw);
          if (juneData['5-2026']) {
            initial.schedules['5-2026'] = juneData['5-2026'];
            console.log("Seeding June 2026 to PostgreSQL");
          }
        } catch (e) {
          console.error("Error parsing June seed for PG", e);
        }
      }

      await pool.query('INSERT INTO onco_schedule_store (id, data) VALUES (1, $1)', [JSON.stringify(initial)]);
      console.log("PostgreSQL seeding completed successfully.");
    }
  } catch (err) {
    console.error("Failed to initialize PostgreSQL table", err);
    throw err;
  }
}

let cachedData = null;

async function loadDatabase() {
  if (pool) {
    await ensureInit();
    const res = await pool.query('SELECT data FROM onco_schedule_store WHERE id = 1');
    if (res.rows.length > 0) {
      const dbData = res.rows[0].data;
      if (!dbData.notifications) dbData.notifications = [];
      if (!dbData.requests) dbData.requests = [];
      if (!dbData.birthdays) dbData.birthdays = {};
      if (!dbData.emails) dbData.emails = {};
      if (!dbData.settings) {
        dbData.settings = {
          adminPassword: "1234",
          thresholds: { ward: 3, radio: 1, daytreat: 1 }
        };
      }
      return dbData;
    }
  }

  // Local file fallback
  if (cachedData) return cachedData;
  
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      cachedData = JSON.parse(raw);
      if (!cachedData.notifications) cachedData.notifications = [];
      if (!cachedData.requests) cachedData.requests = [];
      if (!cachedData.birthdays) cachedData.birthdays = {};
      if (!cachedData.emails) cachedData.emails = {};
      if (!cachedData.settings) {
        cachedData.settings = {
          adminPassword: "1234",
          thresholds: { ward: 3, radio: 1, daytreat: 1 }
        };
      }
      return cachedData;
    } catch (e) {
      console.error("Error reading database.json, initializing default", e);
    }
  }

  // Seeding Database
  const initial = {
    notifications: [],
    requests: [],
    birthdays: {},
    emails: {},
    settings: {
      adminPassword: "1234",
      thresholds: { ward: 3, radio: 1, daytreat: 1 }
    },
    schedules: {
      '4-2026': getDefaultMayData()
    }
  };

  // Seeding June 2026 data
  if (fs.existsSync(JUNE_SEED_FILE)) {
    try {
      const juneRaw = fs.readFileSync(JUNE_SEED_FILE, 'utf-8');
      const juneData = JSON.parse(juneRaw);
      if (juneData['5-2026']) {
        initial.schedules['5-2026'] = juneData['5-2026'];
        console.log("Seeded June 2026 schedule from june_schedule.json");
      }
    } catch (e) {
      console.error("Error seeding June data", e);
    }
  }

  cachedData = initial;
  await saveDatabase(cachedData);
  return cachedData;
}

async function saveDatabase(dbData) {
  if (pool) {
    await ensureInit();
    await pool.query('UPDATE onco_schedule_store SET data = $1 WHERE id = 1', [JSON.stringify(dbData)]);
    return;
  }

  // Local file fallback
  cachedData = dbData;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedData, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing database.json", e);
  }
}

async function ensureMonth(mk) {
  const db = await loadDatabase();
  if (db.schedules[mk]) return db.schedules[mk];

  const mInfo = getMI(mk);
  
  // Find the closest previous month with schedule data to clone the roster
  let src = null;
  const sortedKeys = Object.keys(db.schedules).sort((a,b) => {
    const [ma, ya] = a.split('-').map(Number);
    const [mb, yb] = b.split('-').map(Number);
    return (ya * 12 + ma) - (yb * 12 + mb);
  });

  if (sortedKeys.length > 0) {
    src = db.schedules[sortedKeys[sortedKeys.length - 1]];
  }

  const newMonth = { seniors: [], resident: [] };
  
  if (src) {
    ['seniors', 'resident'].forEach(cat => {
      (src[cat] || []).forEach(p => {
        const sc = {};
        for (let d = 1; d <= mInfo.totalDays; d++) {
          sc[d] = mkCell(isWE(d, mInfo) ? 'weoff' : 'off', 'none');
        }
        newMonth[cat].push({ name: p.name, schedule: sc });
      });
    });
  }

  db.schedules[mk] = newMonth;
  await saveDatabase(db);
  return newMonth;
}

module.exports = {
  getSchedule: async (monthKey) => {
    await ensureMonth(monthKey);
    const db = await loadDatabase();
    return db.schedules[monthKey];
  },
  
  updateCell: async (monthKey, category, name, day, status, border) => {
    await ensureMonth(monthKey);
    const db = await loadDatabase();
    const md = db.schedules[monthKey];
    if (!md || !md[category]) return null;

    const p = md[category].find(x => x.name === name);
    if (!p) return null;

    const dayStr = String(day);
    if (!p.schedule[dayStr]) {
      p.schedule[dayStr] = mkCell('off', 'none');
    }

    const previousValue = JSON.parse(JSON.stringify(p.schedule[dayStr]));
    
    if (status !== undefined) p.schedule[dayStr].s = status;
    if (border !== undefined) p.schedule[dayStr].b = border;

    await saveDatabase(db);
    
    return {
      name,
      day,
      monthKey,
      previous: previousValue,
      current: p.schedule[dayStr]
    };
  },

  addDoctor: async (monthKey, category, name) => {
    await ensureMonth(monthKey);
    const db = await loadDatabase();
    const md = db.schedules[monthKey];
    if (!md || !md[category]) return false;

    // Check duplicate
    if (md[category].some(x => x.name === name)) return false;

    const mInfo = getMI(monthKey);
    const sc = {};
    for (let d = 1; d <= mInfo.totalDays; d++) {
      sc[d] = mkCell(isWE(d, mInfo) ? 'weoff' : 'off', 'none');
    }

    md[category].push({ name, schedule: sc });
    await saveDatabase(db);
    return true;
  },

  removeDoctor: async (monthKey, name) => {
    await ensureMonth(monthKey);
    const db = await loadDatabase();
    const md = db.schedules[monthKey];
    if (!md) return false;

    let removed = false;
    ['seniors', 'resident'].forEach(cat => {
      const originalLen = md[cat].length;
      md[cat] = md[cat].filter(x => x.name !== name);
      if (md[cat].length < originalLen) removed = true;
    });

    if (removed) await saveDatabase(db);
    return removed;
  },

  getNotifications: async (doctorName) => {
    const db = await loadDatabase();
    if (doctorName) {
      return db.notifications.filter(x => x.doctor === doctorName).reverse().slice(0, 50);
    }
    return db.notifications.reverse().slice(0, 100);
  },

  addNotification: async (doctor, monthKey, day, changeText, editor = 'מנהל') => {
    const db = await loadDatabase();
    const notif = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      doctor,
      monthKey,
      day,
      changeText,
      editor,
      timestamp: new Date().toISOString()
    };
    db.notifications.push(notif);
    
    // Limit notifications array size to 1000
    if (db.notifications.length > 1000) {
      db.notifications.shift();
    }
    
    await saveDatabase(db);
    return notif;
  },
  
  resetDatabase: async () => {
    if (pool) {
      await ensureInit();
      await pool.query('DELETE FROM onco_schedule_store WHERE id = 1');
      initPromise = null; // Reset promise to force re-seed on next request
      await ensureInit();
      return;
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.unlinkSync(DB_FILE);
      } catch (e) {}
    }
    cachedData = null;
    return await loadDatabase();
  },

  // ═══ REQUEST SYSTEM METHODS ═══
  addRequest: async (doctor, type, details, targetDay, targetMonth) => {
    const db = await loadDatabase();
    const reqObj = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      doctor,
      type,
      details: details || '',
      targetDay: targetDay || null,
      targetMonth: targetMonth || null,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    db.requests.push(reqObj);
    await saveDatabase(db);
    return reqObj;
  },

  getRequests: async () => {
    const db = await loadDatabase();
    return db.requests;
  },

  updateRequestStatus: async (requestId, status) => {
    const db = await loadDatabase();
    const request = db.requests.find(r => r.id === requestId);
    if (!request) return false;
    request.status = status;
    await saveDatabase(db);
    return true;
  },

  // ═══ BIRTHDAYS METHODS ═══
  getBirthdays: async () => {
    const db = await loadDatabase();
    return db.birthdays;
  },

  setBirthday: async (name, date) => {
    const db = await loadDatabase();
    db.birthdays[name] = date;
    await saveDatabase(db);
    return true;
  },

  // ═══ EMAIL SETTINGS METHODS ═══
  getEmail: async (doctor) => {
    const db = await loadDatabase();
    return db.emails[doctor] || '';
  },

  setEmail: async (doctor, email) => {
    const db = await loadDatabase();
    db.emails[doctor] = email;
    await saveDatabase(db);
    return true;
  },

  // ═══ BATCH UPDATES & ADMIN CONFIG METHODS ═══
  batchUpdateCells: async (monthKey, updates) => {
    await ensureMonth(monthKey);
    const db = await loadDatabase();
    const md = db.schedules[monthKey];
    if (!md) return null;

    const results = [];

    for (const update of updates) {
      const { category, name, day, status, border } = update;
      if (!category || !name || !day) continue;

      const p = md[category].find(x => x.name === name);
      if (!p) continue;

      const dayStr = String(day);
      if (!p.schedule[dayStr]) {
        p.schedule[dayStr] = { s: 'off', b: 'none' };
      }

      const previousValue = JSON.parse(JSON.stringify(p.schedule[dayStr]));
      
      if (status !== undefined) p.schedule[dayStr].s = status;
      if (border !== undefined) p.schedule[dayStr].b = border;

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
      if (status !== undefined && previousValue.s !== p.schedule[dayStr].s) {
        const prevL = statusLabels[previousValue.s] || previousValue.s;
        const currL = statusLabels[p.schedule[dayStr].s] || p.schedule[dayStr].s;
        changeParts.push(`מיקום מ-"${prevL}" ל-"${currL}"`);
      }
      if (border !== undefined && previousValue.b !== p.schedule[dayStr].b) {
        const prevB = borderLabels[previousValue.b] || previousValue.b;
        const currB = borderLabels[p.schedule[dayStr].b] || p.schedule[dayStr].b;
        changeParts.push(`תפקיד מ-"${prevB}" ל-"${currB}"`);
      }

      let notif = null;
      if (changeParts.length > 0) {
        const changeText = changeParts.join(', ');
        notif = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
          doctor: name,
          monthKey,
          day,
          changeText,
          editor: 'מנהל',
          timestamp: new Date().toISOString()
        };
        db.notifications.push(notif);
        if (db.notifications.length > 1000) db.notifications.shift();
      }

      results.push({
        category,
        name,
        day,
        s: p.schedule[dayStr].s,
        b: p.schedule[dayStr].b,
        notification: notif
      });
    }

    await saveDatabase(db);
    return results;
  },

  getAdminSettings: async () => {
    const db = await loadDatabase();
    return db.settings;
  },

  updateAdminSettings: async (settings) => {
    const db = await loadDatabase();
    db.settings = { ...db.settings, ...settings };
    await saveDatabase(db);
    return db.settings;
  },

  loadDatabase: loadDatabase
};
