// ═══ GLOBAL STATUS & DEFINITIONS ═══
const ST = {
  ward: { cls: 's-ward', label: 'מחלקה', sym: '✓', bg: '#E3F2FD' },
  clinic: { cls: 's-clinic', label: 'מרפאה', sym: 'מ', bg: '#E8F5E9' },
  off: { cls: 's-off', label: 'חופש', sym: '', bg: '#FCE4EC' },
  daytreat: { cls: 's-daytreat', label: 'ט.יום', sym: 'ט', bg: '#FFEBEE' },
  radio: { cls: 's-radio', label: 'רדיותרפיה', sym: 'ר', bg: '#F5F5F5' },
  basic: { cls: 's-basic', label: 'מדעי יסוד/רוטציה', sym: 'מי', bg: '#E8EAF6' },
  scopuscl: { cls: 's-scopuscl', label: 'מרפאה הר הצופים', sym: 'מה', bg: '#FFFDE7' },
  elective: { cls: 's-elective', label: 'אלקטיב', sym: 'אל', bg: '#EFEBE9' },
  postcall: { cls: 's-postcall', label: 'אחרי תורנות', sym: 'א', bg: '#FFF3E0' },
  augusta: { cls: 's-augusta', label: 'אוגוסטה', sym: 'או', bg: '#F1F8E9' },
  scopusday: { cls: 's-scopusday', label: 'אשפוז יום הר הצופים', sym: 'אי', bg: '#F3E5F5' },
  shabbat: { cls: 's-shabbat', label: 'שישי/שבת', sym: 'ש', bg: '#37474F' },
  internal: { cls: 's-internal', label: 'פנימית', sym: 'פ', bg: '#E0F2F1' },
  postcallfri: { cls: 's-postcallfri', label: 'אחרי תורנות שישי', sym: 'אש', bg: '#FBE9E7' },
  research: { cls: 's-research', label: 'מחקר', sym: 'מח', bg: '#E0F7FA' },
  reserve: { cls: 's-reserve', label: 'מילואים', sym: 'מל', bg: '#E6EE9C' },
  weoff: { cls: 's-weoff', label: 'סוף שבוע', sym: '', bg: '#ECEFF1' }
};

const ST_ORDER = ['ward', 'clinic', 'off', 'daytreat', 'radio', 'basic', 'scopuscl', 'elective', 'postcall', 'augusta', 'scopusday', 'shabbat', 'internal', 'postcallfri', 'research', 'reserve'];

const BD = {
  none: { cls: '', dcls: '', label: 'ללא', color: 'transparent' },
  oncall: { cls: 'b-oncall', dcls: 'd-oncall', label: 'תורן 🔴', color: '#d32f2f' },
  halfoncall: { cls: 'b-halfoncall', dcls: 'd-halfoncall', label: 'תורן חצי 🟡', color: '#fbc02d' },
  er_standby: { cls: 'b-er_standby', dcls: 'd-er_standby', label: 'כונן מיון ⬛', color: '#212121' },
  ward_standby: { cls: 'b-ward_standby', dcls: 'd-ward_standby', label: 'כונן מחלקה ⬜', color: '#9e9e9e' }
};

const BD_ORDER = ['oncall', 'halfoncall', 'er_standby', 'ward_standby', 'none'];

const BD_SUMMARY = [
  { key: 'oncall', label: '🔴 תורן', cls: 'sr-oncall' },
  { key: 'halfoncall', label: '🟡 תורן חצי', cls: 'sr-halfoncall' },
  { key: 'er_standby', label: '⬛ כונן מיון', cls: 'sr-er' },
  { key: 'ward_standby', label: '⬜ כונן מחלקה', cls: 'sr-ward' }
];

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ═══ STATE VARIABLES ═══
let currentMK = '5-2026'; // Default starts in June 2026!
let curTab = 'seniors';
let isEditMode = false;
let paintStatus = '';
let paintBorder = '';
let isPainting = false;

