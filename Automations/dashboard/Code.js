// Mothership Dashboard — Server-side (Google Apps Script)
// Paste into a NEW Apps Script project at script.google.com
// Then add Dashboard.html as an HTML file in the same project.
// See README.md for full setup steps.
// ------------------------------------------------------------------

// ── CONFIG — edit here, nowhere else ──────────────────────────────
var CONFIG = {
  // Your location (find coordinates at maps.google.com — right-click any spot)
  lat:      44.0521,
  lon:     -123.0868,
  city:    "Eugene, OR",
  timezone: "America/Los_Angeles",

  // How often the dashboard silently refreshes (in minutes)
  refreshMinutes: 5,

  // Markets to show — Kraken pair names: https://kraken.com/features/api
  // Silver uses Yahoo Finance (SI=F) — always included
  cryptoPairs: ["ETHUSD", "SOLUSD"],

  // HOK deal statuses — must match exactly what you type in the Sheet
  hokStatuses: ["pipeline", "in system", "sold", "shipped"]
};
// ------------------------------------------------------------------

// ── ENTRY POINT ────────────────────────────────────────────────────
// Google calls this when someone opens the web app URL.
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Mothership')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── MAIN DATA FETCH ────────────────────────────────────────────────
// The dashboard calls this on load and every CONFIG.refreshMinutes.
function getData() {
  return {
    weather:        getWeather(),
    markets:        getMarkets(),
    calendar:       getCalendarEvents(),
    quote:          getDailyQuote(new Date()),
    hok:            getHOK(),
    dailyTasks:     getDailyTasks(),
    rollingTasks:   getRollingTasks(),
    school:         getSchoolAssignments(),
    vx:             getVXQueue(),
    refreshMinutes: CONFIG.refreshMinutes,
    city:           CONFIG.city
  };
}

// ── WEATHER ─────────────────────────────────────────────────────────
function getWeather() {
  try {
    const res = UrlFetchApp.fetch(
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + CONFIG.lat + "&longitude=" + CONFIG.lon +
      "&current_weather=true" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode" +
      "&temperature_unit=fahrenheit&timezone=" + encodeURIComponent(CONFIG.timezone) + "&forecast_days=1",
      { muteHttpExceptions: true, deadline: 25 }
    );
    const w = JSON.parse(res.getContentText());
    return {
      temp:   Math.round(w.current_weather.temperature),
      hi:     Math.round(w.daily.temperature_2m_max[0]),
      lo:     Math.round(w.daily.temperature_2m_min[0]),
      precip: w.daily.precipitation_probability_max[0],
      cond:   wmoCondition(w.current_weather.weathercode)
    };
  } catch(e) { Logger.log("Weather: " + e.message); return null; }
}

// ── MARKETS ─────────────────────────────────────────────────────────
// Silver is always fetched. Crypto pairs come from CONFIG.cryptoPairs.
// To add BTC: add "XBTUSD" to CONFIG.cryptoPairs — no other changes needed.
function getMarkets() {
  const out = {};

  // Silver — Yahoo Finance
  try {
    const res  = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=2d", { muteHttpExceptions: true, deadline: 25 });
    const meta = JSON.parse(res.getContentText()).chart.result[0].meta;
    const p = parseFloat(meta.regularMarketPrice), prev = parseFloat(meta.previousClose || p);
    out.silver = { label: "Silver", price: p, chg: (p - prev) / prev * 100, decimals: 2 };
  } catch(e) {}

  // Crypto — Kraken, one fetch per pair in CONFIG.cryptoPairs
  CONFIG.cryptoPairs.forEach(function(pair) {
    try {
      const res  = UrlFetchApp.fetch("https://api.kraken.com/0/public/Ticker?pair=" + pair, { muteHttpExceptions: true, deadline: 25 });
      const data = JSON.parse(res.getContentText()).result;
      const t    = data[Object.keys(data)[0]];
      const p    = parseFloat(t.c[0]), o = parseFloat(t.o);
      const key  = pair.replace("USD","").replace("XBT","BTC").toLowerCase();
      out[key]   = { label: key.toUpperCase(), price: p, chg: (p - o) / o * 100, decimals: 2 };
    } catch(e) {}
  });

  return out;
}

