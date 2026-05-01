// Morning Brief -Google Apps Script
// Paste this into script.google.com and set a daily trigger for 8am Pacific.
// Edit MORNING_BRIEF.md to change what sections appear.
// ------------------------------------------------------------------

function sendMorningBrief() {
  const RECIPIENT = "5419166227@vzwpix.com";
  const TZ = "America/Los_Angeles";

  // 1. DATE
  const today = new Date();
  const dateStr = Utilities.formatDate(today, TZ, "EEEE, MMMM d");

  // 2. WEATHER -Open-Meteo (free, no API key required)
  let weatherStr = "Weather unavailable.";
  try {
    const res = UrlFetchApp.fetch(
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=44.0521&longitude=-123.0868" +
      "&current_weather=true" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode" +
      "&temperature_unit=fahrenheit" +
      "&timezone=America%2FLos_Angeles" +
      "&forecast_days=1",
      { muteHttpExceptions: true, followRedirects: true, deadline: 25 }
    );
    const w = JSON.parse(res.getContentText());
    const temp  = Math.round(w.current_weather.temperature);
    const hi    = Math.round(w.daily.temperature_2m_max[0]);
    const lo    = Math.round(w.daily.temperature_2m_min[0]);
    const precip = w.daily.precipitation_probability_max[0];
    const cond  = wmoCondition(w.current_weather.weathercode);
    weatherStr  = temp + "F " + cond + ". High " + hi + " / Low " + lo + ".";
    if (precip > 30) weatherStr += " Rain " + precip + "%.";
  } catch (e) { Logger.log("Weather error: " + e.message); }

  // 3. SILVER -Yahoo Finance silver futures (SI=F), no API key required
  let silverStr = "Silver: unavailable";
  try {
    const res  = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=2d", { muteHttpExceptions: true, deadline: 25 });
    const data = JSON.parse(res.getContentText());
    const meta = data.chart.result[0].meta;
    const price = parseFloat(meta.regularMarketPrice);
    const prev  = parseFloat(meta.previousClose || price);
    const chg   = ((price - prev) / prev * 100).toFixed(1);
    const sign  = chg >= 0 ? "+" : "";
    silverStr   = "Silver: $" + price.toFixed(2) + " (" + sign + chg + "%)";
  } catch (e) { Logger.log("Silver error: " + e.message); }

  // 4. CRYPTO -Kraken public API (no key, no geo-restrictions)
  let ethStr = "ETH: unavailable";
  let solStr = "SOL: unavailable";
  try {
    const ethRes  = UrlFetchApp.fetch("https://api.kraken.com/0/public/Ticker?pair=ETHUSD", { muteHttpExceptions: true, deadline: 25 });
    const ethData = JSON.parse(ethRes.getContentText());
    const ethTick = ethData.result[Object.keys(ethData.result)[0]];
    const ethPrice = Math.round(parseFloat(ethTick.c[0]));
    const ethOpen  = parseFloat(ethTick.o);
    const ethChg   = (((ethPrice - ethOpen) / ethOpen) * 100).toFixed(1);
    ethStr = "ETH: $" + ethPrice.toLocaleString() + " (" + (ethChg >= 0 ? "+" : "") + ethChg + "%)";
  } catch (e) { Logger.log("ETH error: " + e.message); }
  try {
    const solRes  = UrlFetchApp.fetch("https://api.kraken.com/0/public/Ticker?pair=SOLUSD", { muteHttpExceptions: true, deadline: 25 });
    const solData = JSON.parse(solRes.getContentText());
    const solTick = solData.result[Object.keys(solData.result)[0]];
    const solPrice = parseFloat(solTick.c[0]).toFixed(2);
    const solOpen  = parseFloat(solTick.o);
    const solChg   = (((parseFloat(solTick.c[0]) - solOpen) / solOpen) * 100).toFixed(1);
    solStr = "SOL: $" + solPrice + " (" + (solChg >= 0 ? "+" : "") + solChg + "%)";
  } catch (e) { Logger.log("SOL error: " + e.message); }

  // 5. CALENDAR -today's events from owned calendars only
  const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(today); endOfDay.setHours(23, 59, 59, 999);
  const timedEvents = [];
  const allDayEvents = [];
  CalendarApp.getAllCalendars().filter(function(cal) {
    const n = cal.getName();
    return !n.match(/birthday|holiday|contact/i);
  }).forEach(function(cal) {
    cal.getEvents(startOfDay, endOfDay).forEach(function(e) {
      if (e.isAllDayEvent()) {
        allDayEvents.push(e.getTitle());
      } else {
        timedEvents.push({ time: e.getStartTime().getTime(), label: Utilities.formatDate(e.getStartTime(), TZ, "h:mma").toLowerCase() + " " + e.getTitle() });
      }
    });
  });
  timedEvents.sort(function(a, b) { return a.time - b.time; });
  const calLines = timedEvents.map(function(e) { return e.label; }).concat(allDayEvents);

  // 6. BUILD MESSAGE -kept compact for SMS character limits
  const parts = [
    getDailyQuote(today),
    "",
    dateStr,
    weatherStr,
    silverStr + " | " + ethStr + " | " + solStr,
  ];

  if (calLines.length > 0) {
    parts.push("");
    calLines.forEach(function(l) { parts.push(l); });
  }

  parts.push(
    "",
    "[ ] Breakfast",
    "[ ] Focus work",
    "[ ] HOK deals",
    "[ ] VX queue",
    "[ ] Hike"
  );

  // 7. SEND
  try {
    GmailApp.sendEmail(RECIPIENT, dateStr, parts.join("\n"));
    Logger.log("Sent to: " + RECIPIENT);
  } catch (e) {
    Logger.log("Send failed: " + e.message);
  }
}