let DATA = null; // Holds the current month's fetched data
let ws = null; // WebSocket connection
let personalUser = localStorage.getItem('onco_default_user') || '';

// ═══ CALENDAR MATH HELPERS ═══
function mkKey(m, y) { return m + '-' + y; }
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
function isWE(day, mi) { return ((mi.startDow + day - 1) % 7) >= 5; }
function dowOf(day, mi) { return (mi.startDow + day - 1) % 7; }
function mi() { return getMI(currentMK); }
function monthLabel(mk) {
  const [m, y] = mk.split('-').map(Number);
  return HEB_MONTHS[m] + ' ' + y;
}

// Generate months May 2026 through Dec 2030 dynamically
function getMonthOptions() {
  const opts = [];
  for (let y = 2026; y <= 2030; y++) {
    const startM = (y === 2026) ? 4 : 0;
    const endM = 11;
    for (let m = startM; m <= endM; m++) {
      opts.push(mkKey(m, y));
    }
  }
  return opts;
}

// ═══ APP INITIALIZATION ═══
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  buildMonthSelector();
  buildLegend();
  initWebSocket();
  loadData();
});

function initTheme() {
  const saved = localStorage.getItem('onco_theme') || '';
  if (saved) document.body.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const curr = document.body.getAttribute('data-theme');
  const next = curr === 'dark' ? '' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('onco_theme', next);
}

function buildMonthSelector() {
  const sel = document.getElementById('monthSel');
  sel.innerHTML = '';
  getMonthOptions().forEach(mk => {
    const o = document.createElement('option');
    o.value = mk;
    o.textContent = monthLabel(mk);
    if (mk === currentMK) o.selected = true;
    sel.appendChild(o);
  });
}

// ═══ COLLABORATIVE WEBSOCKET SYNC ═══
function initWebSocket() {
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateSyncStatus(true, 'מחובר ומסונכרן בזמן אמת');
    // Keepalive ping
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };

  ws.onclose = () => {
    updateSyncStatus(false, 'החיבור לשרת אבד. מנסה להתחבר מחדש...');
    setTimeout(initWebSocket, 3000); // Reconnect backoff
  };

  ws.onerror = () => {
    updateSyncStatus(false, 'שגיאת תקשורת עם השרת');
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleSocketMessage(payload);
    } catch (e) {
      console.error("Error handling WebSocket message", e);
    }
  };
}

function updateSyncStatus(connected, text) {
  const el = document.getElementById('syncStatus');
  const txtEl = document.getElementById('syncText');
  if (connected) {
    el.classList.remove('disconnected');
    el.classList.add('connected');
  } else {
    el.classList.remove('connected');
    el.classList.add('disconnected');
  }
  txtEl.textContent = text;
}

function handleSocketMessage(payload) {
  if (payload.type === 'cell_update') {
    const { monthKey, category, name, day, s, b, notification } = payload.data;
    
    // Update local cache if viewed month matches
    if (monthKey === currentMK && DATA) {
      const list = DATA[category];
      if (list) {
        const doc = list.find(x => x.name === name);
        if (doc) {
          doc.schedule[day] = { s, b };
        }
      }
      
      // Update UI cell element dynamically without full render (super fast & fluid!)
      const cellEl = document.querySelector(`td[data-person="${name}"][data-day="${day}"]`);
      if (cellEl) {
        const sInfo = ST[s] || ST.off;
        const bInfo = BD[b] || BD.none;
        
        // Remove old classes and add new ones
        cellEl.className = `${sInfo.cls} ${bInfo.cls} ${isEditMode ? 'editable' : ''}`;
        
        // Update dot
        let dotEl = cellEl.querySelector('.duty-dot');
        if (bInfo.dcls) {
          if (!dotEl) {
            dotEl = document.createElement('span');
            cellEl.prepend(dotEl);
          }
          dotEl.className = `duty-dot ${bInfo.dcls}`;
        } else if (dotEl) {
          dotEl.remove();
        }
        
        // Update text content and tooltip
        const contentEl = cellEl.querySelector('.cell-content');
        if (contentEl) {
          contentEl.innerHTML = `${sInfo.sym}<div class="ttip">${name} | יום ${day}<br>${sInfo.label}${b !== 'none' ? ' | ' + bInfo.label : ''}</div>`;
        }
      }
      
      // Update statistics and summaries
      updateStatsAndSummaries();
    }

    // Trigger Notification for registered default user
    if (personalUser && name === personalUser) {
      // Re-render personal panels
      showPersonalView();
      
      // Trigger native browser notification
      if (notification) {
        triggerDesktopNotification(
          `עדכון בסידור העבודה: יום ${day} ב${monthLabel(monthKey)}`,
          `מנהל עדכן את השיבוץ שלך: ${notification.changeText}`
        );
      }
    }
  } else if (payload.type === 'roster_update') {
    // Roster changed (doctor added/removed), reload layout
    if (payload.data.monthKey === currentMK) {
      loadData();
    }
  } else if (payload.type === 'reset') {
    window.location.reload();
  }
}

