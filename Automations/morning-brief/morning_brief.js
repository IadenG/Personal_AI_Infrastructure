// Morning Brief — Google Apps Script
// Delivers a formatted daily briefing to Gmail at 8am Pacific.
// Run testBrief() manually to verify before relying on the trigger.
// ------------------------------------------------------------------

function sendMorningBrief() {
  const RECIPIENT = "iadengaines25@gmail.com";
  const TZ        = "America/Los_Angeles";

  // ── 1. DATE ────────────────────────────────────────────────────
  const today   = new Date();
  const dateStr = Utilities.formatDate(today, TZ, "EEEE, MMMM d");

  // ── 2. WEATHER ─────────────────────────────────────────────────
  let weather = null;
  try {
    const res = UrlFetchApp.fetch(
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=44.0521&longitude=-123.0868" +
      "&current_weather=true" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode" +
      "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=1",
      { muteHttpExceptions: true, followRedirects: true, deadline: 25 }
    );
    const w = JSON.parse(res.getContentText());
    weather = {
      temp:   Math.round(w.current_weather.temperature),
      hi:     Math.round(w.daily.temperature_2m_max[0]),
      lo:     Math.round(w.daily.temperature_2m_min[0]),
      precip: w.daily.precipitation_probability_max[0],
      cond:   wmoCondition(w.current_weather.weathercode)
    };
  } catch (e) { Logger.log("Weather error: " + e.message); }

  // ── 3. SILVER ──────────────────────────────────────────────────
  let silver = null;
  try {
    const res   = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=2d", { muteHttpExceptions: true, deadline: 25 });
    const meta  = JSON.parse(res.getContentText()).chart.result[0].meta;
    const price = parseFloat(meta.regularMarketPrice);
    const prev  = parseFloat(meta.previousClose || price);
    silver = { price: price, chg: (price - prev) / prev * 100 };
  } catch (e) { Logger.log("Silver error: " + e.message); }

  // ── 4. CRYPTO ──────────────────────────────────────────────────
  let eth = null, sol = null;
  try {
    const res  = UrlFetchApp.fetch("https://api.kraken.com/0/public/Ticker?pair=ETHUSD", { muteHttpExceptions: true, deadline: 25 });
    const data = JSON.parse(res.getContentText());
    const tick = data.result[Object.keys(data.result)[0]];
    const price = Math.round(parseFloat(tick.c[0]));
    eth = { price: price, chg: (price - parseFloat(tick.o)) / parseFloat(tick.o) * 100 };
  } catch (e) { Logger.log("ETH error: " + e.message); }
  try {
    const res  = UrlFetchApp.fetch("https://api.kraken.com/0/public/Ticker?pair=SOLUSD", { muteHttpExceptions: true, deadline: 25 });
    const data = JSON.parse(res.getContentText());
    const tick = data.result[Object.keys(data.result)[0]];
    const price = parseFloat(tick.c[0]);
    sol = { price: price, chg: (price - parseFloat(tick.o)) / parseFloat(tick.o) * 100 };
  } catch (e) { Logger.log("SOL error: " + e.message); }

  // ── 5. CALENDAR ────────────────────────────────────────────────
  const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(today); endOfDay.setHours(23, 59, 59, 999);
  const timedEvents = [], allDayEvents = [];
  CalendarApp.getAllCalendars()
    .filter(function(cal) { return !cal.getName().match(/birthday|holiday|contact/i); })
    .forEach(function(cal) {
      cal.getEvents(startOfDay, endOfDay).forEach(function(ev) {
        if (ev.isAllDayEvent()) {
          allDayEvents.push(ev.getTitle());
        } else {
          timedEvents.push({
            time:  ev.getStartTime().getTime(),
            label: Utilities.formatDate(ev.getStartTime(), TZ, "h:mma").toLowerCase(),
            title: ev.getTitle()
          });
        }
      });
    });
  timedEvents.sort(function(a, b) { return a.time - b.time; });

  // ── 6. BUILD AND SEND ──────────────────────────────────────────
  const quote = getDailyQuote(today);
  const html  = buildHtml(quote, dateStr, weather, silver, eth, sol, timedEvents, allDayEvents);
  const plain = buildPlainText(quote, dateStr, weather, silver, eth, sol, timedEvents, allDayEvents);

  try {
    GmailApp.sendEmail(RECIPIENT, "Morning Brief — " + dateStr, plain, { htmlBody: html });
    Logger.log("Sent to: " + RECIPIENT);
  } catch (e) {
    Logger.log("Send failed: " + e.message);
  }
}