// Rotates daily through Iaden's mental models, lessons, beliefs, and mission
function getDailyQuote(date) {
  const quotes = [
    // Mental Models
    "[Model] RKC: Every decision - does this grow Resources, Knowledge, or Connection? Best actions hit all three.",
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
    "[Model] Ikigai: Sustainable performance lives at the intersection of love, skill, need, and pay - not in any one alone.",
    // Lessons
    "[Lesson] The present is the only place peace lives. Depression is the past on loop. Anxiety is the future running ahead.",
    "[Lesson] Desire is a contract to be unhappy until you get what you want. Break the contract.",
    "[Lesson] Destination is never a place - it's a new way of seeing.",
    "[Lesson] Work in a state of mind that approaches prayer.",
    "[Lesson] A genius is the one most like himself.",
    "[Lesson] Slow is smooth. Smooth is fast.",
    "[Lesson] The quieter you become, the more you can hear.",
    "[Lesson] Speak your truth and see who sticks around. That's your tribe.",
    // Beliefs
    "[Belief] Systems beat willpower. A well-designed workflow outperforms discipline every time.",
    "[Belief] The inner life and the outer life are not in competition. Spiritual grounding is a performance advantage.",
    "[Belief] Balance between extremes is sophistication, not weakness.",
    "[Belief] Regret-minimization is the most honest decision-making anchor. Not what sounds good today.",
    "[Belief] Resources, Knowledge, Connection. Increase all three deliberately and simultaneously.",
    // Mission
    "[Mission] Self-actualize fully. HOK toward global locations. DEE toward a permanent creative ground. Build from first principles.",
    "[Mission] The long arc is multiplanetary and utopian. Built by people who understand reality deeply enough to shape it.",
    "[Mission] None of it at the expense of the inner life.",
  ];
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  return quotes[dayOfYear % quotes.length];
}

// WMO weather code → plain English condition
function wmoCondition(code) {
  if (code === 0)        return "clear";
  if (code <= 2)         return "mostly clear";
  if (code <= 3)         return "cloudy";
  if (code <= 49)        return "foggy";
  if (code <= 59)        return "drizzle";
  if (code <= 69)        return "rain";
  if (code <= 79)        return "snow";
  if (code <= 82)        return "showers";
  if (code <= 99)        return "stormy";
  return "cloudy";
}