// ═══ DATA UTILITIES & REST CALLS ═══
async function loadData() {
  const container = document.getElementById('tableWrap');
  container.innerHTML = '<div class="table-loading">טוען סידור עבודה מהשרת...</div>';
  
  try {
    const res = await fetch(`/api/schedule?month=${currentMK}`);
    if (!res.ok) throw new Error("Failed to fetch schedule");
    DATA = await res.json();
    render();
  } catch (e) {
    container.innerHTML = `<div class="table-error">שגיאה בטעינת הנתונים: ${e.message}. אנא ודאו שהשרת פעיל ונסו לרענן.</div>`;
  }
}

function getCell(v) {
  if (!v) return mkCell('off', 'none');
  return { s: v.s || 'off', b: v.b || 'none' };
}

function cellInfo(c) {
  const cell = getCell(c);
  const s = ST[cell.s] || ST.off;
  const b = BD[cell.b] || BD.none;
  return {
    cls: s.cls,
    bcls: b.cls,
    dcls: b.dcls,
    text: s.sym,
    tip: s.label + (cell.b !== 'none' ? ' | ' + b.label : ''),
    bg: s.bg,
    bcolor: b.color,
    border: cell.b
  };
}

// ═══ GRID TABLE RENDERING ═══
function render() {
  const { list, label } = getStaffList();
  document.getElementById('tableWrap').innerHTML = renderTable(list, label);
  updateStatsAndSummaries();
  populateDefaultUserSelector();
  applySearch();
  showPersonalView();
  updateGreeting();
}

function getStaffList() {
  if (!DATA) return { list: [], label: '' };
  if (curTab === 'all') {
    const list = [].concat(DATA.seniors || []).concat(DATA.resident || []);
    return { list, label: 'כל הצוות' };
  }
  const labels = { seniors: 'בכירים ומומחים', resident: 'מתמחים - מדיקל' };
  return { list: DATA[curTab] || [], label: labels[curTab] };
}