// ── CALENDAR (14 days) ──────────────────────────────────────────────
function getCalendarEvents() {
  const TZ    = "America/Los_Angeles";
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(start); end.setDate(end.getDate() + 14);
  const events = [];

  CalendarApp.getAllCalendars()
    .filter(function(cal) { return !cal.getName().match(/birthday|holiday|contact/i); })
    .forEach(function(cal) {
      cal.getEvents(start, end).forEach(function(ev) {
        events.push({
          title:  ev.getTitle(),
          date:   Utilities.formatDate(ev.getStartTime(), TZ, "yyyy-MM-dd"),
          time:   ev.isAllDayEvent() ? null : Utilities.formatDate(ev.getStartTime(), TZ, "h:mma").toLowerCase(),
          allDay: ev.isAllDayEvent()
        });
      });
    });

  events.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  return events;
}

// ── HOK ─────────────────────────────────────────────────────────────
// Reads the "HOK" tab. Each row: Deal ID | Status | Date | Notes
// Valid statuses: pipeline, in system, sold, shipped
function getHOK() {
  try {
    const sheet = getSheet().getSheetByName("HOK");
    if (!sheet) return emptyHOK();
    const rows   = sheet.getDataRange().getValues().slice(1);
    const counts = { total: 0, pipeline: 0, inSystem: 0, sold: 0, shipped: 0 };
    rows.forEach(function(row) {
      const status = (row[1] || "").toString().toLowerCase().trim();
      if (!status || status.indexOf("valid") >= 0) return;
      counts.total++;
      if      (status === "pipeline")  counts.pipeline++;
      else if (status === "in system") counts.inSystem++;
      else if (status === "sold")      counts.sold++;
      else if (status === "shipped")   counts.shipped++;
    });
    return counts;
  } catch(e) { Logger.log("HOK: " + e.message); return emptyHOK(); }
}
function emptyHOK() { return { total: 0, pipeline: 0, inSystem: 0, sold: 0, shipped: 0 }; }

// ── DAILY TASKS ─────────────────────────────────────────────────────
// "Done" = CompletedDate matches today. Auto-resets each new day.
function getDailyTasks() {
  try {
    const sheet = getSheet().getSheetByName("Daily Tasks");
    const today = Utilities.formatDate(new Date(), "America/Los_Angeles", "yyyy-MM-dd");
    return sheet.getDataRange().getValues().slice(1)
      .filter(function(r) { return r[0]; })
      .map(function(r, i) {
        const cd = r[2] ? Utilities.formatDate(new Date(r[2]), "America/Los_Angeles", "yyyy-MM-dd") : "";
        return { id: i + 2, name: r[0], category: r[1] || "", done: cd === today };
      });
  } catch(e) { Logger.log("Daily tasks: " + e.message); return []; }
}

