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
let curTab = 'all';
let isEditMode = false;
let paintStatus = '';
let paintBorder = '';
let isPainting = false;

let DATA = null; // Holds the current month's fetched data
let ws = null; // WebSocket connection
let personalUser = localStorage.getItem('onco_default_user') || '';
let pendingChanges = {};
let adminSettings = { thresholds: { ward: 3, radio: 1, daytreat: 1 } };

// Prompt user before closing window with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (Object.keys(pendingChanges).length > 0) {
    e.preventDefault();
    e.returnValue = 'ישנם שינויים שלא נשמרו. האם לצאת בכל זאת?';
    return e.returnValue;
  }
});

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
  } else if (payload.type === 'new_request' || payload.type === 'request_update') {
    loadAdminRequests();
  } else if (payload.type === 'reset') {
    window.location.reload();
  }
}

// ═══ DATA UTILITIES & REST CALLS ═══
async function loadData() {
  const container = document.getElementById('tableWrap');
  container.innerHTML = '<div class="table-loading">טוען סידור עבודה מהשרת...</div>';
  
  try {
    const [res, settingsRes] = await Promise.all([
      fetch(`/api/schedule?month=${currentMK}`),
      fetch('/api/admin/settings')
    ]);
    if (!res.ok) throw new Error("Failed to fetch schedule");
    DATA = await res.json();
    if (settingsRes.ok) {
      adminSettings = await settingsRes.json();
    }
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
  loadAdminRequests();
  checkTodayBirthdays();
}

function getStaffList() {
  if (!DATA) return { list: [], label: '' };
  const specialNames = ['בשיר אבו עקיל', "עדלי ג'עברי"];
  
  if (curTab === 'all') {
    const seniors = DATA.seniors || [];
    const residentsNormal = (DATA.resident || []).filter(r => !specialNames.includes(r.name));
    const residentsSpecial = (DATA.resident || []).filter(r => specialNames.includes(r.name));
    const list = [].concat(seniors).concat(residentsNormal).concat(residentsSpecial);
    return { list, label: 'כל הצוות' };
  }
  
  if (curTab === 'resident') {
    const residentsNormal = (DATA.resident || []).filter(r => !specialNames.includes(r.name));
    const residentsSpecial = (DATA.resident || []).filter(r => specialNames.includes(r.name));
    const list = [].concat(residentsNormal).concat(residentsSpecial);
    return { list, label: 'מתמחים' };
  }
  
  const labels = { seniors: 'בכירים ומומחים', resident: 'מתמחים' };
  return { list: DATA[curTab] || [], label: labels[curTab] };
}

function renderTable(list, label) {
  const m = mi();
  const holidays = window.getHolidays ? window.getHolidays(m.month, m.year) : {};
  let h = `<table><thead><tr><th class="nm" style="position:sticky;right:0;z-index:15">${label}</th>`;
  
  for (let d = 1; d <= m.totalDays; d++) {
    const wc = isWE(d, m) ? ' we' : '';
    const dayHols = holidays[d] || [];
    
    const dateObj = new Date(m.year, m.month, d);
    const hebDateFull = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
    const hebDayOnly = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(dateObj);
    
    const shortages = getDayShortages(d);
    const warningHtml = shortages.length > 0
      ? `<span class="shortage-warning" title="חוסר במתמחים: ${shortages.join(', ')}" style="color:hsl(0, 85%, 60%); cursor:help; margin-right:4px;">⚠️</span>`
      : '';
      
    const tooltipTexts = [hebDateFull];
    if (dayHols.length > 0) tooltipTexts.push(dayHols.join(', '));
    const holIndicator = dayHols.length > 0 
      ? `<span class="holiday-indicator">🎉</span>` 
      : '';
      
    h += `<th class="day-header${wc}" title="${tooltipTexts.join(' | ')}">
            <span class="dn">${d}</span>
            <span class="dw">${DOW[dowOf(d, m)]}</span>
            <span class="dheb" style="font-size:0.65em; display:block; opacity:0.8; font-weight:normal;">${hebDayOnly}</span>
            ${warningHtml} ${holIndicator}
          </th>`;
  }
  h += '</tr></thead><tbody>';
  
  const specialNames = ['בשיר אבו עקיל', "עדלי ג'עברי"];
  let renderedSpecialHeader = false;
  
  list.forEach(p => {
    const esc = p.name.replace(/'/g, "\\'");
    const isUserRow = personalUser && p.name === personalUser;
    const rowClass = isUserRow ? ' class="hl"' : '';
    const category = getCategoryForName(p.name);
    
    if (specialNames.includes(p.name) && !renderedSpecialHeader) {
      renderedSpecialHeader = true;
      h += `<tr class="section-divider-row"><td colspan="${m.totalDays + 1}" style="background:hsl(210, 85%, 95%); color:var(--primary); font-weight:700; text-align:right; padding:6px 12px; font-size:0.85em;">מתמחים לתורנויות בלבד (תורנות / תורנות חצי בלבד)</td></tr>`;
    }
    
    h += `<tr data-name="${p.name}"${rowClass}>`;
    h += `<td class="nm">${p.name}`;
    if (isEditMode) {
      h += ` <span class="remove-btn" title="מחיקה מהסידור" onclick="removeStaffRoster('${esc}')">✕</span>`;
    }
    h += `</td>`;
    
    for (let d = 1; d <= m.totalDays; d++) {
      const pKey = `${category}_${p.name}_${d}`;
      let cellVal = p.schedule[d] || { s: 'off', b: 'none' };
      const isPending = !!pendingChanges[pKey];
      if (isPending) {
        cellVal = {
          s: pendingChanges[pKey].status !== undefined ? pendingChanges[pKey].status : cellVal.s,
          b: pendingChanges[pKey].border !== undefined ? pendingChanges[pKey].border : cellVal.b
        };
      }
      
      const ci = cellInfo(cellVal);
      const ec = isEditMode ? ' editable' : '';
      const pendingCls = isPending ? ' pending-cell' : '';
      const cs = `${ci.cls} ${ci.bcls}${ec}${pendingCls}`;
      const dot = ci.dcls ? `<span class="duty-dot ${ci.dcls}"></span>` : '';
      
      h += `<td class="${cs}" data-day="${d}" data-person="${p.name}"`;
      if (isEditMode) {
        h += ` onmousedown="startPaint(this)" onmouseenter="doPaint(this)" onmouseup="endPaint()" onclick="cellClick(this,event)" oncontextmenu="cellRightClick(this,event)"`;
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

  let residentsInWard = 0;
  if (DATA && DATA.resident && dom >= 1 && dom <= m.totalDays) {
    DATA.resident.forEach(p => {
      const c = getCell(p.schedule[dom]);
      if (c.s === 'ward') residentsInWard++;
    });
  }

  let h = `<div class="stat-item"><b>${list.length}</b><span>סה"כ רופאים</span></div>`;
  h += `<div class="stat-item"><b>${m.totalDays}</b><span>ימים בחודש</span></div>`;
  if (dom) {
    h += `<div class="stat-item"><b>${pres}</b><span>נוכחים היום</span></div>`;
    h += `<div class="stat-item"><b>${abs}</b><span>בחופש היום</span></div>`;
    h += `<div class="stat-item"><b>${residentsInWard}</b><span>מתמחים במחלקה</span></div>`;
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
  const specialNames = ['בשיר אבו עקיל', "עדלי ג'עברי"];
  
  if (specialNames.includes(name)) {
    if (paintStatus && paintStatus !== 'off') {
      return; // Do not allow location other than off
    }
  }
  
  registerPendingChange(category, name, day, paintStatus ? paintStatus : undefined, paintBorder ? paintBorder : undefined);
  updateCellUI(td, name, day, category);
  updateUnsavedState();
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
  
  const name = td.getAttribute('data-person');
  const specialNames = ['בשיר אבו עקיל', "עדלי ג'עברי"];
  const isSpecialRes = specialNames.includes(name);
  
  const picker = document.getElementById('cellPicker');
  let h = '';
  
  if (!isSpecialRes) {
    h += '<div class="cp-section">📍 שינוי מיקום (צבע רקע)</div>';
    ST_ORDER.forEach(k => {
      const s = ST[k];
      h += `<div class="cp-item" onclick="applyCellPickerLoc('${k}')"><div class="cp-box" style="background:${s.bg}"></div>${s.label}</div>`;
    });
  }
  
  h += '<div class="cp-section">🚨 שינוי תורנות/כוננות (מסגרת)</div>';
  const allowedBorders = isSpecialRes ? ['oncall', 'halfoncall', 'none'] : BD_ORDER;
  allowedBorders.forEach(k => {
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
  const p = document.getElementById('cellPicker');
  if (p) p.classList.remove('show');
  activePickerCell = null;
}
document.addEventListener('click', closeCellPicker);

function cellRightClick(td, ev) {
  ev.preventDefault();
  cellClick(td, ev);
}

function personalCellRightClick(div, ev, doctor, day) {
  ev.preventDefault();
  cellClick(div, ev);
}

function personalCellClick(div, ev, doctor, day) {
  cellClick(div, ev);
}

async function applyCellPickerLoc(status) {
  if (!activePickerCell) return;
  const td = activePickerCell;
  const name = td.getAttribute('data-person');
  const day = parseInt(td.getAttribute('data-day'));
  const category = getCategoryForName(name);
  
  closeCellPicker();
  
  registerPendingChange(category, name, day, status, undefined);
  updateCellUI(td, name, day, category);
  updateUnsavedState();
}

async function applyCellPickerBrd(border) {
  if (!activePickerCell) return;
  const td = activePickerCell;
  const name = td.getAttribute('data-person');
  const day = parseInt(td.getAttribute('data-day'));
  const category = getCategoryForName(name);
  
  closeCellPicker();
  
  registerPendingChange(category, name, day, undefined, border);
  updateCellUI(td, name, day, category);
  updateUnsavedState();
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

async function openSettings() {
  populateDefaultUserSelector();
  const emailInp = document.getElementById('userEmailInp');
  if (emailInp) {
    emailInp.value = '';
    if (personalUser) {
      try {
        const res = await fetch(`/api/settings/email?doctor=${encodeURIComponent(personalUser)}`);
        if (res.ok) {
          const body = await res.json();
          emailInp.value = body.email || '';
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
  document.getElementById('settingsModal').classList.add('show');
}

async function saveSettings() {
  const selVal = document.getElementById('defaultUserSel').value;
  personalUser = selVal;
  localStorage.setItem('onco_default_user', selVal);
  
  const emailInp = document.getElementById('userEmailInp');
  if (emailInp && personalUser) {
    try {
      await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor: personalUser, email: emailInp.value.trim() })
      });
    } catch (e) {
      console.error(e);
    }
  }
  
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
  
  const exportIcsBtn = document.getElementById('exportIcsBtn');
  const requestBtn = document.getElementById('requestBtn');
  const copySyncUrlBtn = document.getElementById('copySyncUrlBtn');
  if (exportIcsBtn) exportIcsBtn.style.display = personalUser ? 'inline-block' : 'none';
  if (requestBtn) requestBtn.style.display = personalUser ? 'inline-block' : 'none';
  if (copySyncUrlBtn) copySyncUrlBtn.style.display = personalUser ? 'inline-block' : 'none';
  
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
    const holidays = window.getHolidays ? window.getHolidays(m.month, m.year) : {};
    const category = getCategoryForName(personalUser);
    
    let h = '';
    DOW.forEach(d => { h += `<div class="pcal-hdr">${d}</div>`; });
    for (let i = 0; i < m.startDow; i++) h += '<div class="pcal-d pcal-e"></div>';
    
    for (let d = 1; d <= m.totalDays; d++) {
      const pKey = `${category}_${personalUser}_${d}`;
      let cellVal = person.schedule[d] || { s: 'off', b: 'none' };
      const isPending = !!pendingChanges[pKey];
      if (isPending) {
        cellVal = {
          s: pendingChanges[pKey].status !== undefined ? pendingChanges[pKey].status : cellVal.s,
          b: pendingChanges[pKey].border !== undefined ? pendingChanges[pKey].border : cellVal.b
        };
      }
      
      const ci = cellInfo(cellVal);
      const isToday = isCurrentMonth && d === todayDay;
      const bstyle = ci.bcolor !== 'transparent' ? `box-shadow:inset 0 0 0 3px ${ci.bcolor};` : '';
      const todayStyle = isToday ? 'border: 2px dashed var(--accent);' : '';
      const pendingOutline = isPending ? 'outline: 2px dashed hsl(35, 100%, 50%); outline-offset: -2px;' : '';
      const dutyText = cellVal && cellVal.b !== 'none' ? BD[cellVal.b].label : '';
      
      const tc = ci.cls === 's-shabbat' ? 'color:#CFD8DC;' : '';
      const dayHols = holidays[d] || [];
      
      // Hebrew dates
      const dateObj = new Date(m.year, m.month, d);
      const hebDateFull = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
      const hebDayOnly = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(dateObj);
      
      const holidayHtml = dayHols.length > 0
        ? `<div class="pcal-holiday" title="${dayHols.join(', ')}">${dayHols[0]}</div>`
        : '';
        
      let inlineHandlers = '';
      if (isEditMode) {
        inlineHandlers = `oncontextmenu="personalCellRightClick(this, event, '${personalUser}', ${d})" onclick="personalCellClick(this, event, '${personalUser}', ${d})"`;
      }
      
      h += `
        <div class="pcal-d" data-person="${personalUser}" data-day="${d}" style="background:${ci.bg};${tc}${bstyle}${todayStyle}${pendingOutline}" ${inlineHandlers} title="${hebDateFull}">
          <div class="pn-row" style="display:flex; justify-content:space-between; align-items:center; width:100%; font-size:0.75em; color:var(--text-muted);">
            <span class="pn" style="font-size:1.45em; font-weight:700; color:var(--text-main);">${d}</span>
            <span class="pheb" style="font-weight:600;">${hebDayOnly}</span>
          </div>
          <div class="ps" style="margin-top:2px;">${ci.tip.split('|')[0].trim()}</div>
          ${dutyText ? `<div class="pd">${dutyText}</div>` : ''}
          ${holidayHtml}
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

// ═══ REQUEST SYSTEM CLIENT LOGIC ═══
function openRequestModal() {
  document.getElementById('reqDay').value = '';
  document.getElementById('reqDetails').value = '';
  document.getElementById('requestModal').classList.add('show');
}

async function submitRequest() {
  const type = document.getElementById('reqType').value;
  const dayVal = document.getElementById('reqDay').value.trim();
  const details = document.getElementById('reqDetails').value.trim();
  
  if (!personalUser) {
    alert("נא להגדיר משתמש אישי תחילה בהגדרות");
    return;
  }
  
  const payload = {
    doctor: personalUser,
    type,
    details,
    targetDay: dayVal ? parseInt(dayVal) : null,
    targetMonth: currentMK
  };
  
  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('requestModal');
      alert("הבקשה נשלחה בהצלחה למנהל!");
    } else {
      const err = await res.json();
      alert(`שגיאה בשליחת הבקשה: ${err.error}`);
    }
  } catch (e) {
    console.error("Error submitting request", e);
  }
}

async function loadAdminRequests() {
  const listEl = document.getElementById('adminRequestsList');
  if (!listEl) return; // Only run on admin screen
  
  try {
    const res = await fetch('/api/requests');
    if (!res.ok) throw new Error("Failed to fetch requests");
    const list = await res.json();
    
    // Sort requests by timestamp desc
    list.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (list.length === 0) {
      listEl.innerHTML = `<div class="no-requests-placeholder" style="color:var(--text-muted); font-size:0.9em; text-align:center; padding:20px; width:100%;">אין בקשות במערכת</div>`;
      return;
    }
    
    listEl.innerHTML = list.map(req => {
      const dateStr = new Date(req.timestamp).toLocaleString('he-IL', { hour12: false });
      const targetStr = req.targetDay ? `יום ${req.targetDay} ב-${monthLabel(req.targetMonth)}` : monthLabel(req.targetMonth);
      
      let statusHtml = '';
      if (req.status === 'pending') {
        statusHtml = `
          <div class="req-actions">
            <button class="btn-green" onclick="handleRequestAction('${req.id}', 'approved')">אישור ✓</button>
            <button class="btn-danger" onclick="handleRequestAction('${req.id}', 'rejected')">דחייה ✕</button>
          </div>
        `;
      } else if (req.status === 'approved') {
        statusHtml = `<div class="req-status-approved">אושר ✓</div>`;
      } else {
        statusHtml = `<div class="req-status-rejected">נדחה ✕</div>`;
      }
      
      return `
        <div class="request-card">
          <div class="req-header">
            <span class="req-doctor">${req.doctor}</span>
            <span class="req-type">${req.type}</span>
          </div>
          <div class="req-body">
            <div><strong>יעד:</strong> ${targetStr}</div>
            ${req.details ? `<div><strong>פרטים:</strong> ${req.details}</div>` : ''}
            <div style="font-size:0.75em; color:var(--text-muted); margin-top:4px;">${dateStr}</div>
          </div>
          ${statusHtml}
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error("Error loading admin requests", e);
  }
}

async function handleRequestAction(requestId, status) {
  try {
    const res = await fetch('/api/requests/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, status })
    });
    if (res.ok) {
      loadAdminRequests();
    } else {
      alert("שגיאה בעדכון הבקשה");
    }
  } catch (e) {
    console.error(e);
  }
}

// ═══ CALENDAR ICS EXPORT LOGIC ═══
function exportToICS() {
  if (!personalUser || !DATA) return;
  const person = findPersonInCache(personalUser);
  if (!person) {
    alert("המשתמש האישי אינו רשום בחודש זה");
    return;
  }
  
  const m = mi();
  const [mStr, yStr] = currentMK.split('-');
  const monthNum = parseInt(mStr) + 1; // 1-12
  const yearNum = parseInt(yStr);
  
  let icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hadassah Oncology//Roster Export//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  
  for (let d = 1; d <= m.totalDays; d++) {
    const cellVal = person.schedule[d];
    if (!cellVal) continue;
    
    // Only export work locations, or on-call duties
    const isWork = cellVal.s !== 'off' && cellVal.s !== 'weoff';
    const isDuty = cellVal.b !== 'none';
    
    if (isWork || isDuty) {
      // Event dates
      const yyyy = String(yearNum);
      const mm = String(monthNum).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStart = `${yyyy}${mm}${dd}`;
      
      // End date is day + 1 for all-day event
      const nextDate = new Date(yearNum, monthNum - 1, d + 1);
      const nyyyy = String(nextDate.getFullYear());
      const nmm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const ndd = String(nextDate.getDate()).padStart(2, '0');
      const dateEnd = `${nyyyy}${nmm}${ndd}`;
      
      const locLabel = ST[cellVal.s] ? ST[cellVal.s].label : cellVal.s;
      const dutyLabel = BD[cellVal.b] ? BD[cellVal.b].label : '';
      
      let summaryParts = [];
      if (isWork) summaryParts.push(`מיקום: ${locLabel}`);
      if (isDuty) summaryParts.push(dutyLabel);
      
      const summary = `תורנות אונקולוגיה - ${summaryParts.join(' | ')}`;
      const uid = `onco-sched-${currentMK}-${d}-${encodeURIComponent(personalUser)}@hadassah.org`;
      
      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:${uid}`);
      icsLines.push(`DTSTART;VALUE=DATE:${dateStart}`);
      icsLines.push(`DTEND;VALUE=DATE:${dateEnd}`);
      icsLines.push(`SUMMARY:${summary}`);
      icsLines.push(`DESCRIPTION:שיבוץ ליומן מחלקת אונקולוגיה הדסה עבור ${personalUser}\\nמיקום: ${locLabel}\\nתפקיד: ${dutyLabel || 'ללא'}`);
      icsLines.push('END:VEVENT');
    }
  }
  
  icsLines.push('END:VCALENDAR');
  
  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `schedule_${personalUser.replace(/\s+/g, '_')}_${currentMK}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ═══ BIRTHDAYS CLIENT LOGIC ═══
let originalBirthdays = {};
async function openBirthdaysModal() {
  const container = document.getElementById('birthdaysFormContainer');
  if (!container) return;
  
  container.innerHTML = '<div style="color:var(--text-muted);">טוען רשימת רופאים...</div>';
  document.getElementById('birthdaysModal').classList.add('show');
  
  try {
    // Fetch current birthdays
    const bRes = await fetch('/api/birthdays');
    if (!bRes.ok) throw new Error();
    originalBirthdays = await bRes.json();
    
    // Compile list of unique doctors from DATA
    const doctors = [];
    if (DATA) {
      ['seniors', 'resident'].forEach(cat => {
        (DATA[cat] || []).forEach(p => {
          if (!doctors.includes(p.name)) {
            doctors.push(p.name);
          }
        });
      });
    }
    
    doctors.sort();
    
    if (doctors.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);">אין רופאים רשומים בחודש זה.</div>';
      return;
    }
    
    container.innerHTML = doctors.map(name => {
      const bday = originalBirthdays[name] || '';
      return `
        <div class="form-group" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:5px;">
          <label style="flex:1; font-weight:600; margin-bottom:0;">${name}:</label>
          <input type="text" data-doctor="${name}" class="bday-input" value="${bday}" placeholder="DD/MM (למשל: 14/05)" style="width:180px;">
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div style="color:var(--text-danger);">שגיאה בטעינת נתוני ימי ההולדת</div>';
  }
}

async function saveBirthdays() {
  const inputs = document.querySelectorAll('.bday-input');
  let promises = [];
  
  inputs.forEach(inp => {
    const name = inp.getAttribute('data-doctor');
    const date = inp.value.trim();
    
    // Save only if value changed
    if (originalBirthdays[name] !== date) {
      promises.push(
        fetch('/api/birthdays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, date })
        })
      );
    }
  });
  
  try {
    await Promise.all(promises);
    closeModal('birthdaysModal');
    checkTodayBirthdays();
    alert("ימי ההולדת עודכנו בהצלחה!");
  } catch (e) {
    console.error(e);
    alert("שגיאה בשמירת ימי ההולדת");
  }
}

async function checkTodayBirthdays() {
  const bannerContainer = document.getElementById('birthdayBannerContainer');
  if (!bannerContainer) return;
  
  try {
    const res = await fetch('/api/birthdays');
    if (!res.ok) return;
    const birthdays = await res.json();
    
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const todayKeyNorm = `${d}/${m}`; // DD/MM format
    const todayKeyShort = `${today.getDate()}/${today.getMonth() + 1}`; // D/M format
    
    const birthdayNames = [];
    Object.entries(birthdays).forEach(([name, bday]) => {
      if (bday === todayKeyNorm || bday === todayKeyShort) {
        birthdayNames.push(name);
      }
    });
    
    if (birthdayNames.length > 0) {
      bannerContainer.innerHTML = `
        <div class="birthday-banner">
          <span>🎂 יום הולדת שמח ל<b>${birthdayNames.join(', ')}</b>! 🎈🎉</span>
          <button onclick="this.parentElement.remove()">סגור</button>
        </div>
      `;
    } else {
      bannerContainer.innerHTML = '';
    }
  } catch (e) {
    console.error("Error checking today's birthdays", e);
  }
}

// ═══ PENDING BATCH UPDATES AND EXTRA UTILITIES ═══

function registerPendingChange(category, name, day, status, border) {
  const pKey = `${category}_${name}_${day}`;
  const doc = DATA[category].find(x => x.name === name);
  const orig = doc && doc.schedule[day] ? doc.schedule[day] : { s: 'off', b: 'none' };
  
  if (!pendingChanges[pKey]) {
    pendingChanges[pKey] = { status: orig.s, border: orig.b };
  }
  if (status !== undefined) pendingChanges[pKey].status = status;
  if (border !== undefined) pendingChanges[pKey].border = border;
  
  // Clean up if reverts to original
  if (pendingChanges[pKey].status === orig.s && pendingChanges[pKey].border === orig.b) {
    delete pendingChanges[pKey];
  }
}

function updateCellUI(td, name, day, category) {
  const pKey = `${category}_${name}_${day}`;
  const doc = DATA[category].find(x => x.name === name);
  let cellVal = doc && doc.schedule[day] ? doc.schedule[day] : { s: 'off', b: 'none' };
  
  const isPending = !!pendingChanges[pKey];
  if (isPending) {
    cellVal = {
      s: pendingChanges[pKey].status !== undefined ? pendingChanges[pKey].status : cellVal.s,
      b: pendingChanges[pKey].border !== undefined ? pendingChanges[pKey].border : cellVal.b
    };
  }
  
  const ci = cellInfo(cellVal);
  const sInfo = ST[cellVal.s] || ST.off;
  const bInfo = BD[cellVal.b] || BD.none;
  
  const isTd = td.tagName.toLowerCase() === 'td';
  const ec = isEditMode ? ' editable' : '';
  const pendingCls = isPending ? ' pending-cell' : '';
  
  if (isTd) {
    td.className = `${ci.cls} ${ci.bcls}${ec}${pendingCls}`;
    
    let dotEl = td.querySelector('.duty-dot');
    if (bInfo.dcls) {
      if (!dotEl) {
        dotEl = document.createElement('span');
        td.prepend(dotEl);
      }
      dotEl.className = `duty-dot ${bInfo.dcls}`;
    } else if (dotEl) {
      dotEl.remove();
    }
    
    const contentEl = td.querySelector('.cell-content');
    if (contentEl) {
      contentEl.innerHTML = `${sInfo.sym}<div class="ttip">${name} | יום ${day}<br>${ci.tip}</div>`;
    }
  } else {
    // Personal calendar div box
    const isToday = todayDayStrIsToday(day);
    const bstyle = ci.bcolor !== 'transparent' ? `box-shadow:inset 0 0 0 3px ${ci.bcolor};` : '';
    const todayStyle = isToday ? 'border: 2px dashed var(--accent);' : '';
    const pendingOutline = isPending ? 'outline: 2px dashed hsl(35, 100%, 50%); outline-offset: -2px;' : '';
    
    td.style.cssText = `background:${ci.bg}; ${bstyle} ${todayStyle} ${pendingOutline}`;
    
    const psEl = td.querySelector('.ps');
    if (psEl) psEl.textContent = ci.tip.split('|')[0].trim();
    
    let pdEl = td.querySelector('.pd');
    const dutyText = cellVal.b !== 'none' ? BD[cellVal.b].label : '';
    if (dutyText) {
      if (!pdEl) {
        pdEl = document.createElement('div');
        pdEl.className = 'pd';
        psEl.after(pdEl);
      }
      pdEl.textContent = dutyText;
    } else if (pdEl) {
      pdEl.remove();
    }
  }
  
  updateStatsAndSummaries();
  updateDayHeaders();
}

function todayDayStrIsToday(d) {
  const m = mi();
  const today = new Date();
  return today.getMonth() === m.month && today.getFullYear() === m.year && d === today.getDate();
}

function updateUnsavedState() {
  const hasUnsaved = Object.keys(pendingChanges).length > 0;
  const warning = document.getElementById('unsavedWarning');
  const saveBtn = document.getElementById('saveChangesBtn');
  
  if (warning) warning.style.display = hasUnsaved ? 'inline-block' : 'none';
  if (saveBtn) saveBtn.style.display = hasUnsaved ? 'inline-block' : 'none';
}

async function saveBatchChanges() {
  const updates = [];
  for (const [key, change] of Object.entries(pendingChanges)) {
    const [category, name, day] = key.split('_');
    updates.push({
      category,
      name,
      day: parseInt(day),
      status: change.status,
      border: change.border
    });
  }
  
  if (updates.length === 0) return;
  
  try {
    const res = await fetch('/api/schedule/batch-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey: currentMK, updates })
    });
    
    if (res.ok) {
      pendingChanges = {};
      updateUnsavedState();
      await loadData();
      alert("השינויים נשמרו בהצלחה!");
    } else {
      const err = await res.json();
      alert(`שגיאה בשמירת השינויים: ${err.error}`);
    }
  } catch (e) {
    console.error(e);
    alert("שגיאה בתקשורת עם השרת");
  }
}

// ═══ STAFF SHORTAGE WARNING ALERTS ═══

function getDayShortages(d) {
  if (!DATA || !DATA.resident) return [];
  
  let counts = { ward: 0, radio: 0, daytreat: 0 };
  DATA.resident.forEach(p => {
    const pKey = `resident_${p.name}_${d}`;
    let s = p.schedule[d] ? p.schedule[d].s : 'off';
    if (pendingChanges[pKey] && pendingChanges[pKey].status !== undefined) {
      s = pendingChanges[pKey].status;
    }
    
    if (s === 'ward') counts.ward++;
    else if (s === 'radio') counts.radio++;
    else if (s === 'daytreat') counts.daytreat++;
  });
  
  const shortages = [];
  const th = adminSettings.thresholds || { ward: 3, radio: 1, daytreat: 1 };
  if (counts.ward < th.ward) {
    shortages.push(`מחלקה (${counts.ward}/${th.ward})`);
  }
  if (counts.radio < th.radio) {
    shortages.push(`רדיותרפיה (${counts.radio}/${th.radio})`);
  }
  if (counts.daytreat < th.daytreat) {
    shortages.push(`ט.יום (${counts.daytreat}/${th.daytreat})`);
  }
  return shortages;
}

function updateDayHeaders() {
  const m = mi();
  for (let d = 1; d <= m.totalDays; d++) {
    // Find the day header th. It's the (d + 1)-th th in the thead.
    const th = document.querySelector(`thead th:nth-child(${d + 1})`);
    if (!th) continue;
    
    const shortages = getDayShortages(d);
    let warningSpan = th.querySelector('.shortage-warning');
    if (shortages.length > 0) {
      if (!warningSpan) {
        warningSpan = document.createElement('span');
        warningSpan.className = 'shortage-warning';
        warningSpan.style.color = 'hsl(0, 85%, 60%)';
        warningSpan.style.cursor = 'help';
        warningSpan.style.marginRight = '4px';
        warningSpan.textContent = '⚠️';
        th.appendChild(warningSpan);
      }
      warningSpan.title = `חוסר במתמחים: ${shortages.join(', ')}`;
    } else if (warningSpan) {
      warningSpan.remove();
    }
  }
}

// ═══ ADMIN SECURITY & SETTINGS FUNCTIONS ═══

async function submitAdminAuth() {
  const passInp = document.getElementById('adminPasswordInput');
  const errMsg = document.getElementById('authErrorMsg');
  if (!passInp) return;
  
  const password = passInp.value;
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('onco_admin_auth', 'true');
      const overlay = document.getElementById('adminAuthOverlay');
      if (overlay) overlay.style.display = 'none';
      setEditMode(true);
      if (errMsg) errMsg.textContent = '';
      passInp.value = '';
    } else {
      if (errMsg) errMsg.textContent = data.error || "סיסמה שגויה";
    }
  } catch (e) {
    console.error(e);
    if (errMsg) errMsg.textContent = "שגיאת תקשורת עם השרת";
  }
}

async function openAdminSettingsModal() {
  try {
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const settings = await res.json();
      document.getElementById('adminNewPass').value = '';
      document.getElementById('threshWard').value = settings.thresholds.ward;
      document.getElementById('threshRadio').value = settings.thresholds.radio;
      document.getElementById('threshDaytreat').value = settings.thresholds.daytreat;
      document.getElementById('adminSettingsModal').classList.add('show');
    }
  } catch (e) {
    console.error(e);
    alert("שגיאה בטעינת הגדרות המנהל");
  }
}

async function saveAdminSettings() {
  const newPass = document.getElementById('adminNewPass').value.trim();
  const ward = parseInt(document.getElementById('threshWard').value);
  const radio = parseInt(document.getElementById('threshRadio').value);
  const daytreat = parseInt(document.getElementById('threshDaytreat').value);
  
  const payload = {
    thresholds: { ward, radio, daytreat }
  };
  if (newPass) {
    payload.adminPassword = newPass;
  }
  
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      adminSettings = (await res.json()).settings || adminSettings;
      closeModal('adminSettingsModal');
      render();
      alert("ההגדרות נשמרו בהצלחה!");
    } else {
      alert("שגיאה בשמירת ההגדרות");
    }
  } catch (e) {
    console.error(e);
    alert("שגיאה בתקשורת עם השרת");
  }
}

// ═══ GOOGLE/OUTLOOK LIVE CALENDAR SYNC URL ═══

function copySyncCalendarUrl() {
  if (!personalUser) {
    alert("נא לבחור רופא ברירת מחדל תחילה");
    return;
  }
  
  const protocol = window.location.protocol;
  const host = window.location.host;
  const url = `${protocol}//${host}/api/calendar/feed?doctor=${encodeURIComponent(personalUser)}`;
  
  navigator.clipboard.writeText(url).then(() => {
    alert(`קישור הסנכרון הועתק ללוח!\n\n${url}\n\nכיצד לסנכרן עם היומן שלך:\n1. ביומן Google / Outlook, לחץ על 'הוספת יומן' או 'הוסף יומן מכתובת URL'.\n2. הדבק את הקישור שהועתק.\n3. היומן יתעדכן אוטומטית בכל שינוי!`);
  }).catch(err => {
    console.error("Failed to copy URL", err);
    alert(`נכשלה העתקה אוטומטית. באפשרותך להעתיק את הכתובת הזו באופן ידני:\n\n${url}`);
  });
}