function renderTable(list, label) {
  const m = mi();
  let h = `<table><thead><tr><th class="nm" style="position:sticky;right:0;z-index:15">${label}</th>`;
  
  for (let d = 1; d <= m.totalDays; d++) {
    const wc = isWE(d, m) ? ' we' : '';
    h += `<th class="day-header${wc}"><span class="dn">${d}</span><span class="dw">${DOW[dowOf(d, m)]}</span></th>`;
  }
  h += '</tr></thead><tbody>';
  
  list.forEach(p => {
    const esc = p.name.replace(/'/g, "\\'");
    const isUserRow = personalUser && p.name === personalUser;
    const rowClass = isUserRow ? ' class="hl"' : '';
    
    h += `<tr data-name="${p.name}"${rowClass}>`;
    h += `<td class="nm">${p.name}`;
    if (isEditMode) {
      h += ` <span class="remove-btn" title="מחיקה מהסידור" onclick="removeStaffRoster('${esc}')">✕</span>`;
    }
    h += `</td>`;
    
    for (let d = 1; d <= m.totalDays; d++) {
      const ci = cellInfo(p.schedule[d]);
      const ec = isEditMode ? ' editable' : '';
      const cs = `${ci.cls} ${ci.bcls} ${ec}`;
      const dot = ci.dcls ? `<span class="duty-dot ${ci.dcls}"></span>` : '';
      
      h += `<td class="${cs}" data-day="${d}" data-person="${p.name}"`;
      if (isEditMode) {
        h += ` onmousedown="startPaint(this)" onmouseenter="doPaint(this)" onmouseup="endPaint()" onclick="cellClick(this,event)"`;
      }
      h += `>${dot}<div class="cell-content">${ci.text}<div class="ttip">${p.name} | יום ${d}<br>${ci.tip}</div></div></td>`;
    }
    h += '</tr>';
  });

  // Summary rows placeholder
  BD_SUMMARY.forEach(bs => {
    h += `<tr class="summary-row ${bs.cls}" id="summary-${bs.key}"><td class="nm">${bs.label}</td>`;
    for (let d = 1; d <= m.totalDays; d++) {
      h += `<td class="sum-cell" data-sum-day="${d}"></td>`;
    }
    h += '</tr>';
  });

  return h + '</tbody></table>';
}

function updateStatsAndSummaries() {
  if (!DATA) return;
  const m = mi();
  
  // Update summaries
  const { list } = getStaffList();
  
  BD_SUMMARY.forEach(bs => {
    const rowEl = document.getElementById(`summary-${bs.key}`);
    if (!rowEl) return;
    
    for (let d = 1; d <= m.totalDays; d++) {
      const names = [];
      list.forEach(p => {
        const cell = getCell(p.schedule[d]);
        if (cell.b === bs.key) {
          const parts = p.name.split(' ');
          names.push(parts[parts.length - 1]); // Last name
        }
      });
      const cellEl = rowEl.querySelector(`td[data-sum-day="${d}"]`);
      if (cellEl) {
        cellEl.innerHTML = names.join('<br>');
        cellEl.style.fontSize = '0.7em';
        cellEl.style.padding = '2px';
        cellEl.style.whiteSpace = 'normal';
        cellEl.style.maxWidth = '60px';
        cellEl.style.overflow = 'hidden';
      }
    }
  });

  // Update Statistics
  const today = new Date();
  let dom = 0;
  if (today.getMonth() === m.month && today.getFullYear() === m.year) {
    dom = today.getDate();
  }
  
  let pres = 0, abs = 0;
  if (dom >= 1 && dom <= m.totalDays) {
    list.forEach(p => {
      const c = getCell(p.schedule[dom]);
      if (c.s !== 'off' && c.s !== 'weoff') pres++;
      else if (c.s === 'off') abs++;
    });
  }

  let h = `<div class="stat-item"><b>${list.length}</b><span>סה"כ רופאים</span></div>`;
  h += `<div class="stat-item"><b>${m.totalDays}</b><span>ימים בחודש</span></div>`;
  if (dom) {
    h += `<div class="stat-item"><b>${pres}</b><span>נוכחים היום</span></div>`;
    h += `<div class="stat-item"><b>${abs}</b><span>בחופש היום</span></div>`;
  } else {
    h += `<div class="stat-item"><b>-</b><span>מחוץ לטווח היום</span></div>`;
  }
  
  document.getElementById('statsBar').innerHTML = h;
}

function switchTab(t) {
  curTab = t;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${t}`).classList.add('active');
  render();
}

function changeMonth() {
  currentMK = document.getElementById('monthSel').value;
  loadData();
}

// ═══ EDIT MODE & PAINT DRAWING LOGIC ═══
function setEditMode(edit) {
  isEditMode = edit;
  
  // Update mode buttons
  document.getElementById('viewModeBtn').classList.toggle('active', !edit);
  document.getElementById('editModeBtn').classList.toggle('active', edit);
  
  // Show/hide toolbar
  document.getElementById('editToolbar').classList.toggle('show', edit);
  
  // Trigger table re-render to attach/detach editing handlers
  render();
}

function selectPaintStatus(val) {
  paintStatus = val;
  if (val) {
    paintBorder = '';
    document.getElementById('paintBd').value = '';
  }
}

function selectPaintBorder(val) {
  paintBorder = val;
  if (val) {
    paintStatus = '';
    document.getElementById('paintSt').value = '';
  }
}

// Drag paint handlers
function startPaint(td) {
  if (!paintStatus && !paintBorder) return;
  isPainting = true;
  paintCell(td);
}
function doPaint(td) {
  if (!isPainting) return;
  paintCell(td);
}
function endPaint() {
  isPainting = false;
}
document.addEventListener('mouseup', endPaint);

async function paintCell(td) {
  const name = td.getAttribute('data-person');
  const day = parseInt(td.getAttribute('data-day'));
  if (!name || !day) return;
  
  const category = getCategoryForName(name);
  
  try {
    const payload = {
      monthKey: currentMK,
      category,
      name,
      day,
      status: paintStatus ? paintStatus : undefined,
      border: paintBorder ? paintBorder : undefined
    };
    
    // Optimistically update cell locally for instant feel
    const sVal = paintStatus ? paintStatus : undefined;
    const bVal = paintBorder ? paintBorder : undefined;
    
    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error("Failed to save cell update");
  } catch (e) {
    console.error("Error saving update", e);
  }
}

function getCategoryForName(name) {
  if (!DATA) return 'seniors';
  if (DATA.resident.some(x => x.name === name)) return 'resident';
  return 'seniors';
}

// ═══ CELL PICKER LOGIC (ON SINGLE CLICK) ═══
let activePickerCell = null;
function cellClick(td, ev) {
  if (paintStatus || paintBorder) return; // Ignore click picker if in paint/drag mode
  
  ev.stopPropagation();
  closeCellPicker();
  
  const picker = document.getElementById('cellPicker');
  let h = '<div class="cp-section">📍 שינוי מיקום (צבע רקע)</div>';
  ST_ORDER.forEach(k => {
    const s = ST[k];
    h += `<div class="cp-item" onclick="applyCellPickerLoc('${k}')"><div class="cp-box" style="background:${s.bg}"></div>${s.label}</div>`;
  });
  h += '<div class="cp-section">🚨 שינוי תורנות/כוננות (מסגרת)</div>';
  BD_ORDER.forEach(k => {
    const b = BD[k];
    const sty = k === 'none' ? 'background:#f5f5f5' : `background:#f5f5f5;box-shadow:inset 0 0 0 3px ${b.color}`;
    h += `<div class="cp-item" onclick="applyCellPickerBrd('${k}')"><div class="cp-border-box" style="${sty}"></div>${b.label}</div>`;
  });
  
  picker.innerHTML = h;
  
  const rect = td.getBoundingClientRect();
  picker.style.top = Math.min(rect.bottom + window.scrollY + 2, window.innerHeight + window.scrollY - 300) + 'px';
  picker.style.left = Math.max(rect.left + window.scrollX, 10) + 'px';
  picker.classList.add('show');
  activePickerCell = td;
}