function markDailyTask(rowId, done) {
  try {
    getSheet().getSheetByName("Daily Tasks").getRange(rowId, 3).setValue(done ? new Date() : "");
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── ROLLING TASKS ────────────────────────────────────────────────────
// Only shows incomplete tasks. Carry over until explicitly marked done.
function getRollingTasks() {
  try {
    const sheet = getSheet().getSheetByName("Rolling Tasks");
    const TZ    = "America/Los_Angeles";
    return sheet.getDataRange().getValues().slice(1)
      .filter(function(r) { return r[0] && r[3] !== true && r[3] !== "TRUE"; })
      .map(function(r, i) {
        return {
          id:       i + 2,
          name:     r[0],
          category: r[1] || "",
          dueDate:  r[2] ? Utilities.formatDate(new Date(r[2]), TZ, "yyyy-MM-dd") : ""
        };
      });
  } catch(e) { Logger.log("Rolling tasks: " + e.message); return []; }
}

function markRollingTask(rowId) {
  try {
    const sheet = getSheet().getSheetByName("Rolling Tasks");
    sheet.getRange(rowId, 4).setValue(true);
    sheet.getRange(rowId, 5).setValue(new Date());
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function addRollingTask(name, category, dueDateStr) {
  try {
    getSheet().getSheetByName("Rolling Tasks")
      .appendRow([name, category, dueDateStr ? new Date(dueDateStr) : "", false, "", new Date()]);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── SCHOOL ───────────────────────────────────────────────────────────
// Sheet tab: "School" — columns: Assignment | Course | Due Date | Priority | Done | CompletedDate | Created
// Priority values: high, normal (default)
// At start of each term, paste assignments from syllabus directly into this tab.
// Future: Canvas API will populate this automatically.
function getSchoolAssignments() {
  try {
    const sheet = getSheet().getSheetByName("School");
    const TZ    = CONFIG.timezone;
    return sheet.getDataRange().getValues().slice(1)
      .filter(function(r) { return r[0] && r[4] !== true && r[4] !== "TRUE"; })
      .map(function(r, i) {
        return {
          id:       i + 2,
          name:     r[0],
          course:   r[1] || "",
          dueDate:  r[2] ? Utilities.formatDate(new Date(r[2]), TZ, "yyyy-MM-dd") : "",
          priority: r[3] || "normal"
        };
      })
      .sort(function(a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
  } catch(e) { Logger.log("School: " + e.message); return []; }
}

function markSchoolDone(rowId) {
  try {
    const sheet = getSheet().getSheetByName("School");
    sheet.getRange(rowId, 5).setValue(true);
    sheet.getRange(rowId, 6).setValue(new Date());
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function addSchoolAssignment(name, course, dueDateStr, priority) {
  try {
    getSheet().getSheetByName("School")
      .appendRow([name, course, dueDateStr ? new Date(dueDateStr) : "", priority || "normal", false, "", new Date()]);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── VX QUEUE ─────────────────────────────────────────────────────────
// Sheet tab: "VX Queue" — columns: Title | Week | Stage | Notes | Created
// Stages in order: shot → editing → done → posted → (archived, hidden from dashboard)
// Target: 4 videos posted per week. Click stage badge to advance.
var VX_STAGES = ["shot", "editing", "done", "posted"];

function getVXQueue() {
  try {
    const sheet = getSheet().getSheetByName("VX Queue");
    return sheet.getDataRange().getValues().slice(1)
      .filter(function(r) { return r[0] && r[2] !== "archived"; })
      .map(function(r, i) {
        return {
          id:    i + 2,
          title: r[0],
          week:  r[1] || "",
          stage: r[2] || "shot",
          notes: r[3] || ""
        };
      });
  } catch(e) { Logger.log("VX: " + e.message); return []; }
}

function advanceVXStage(rowId) {
  try {
    const sheet   = getSheet().getSheetByName("VX Queue");
    const current = sheet.getRange(rowId, 3).getValue() || "shot";
    const idx     = VX_STAGES.indexOf(current);
    const next    = (idx >= 0 && idx < VX_STAGES.length - 1) ? VX_STAGES[idx + 1] : "archived";
    sheet.getRange(rowId, 3).setValue(next);
    return { ok: true, newStage: next };
  } catch(e) { return { ok: false, error: e.message }; }
}

function addVXVideo(title, week) {
  try {
    getSheet().getSheetByName("VX Queue")
      .appendRow([title, week || "", "shot", "", new Date()]);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── SHEET HELPER ─────────────────────────────────────────────────────
function getSheet() {
  const url = PropertiesService.getScriptProperties().getProperty("SHEET_URL");
  if (!url) throw new Error("SHEET_URL not set. See README — run setSheetUrl('your_url') once.");
  return SpreadsheetApp.openByUrl(url);
}

// Run this once to save your Google Sheet URL.
function setSheetUrl(url) {
  PropertiesService.getScriptProperties().setProperty("SHEET_URL", url);
  Logger.log("Saved.");
}

// Run this once after setSheetUrl() to create all tabs and seed default data.
// Safe to run again — only creates tabs that don't already exist.
function initSheet() {
  const ss = getSheet();

  var dt = ss.getSheetByName("Daily Tasks") || ss.insertSheet("Daily Tasks");
  if (dt.getLastRow() === 0) {
    dt.appendRow(["Name", "Category", "CompletedDate"]);
    [["Morning routine","Daily"], ["Hike","Daily"], ["Yoga","Daily"], ["Presence practice","Evening"]]
      .forEach(function(r) { dt.appendRow(r); });
  }

  var rt = ss.getSheetByName("Rolling Tasks") || ss.insertSheet("Rolling Tasks");
  if (rt.getLastRow() === 0) {
    rt.appendRow(["Name", "Category", "DueDate", "Done", "CompletedDate", "CreatedDate"]);
  }

  var hok = ss.getSheetByName("HOK") || ss.insertSheet("HOK");
  if (hok.getLastRow() === 0) {
    hok.appendRow(["Deal ID", "Status", "Date", "Notes"]);
    hok.appendRow(["", "Valid statuses: pipeline | in system | sold | shipped", "", ""]);
  }

  var sc = ss.getSheetByName("School") || ss.insertSheet("School");
  if (sc.getLastRow() === 0) {
    sc.appendRow(["Assignment Name", "Course", "Due Date", "Priority", "Done", "CompletedDate", "Created"]);
    sc.appendRow(["", "Priority values: high | normal", "", "", "", "", ""]);
  }

  var vx = ss.getSheetByName("VX Queue") || ss.insertSheet("VX Queue");
  if (vx.getLastRow() === 0) {
    vx.appendRow(["Title", "Week", "Stage", "Notes", "Created"]);
    vx.appendRow(["", "Week format: 2026-W19", "Stages: shot | editing | done | posted | archived", "", ""]);
  }

  Logger.log("Sheet initialized. All 5 tabs ready: Daily Tasks, Rolling Tasks, HOK, School, VX Queue.");
}

// ── QUOTES ───────────────────────────────────────────────────────────
function getDailyQuote(date) {
  const quotes = [
    "[Model] RKC: Every decision — does this grow Resources, Knowledge, or Connection? Best actions hit all three.",
    "[Model] Regret Min: Simulate yourself at 80. Which choice produces regret? Make the other one.",
    "[Model] First Principles: Strip to physical constraints before accepting what's 'possible.' Most limits are inherited assumptions.",
    "[Model] Antifragility: Fragile breaks under stress. Robust survives it. Antifragile gains from it. Build the third kind.",
    "[Model] Barbell: Avoid the middle. Extremely safe + small high-upside bets. Eliminate moderate risk, moderate reward.",
    "[Model] Via Negativa: Remove the harmful before adding the beneficial. What should you eliminate today?",
    "[Model] Pain + Reflection = Progress. Convert every painful experience into a specific lesson.",
    "[Model] Circle of Competence: Know precisely what you know and what you don't. Operating inside it is the edge.",
    "[Model] Elon's Algorithm: Question. Delete. Simplify. Accelerate. Automate. In that order. Never skip steps.",
    "[Model] Skin in the Game: Only trust advice from people who bear the consequences of being wrong.",
    "[Model] Lindy Effect: Prefer old ideas that still work over new ideas that haven't been tested.",
    "[Model] The Long Arc: Every meaningful thing was built slowly. The long arc is the point, not the obstacle.",
    "[Model] Far-Outcome Path: Before deciding, simulate realistic far outcomes. What path does this put you on?",
    "[Model] Black Swan: Fat tails exist. Low-probability, high-impact events are systematically underweighted. Build for resilience.",
    "[Model] Ikigai: Sustainable performance lives at the intersection of love, skill, need, and pay — not in any one alone.",
    "[Lesson] The present is the only place peace lives. Depression is the past on loop. Anxiety is the future running ahead.",
    "[Lesson] Desire is a contract to be unhappy until you get what you want. Break the contract.",
    "[Lesson] Destination is never a place — it's a new way of seeing.",
    "[Lesson] Work in a state of mind that approaches prayer.",
    "[Lesson] A genius is the one most like himself.",
    "[Lesson] Slow is smooth. Smooth is fast.",
    "[Lesson] The quieter you become, the more you can hear.",
    "[Lesson] Speak your truth and see who sticks around. That's your tribe.",
    "[Belief] Systems beat willpower. A well-designed workflow outperforms discipline every time.",
    "[Belief] The inner life and the outer life are not in competition. Spiritual grounding is a performance advantage.",
    "[Belief] Balance between extremes is sophistication, not weakness.",
    "[Belief] Regret-minimization is the most honest decision-making anchor. Not what sounds good today.",
    "[Belief] Resources, Knowledge, Connection. Increase all three deliberately and simultaneously.",
    "[Mission] Self-actualize fully. HOK toward global locations. DEE toward a permanent creative ground. Build from first principles.",
    "[Mission] The long arc is multiplanetary and utopian. Built by people who understand reality deeply enough to shape it.",
    "[Mission] None of it at the expense of the inner life.",
  ];
  const d = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  return quotes[d % quotes.length];
}

// ── HELPERS ──────────────────────────────────────────────────────────
function wmoCondition(code) {
  if (code === 0)  return "clear";
  if (code <= 2)   return "mostly clear";
  if (code <= 3)   return "cloudy";
  if (code <= 49)  return "foggy";
  if (code <= 59)  return "drizzle";
  if (code <= 69)  return "rain";
  if (code <= 79)  return "snow";
  if (code <= 82)  return "showers";
  if (code <= 99)  return "stormy";
  return "cloudy";
}