// ── HTML BRIEF ─────────────────────────────────────────────────────
function buildHtml(quote, dateStr, weather, silver, eth, sol, timedEvents, allDayEvents) {

  function mktRow(label, asset, decimals) {
    if (!asset) return '';
    const up       = asset.chg >= 0;
    const color    = up ? "#15803d" : "#dc2626";
    const priceStr = decimals > 0 ? "$" + asset.price.toFixed(decimals) : "$" + Math.round(asset.price).toLocaleString();
    return '<tr>' +
      '<td style="padding:10px 0 10px;color:#111;font-size:14px;font-weight:600;border-bottom:1px solid #f3f3f3;">' + label + '</td>' +
      '<td style="padding:10px 0;color:#555;font-size:14px;font-family:monospace;text-align:right;border-bottom:1px solid #f3f3f3;">' + priceStr + '</td>' +
      '<td style="padding:10px 12px;font-size:13px;text-align:right;color:' + color + ';font-weight:700;border-bottom:1px solid #f3f3f3;">' +
        (up ? "+" : "") + asset.chg.toFixed(1) + "%" +
      '</td>' +
    '</tr>';
  }

  // Parse quote type tag vs body
  const m         = quote.match(/^\[(\w+)\]\s(.+)$/);
  const quoteType = m ? m[1].toUpperCase() : "";
  const quoteText = m ? m[2] : quote;

  // Weather card content
  let weatherHtml = '<p style="color:#999;font-size:14px;margin:0;">Unavailable</p>';
  if (weather) {
    const cap      = weather.cond.charAt(0).toUpperCase() + weather.cond.slice(1);
    const rainLine = weather.precip > 30
      ? '<div style="margin-top:10px;font-size:13px;color:#2563eb;font-weight:600;">Rain ' + weather.precip + '% &mdash; bring a jacket</div>'
      : '';
    weatherHtml =
      '<div style="font-size:44px;font-weight:800;color:#111;line-height:1;letter-spacing:-2px;">' +
        weather.temp + '<span style="font-size:22px;font-weight:500;color:#888;">&deg;F</span>' +
      '</div>' +
      '<div style="font-size:14px;color:#555;margin-top:8px;">' + cap + '</div>' +
      '<div style="font-size:13px;color:#aaa;margin-top:3px;">High ' + weather.hi + '&deg; &nbsp;&middot;&nbsp; Low ' + weather.lo + '&deg;</div>' +
      rainLine;
  }

  // Schedule card content
  let schedHtml = '<p style="color:#bbb;font-size:14px;margin:0;font-style:italic;">No events &mdash; open field.</p>';
  if (timedEvents.length > 0 || allDayEvents.length > 0) {
    schedHtml = '';
    timedEvents.forEach(function(e) {
      schedHtml +=
        '<div style="display:flex;align-items:baseline;gap:16px;padding:9px 0;border-bottom:1px solid #f5f5f5;">' +
          '<span style="color:#bbb;font-size:12px;min-width:50px;font-family:monospace;">' + e.label + '</span>' +
          '<span style="color:#111;font-size:14px;">' + e.title + '</span>' +
        '</div>';
    });
    allDayEvents.forEach(function(t) {
      schedHtml +=
        '<div style="padding:9px 0;border-bottom:1px solid #f5f5f5;color:#777;font-size:14px;font-style:italic;">' + t + ' &mdash; all day</div>';
    });
  }

  // Ritual checklist
  const ritual   = ["Breakfast", "Focus work", "HOK deals", "VX queue", "Hike"];
  const ritualHtml = ritual.map(function(item) {
    return '<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #f5f5f5;">' +
      '<div style="width:18px;height:18px;border:2px solid #ddd;border-radius:4px;flex-shrink:0;"></div>' +
      '<span style="color:#111;font-size:14px;">' + item + '</span>' +
    '</div>';
  }).join("");

  return '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
  '<body style="margin:0;padding:0;background:#eeede7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,sans-serif;">' +
  '<div style="max-width:600px;margin:0 auto;padding:28px 16px 48px;">' +

    // QUOTE
    '<div style="background:#111;border-radius:12px;padding:26px 28px;margin-bottom:20px;">' +
      '<div style="font-size:10px;letter-spacing:3px;color:#444;text-transform:uppercase;margin-bottom:12px;">' + quoteType + '</div>' +
      '<div style="font-size:15px;color:#e5e5e5;line-height:1.7;">' + quoteText + '</div>' +
    '</div>' +

    // HEADER
    '<div style="padding:6px 4px 22px;">' +
      '<div style="font-size:10px;letter-spacing:3px;color:#aaa;text-transform:uppercase;">Morning Brief</div>' +
      '<div style="font-size:30px;font-weight:800;color:#111;margin-top:5px;letter-spacing:-0.5px;">' + dateStr + '</div>' +
    '</div>' +

    // WEATHER + MARKETS row
    '<div style="display:flex;gap:14px;margin-bottom:14px;">' +

      '<div style="flex:1;background:#fff;border-radius:12px;padding:22px;min-width:0;">' +
        '<div style="font-size:10px;letter-spacing:2px;color:#bbb;text-transform:uppercase;margin-bottom:16px;">Weather &nbsp;&middot;&nbsp; Eugene</div>' +
        weatherHtml +
      '</div>' +

      '<div style="flex:1;background:#fff;border-radius:12px;padding:22px;min-width:0;">' +
        '<div style="font-size:10px;letter-spacing:2px;color:#bbb;text-transform:uppercase;margin-bottom:8px;">Markets</div>' +
        '<table style="width:100%;border-collapse:collapse;">' +
          mktRow("Silver", silver, 2) +
          mktRow("ETH",    eth,    0) +
          mktRow("SOL",    sol,    2) +
        '</table>' +
      '</div>' +

    '</div>' +

    // SCHEDULE
    '<div style="background:#fff;border-radius:12px;padding:22px;margin-bottom:14px;">' +
      '<div style="font-size:10px;letter-spacing:2px;color:#bbb;text-transform:uppercase;margin-bottom:12px;">Schedule</div>' +
      schedHtml +
    '</div>' +

    // RITUAL
    '<div style="background:#fff;border-radius:12px;padding:22px;">' +
      '<div style="font-size:10px;letter-spacing:2px;color:#bbb;text-transform:uppercase;margin-bottom:8px;">Today\'s Ritual</div>' +
      ritualHtml +
    '</div>' +

    // FOOTER
    '<div style="text-align:center;padding:28px 0 0;font-size:11px;color:#bbb;letter-spacing:1px;">' +
      'EUGENE, OR &nbsp;&middot;&nbsp; ' + dateStr.toUpperCase() +
    '</div>' +

  '</div></body></html>';
}