function closeCellPicker() {
  document.getElementById('cellPicker').classList.remove('show');
  activePickerCell = null;
}
document.addEventListener('click', closeCellPicker);

async function applyCellPickerLoc(status) {
  if (!activePickerCell) return;
  const td = activePickerCell;
  const name = td.getAttribute('data-person');
  const day = parseInt(td.getAttribute('data-day'));
  const category = getCategoryForName(name);
  
  closeCellPicker();
  
  try {
    await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey: currentMK, category, name, day, status })
    });
  } catch (e) {
    console.error(e);
  }
}

async function applyCellPickerBrd(border) {
  if (!activePickerCell) return;
  const td = activePickerCell;
  const name = td.getAttribute('data-person');
  const day = parseInt(td.getAttribute('data-day'));
  const category = getCategoryForName(name);
  
  closeCellPicker();
  
  try {
    await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey: currentMK, category, name, day, border })
    });
  } catch (e) {
    console.error(e);
  }
}

// ═══ ADD/REMOVE STAFF ═══
function openAddStaffModal() {
  document.getElementById('addStaffModal').classList.add('show');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

async function addNewStaff() {
  const name = document.getElementById('newStaffName').value.trim();
  const category = document.getElementById('newStaffCat').value;
  if (!name) {
    alert('נא להזין שם רופא מלא');
    return;
  }

  try {
    const res = await fetch('/api/staff/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey: currentMK, category, name })
    });
    
    if (res.ok) {
      closeModal('addStaffModal');
      document.getElementById('newStaffName').value = '';
    } else {
      const err = await res.json();
      alert(`שגיאה: ${err.error}`);
    }
  } catch (e) {
    console.error(e);
  }
}

async function removeStaffRoster(name) {
  if (!confirm(`האם למחוק את הרופא/ה "${name}" מלוח השיבוץ?`)) return;
  try {
    const res = await fetch('/api/staff/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey: currentMK, name })
    });
    if (!res.ok) {
      alert("שגיאה במחיקת רופא");
    }
  } catch(e) {
    console.error(e);
  }
}

async function confirmResetDatabase() {
  if (!confirm("⚠️ אזהרה: האם לאפס את בסיס הנתונים כולו לברירת המחדל? כל השינויים שלכם יימחקו!")) return;
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    if (res.ok) {
      window.location.reload();
    }
  } catch(e) {
    console.error(e);
  }
}

// ═══ SEARCH & LEGEND CONTROLS ═══
function doSearch(q) {
  q = q.trim();
  document.querySelectorAll('tbody tr').forEach(r => {
    const name = r.getAttribute('data-name') || '';
    if (name.includes(q)) {
      r.style.display = '';
      if (q) {
        r.classList.add('hl-row');
      } else {
        r.classList.remove('hl-row');
      }
    } else {
      r.style.display = 'none';
    }
  });
}

function applySearch() {
  const q = document.getElementById('searchInp').value;
  if (q) doSearch(q);
}

function toggleLegend() {
  const el = document.getElementById('legendWrapper');
  const icon = document.getElementById('legendToggleIcon');
  const coll = el.classList.contains('collapsed');
  
  if (coll) {
    el.classList.remove('collapsed');
    icon.textContent = '❌';
  } else {
    el.classList.add('collapsed');
    icon.textContent = '👁️';
  }
}

function buildLegend() {
  let h = '<h3>📌 מקרא מיקומים (צבעי רקע)</h3><div class="legend-grid">';
  ST_ORDER.forEach(k => {
    const s = ST[k];
    const tc = k === 'shabbat' ? 'color:#CFD8DC' : '';
    h += `<div class="leg-item"><div class="leg-box" style="background:${s.bg};${tc}">${s.sym}</div><div class="leg-lbl">${s.label}</div></div>`;
  });
  h += '</div><h4>🚨 מקרא תורנויות וכוננויות (מסגרות פנימיות + נקודות)</h4><div class="legend-grid">';
  BD_ORDER.forEach(k => {
    if (k === 'none') return;
    const b = BD[k];
    const sty = `background:#f5f5f5;box-shadow:inset 0 0 0 3px ${b.color}`;
    h += `<div class="leg-item"><div class="leg-box" style="${sty};color:#333;font-size:0.5em">●</div><div class="leg-lbl">${b.label}</div></div>`;
  });
  h += '</div>';
  document.getElementById('legendGrid').innerHTML = h;
}