// ── PLAIN TEXT FALLBACK (shown if HTML fails to render) ────────────
function buildPlainText(quote, dateStr, weather, silver, eth, sol, timedEvents, allDayEvents) {
  const lines = [quote, "", dateStr];

  if (weather) {
    lines.push(weather.temp + "F " + weather.cond + ". High " + weather.hi + " / Low " + weather.lo + ".");
    if (weather.precip > 30) lines.push("Rain " + weather.precip + "% — bring a jacket.");
  } else {
    lines.push("Weather unavailable.");
  }

  function fmt(label, asset, dec) {
    if (!asset) return label + ": unavailable";
    const sign = asset.chg >= 0 ? "+" : "";
    const p    = dec > 0 ? asset.price.toFixed(dec) : Math.round(asset.price).toLocaleString();
    return label + ": $" + p + " (" + sign + asset.chg.toFixed(1) + "%)";
  }
  lines.push(fmt("Silver", silver, 2) + " | " + fmt("ETH", eth, 0) + " | " + fmt("SOL", sol, 2));

  if (timedEvents.length > 0 || allDayEvents.length > 0) {
    lines.push("");
    timedEvents.forEach(function(e) { lines.push(e.label + " " + e.title); });
    allDayEvents.forEach(function(t) { lines.push(t + " (all day)"); });
  }

  lines.push("", "[ ] Breakfast", "[ ] Focus work", "[ ] HOK deals", "[ ] VX queue", "[ ] Hike");
  return lines.join("\n");
}

// ── QUOTES ─────────────────────────────────────────────────────────
function getDailyQuote(date) {
  const quotes = [
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
    "[Lesson] The present is the only place peace lives. Depression is the past on loop. Anxiety is the future running ahead.",
    "[Lesson] Desire is a contract to be unhappy until you get what you want. Break the contract.",
    "[Lesson] Destination is never a place - it's a new way of seeing.",
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
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  return quotes[dayOfYear % quotes.length];
}

// ── TEST ────────────────────────────────────────────────────────────
function testBrief() {
  sendMorningBrief();
  Logger.log("testBrief() complete — check Gmail.");
}

// ── HELPERS ─────────────────────────────────────────────────────────
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