// ═══ SETTINGS & PERSONAL VIEW DASHBOARD ═══
function populateDefaultUserSelector() {
  const sel = document.getElementById('defaultUserSel');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- ללא משתמש מוגדר --</option>';
  
  if (!DATA) return;
  const cats = { seniors: 'בכירים ומומחים', resident: 'מתמחים' };
  
  Object.entries(cats).forEach(([k, lbl]) => {
    const g = document.createElement('optgroup');
    g.label = lbl;
    (DATA[k] || []).forEach(p => {
      const o = document.createElement('option');
      o.value = p.name;
      o.textContent = p.name;
      if (p.name === personalUser) o.selected = true;
      g.appendChild(o);
    });
    sel.appendChild(g);
  });
}

function openSettings() {
  populateDefaultUserSelector();
  document.getElementById('settingsModal').classList.add('show');
}

function saveSettings() {
  const selVal = document.getElementById('defaultUserSel').value;
  personalUser = selVal;
  localStorage.setItem('onco_default_user', selVal);
  closeModal('settingsModal');
  
  // Highlight active user row and update dashboard views
  render();
}

function updateGreeting() {
  const el = document.getElementById('greeting');
  if (el) {
    el.textContent = personalUser ? `שלום, ${personalUser}` : '';
  }
}

function scrollToPersonalPanel() {
  document.getElementById('personalPanel').scrollIntoView({ behavior: 'smooth' });
}

function findPersonInCache(name) {
  if (!DATA) return null;
  for (const k of ['seniors', 'resident']) {
    const p = (DATA[k] || []).find(x => x.name === name);
    if (p) return p;
  }
  return null;
}

async function showPersonalView() {
  const wContent = document.getElementById('widgetContent');
  const calContainer = document.getElementById('pcalContainer');
  const userDisp = document.getElementById('panelUserDisplay');
  const listDisp = document.getElementById('notifList');
  
  if (!personalUser) {
    wContent.innerHTML = `<div class="no-user-alert">טרם הוגדר משתמש אישי. לחצו על גלגל השיניים ⚙️ או היכנסו להגדרות לבחירת שמכם לקבלת עדכונים והתראות.</div>`;
    calContainer.innerHTML = `<div class="no-user-placeholder">נא לבחור רופא ברירת מחדל בהגדרות כדי להציג את לוח השנה האישי.</div>`;
    userDisp.textContent = '';
    listDisp.innerHTML = `<div class="no-notif-placeholder">אין עדכונים חדשים</div>`;
    return;
  }

  const person = findPersonInCache(personalUser);
  userDisp.textContent = `משתמש: ${personalUser}`;
  
  const m = mi();
  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = today.getMonth() === m.month && today.getFullYear() === m.year;
  
  // Update Widget Content
  if (person) {
    const activeDay = isCurrentMonth && todayDay >= 1 && todayDay <= m.totalDays ? todayDay : 1;
    const cellVal = person.schedule[activeDay];
    const ci = cellInfo(cellVal);
    
    const dayLabelStr = isCurrentMonth ? 'היום' : `יום 1 ל${HEB_MONTHS[m.month]}`;
    
    wContent.innerHTML = `
      <div class="user-widget-info">
        <div class="widget-status-badge">
          <span>${dayLabelStr}: מיקום</span>
          <strong>${ci.tip.split('|')[0].trim()}</strong>
        </div>
        ${cellVal && cellVal.b !== 'none' ? `
          <div class="widget-status-badge" style="border-color:${ci.bcolor}">
            <span>${dayLabelStr}: תורנות/כוננות</span>
            <strong style="color:${ci.bcolor === '#212121' ? 'var(--text-main)' : ci.bcolor}">${BD[cellVal.b].label}</strong>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    wContent.innerHTML = `<div class="no-user-alert">משתמש "${personalUser}" לא נמצא בחודש הנוכחי (${monthLabel(currentMK)}). ייתכן שיש לעדכן את הרשימה השמית.</div>`;
  }

  // Update Personal Calendar
  if (person) {
    document.getElementById('calendarTitle').textContent = `📅 לוח אישי: ${personalUser} | ${monthLabel(currentMK)}`;
    
    let h = '';
    DOW.forEach(d => { h += `<div class="pcal-hdr">${d}</div>`; });
    for (let i = 0; i < m.startDow; i++) h += '<div class="pcal-d pcal-e"></div>';
    
    for (let d = 1; d <= m.totalDays; d++) {
      const cellVal = person.schedule[d];
      const ci = cellInfo(cellVal);
      const isToday = isCurrentMonth && d === todayDay;
      const bstyle = ci.bcolor !== 'transparent' ? `box-shadow:inset 0 0 0 3px ${ci.bcolor};` : '';
      const todayStyle = isToday ? 'border: 2px dashed var(--accent);' : '';
      const dutyText = cellVal && cellVal.b !== 'none' ? BD[cellVal.b].label : '';
      
      const tc = ci.cls === 's-shabbat' ? 'color:#CFD8DC;' : '';
      
      h += `
        <div class="pcal-d" style="background:${ci.bg};${tc}${bstyle}${todayStyle}">
          <div class="pn">${d}</div>
          <div class="ps">${ci.tip.split('|')[0].trim()}</div>
          ${dutyText ? `<div class="pd">${dutyText}</div>` : ''}
        </div>
      `;
    }
    calContainer.innerHTML = h;
  } else {
    calContainer.innerHTML = `<div class="no-user-placeholder">הרופא "${personalUser}" אינו רשום בחודש זה.</div>`;
  }

  // Fetch in-app notifications logs
  try {
    const res = await fetch(`/api/notifications?doctor=${encodeURIComponent(personalUser)}`);
    if (res.ok) {
      const logs = await res.json();
      if (logs.length > 0) {
        listDisp.innerHTML = logs.map(log => {
          const dt = new Date(log.timestamp);
          const timeStr = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')} - ${dt.getDate()}/${dt.getMonth()+1}`;
          
          return `
            <div class="notif-item">
              <div class="notif-header">
                <span>תאריך יעד: ${log.day}/${log.monthKey.split('-')[0]*1+1}</span>
                <span>${timeStr}</span>
              </div>
              <div class="notif-body">${log.changeText}</div>
            </div>
          `;
        }).join('');
      } else {
        listDisp.innerHTML = `<div class="no-notif-placeholder">אין עדכונים חדשים</div>`;
      }
    }
  } catch (e) {
    console.error("Error fetching notification logs", e);
  }
}

// ═══ PUSH NOTIFICATION API CONTROLS ═══
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("דפדפן זה אינו תומך בהתראות שולחן עבודה.");
    return;
  }
  
  Notification.requestPermission().then(permission => {
    updateNotificationButton(permission);
    if (permission === 'granted') {
      new Notification("התראות הופעלו בהצלחה!", {
        body: "תקבלו התראה מיידית כאשר מנהל ישנה את השיבוץ שלכם.",
        icon: "📋"
      });
    }
  });
}

function updateNotificationButton(permission) {
  const btn = document.getElementById('notiAuthBtn');
  if (!btn) return;
  if (permission === 'granted') {
    btn.style.borderColor = 'hsl(145, 70%, 45%)';
    btn.style.color = 'hsl(145, 70%, 40%)';
    btn.title = 'התראות שולחן עבודה מופעלות ✓';
  } else if (permission === 'denied') {
    btn.style.borderColor = 'hsl(0, 70%, 45%)';
    btn.style.color = 'hsl(0, 70%, 40%)';
    btn.title = 'התראות שולחן עבודה נחסמו ❌';
  } else {
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text-main)';
  }
}

function triggerDesktopNotification(title, body) {
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: "📋" });
    } catch(e) {
      console.error(e);
    }
  }
}
