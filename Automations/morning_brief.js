// Morning Brief — Google Apps Script
// Paste this into script.google.com and set a daily trigger for 8am Pacific.
// Edit MORNING_BRIEF.md to change what sections appear.
// ------------------------------------------------------------------

function sendMorningBrief() {
  const RECIPIENT = "5419166627@vtext.com";
  const TZ = "America/Los_Angeles";
  const props = PropertiesService.getScriptProperties();

  // 1. DATE
  const today = new Date();
  const dateStr = Utilities.formatDate(today, TZ, "EEEE, MMMM d");

  // 2. WEATHER — Open-Meteo (free, no API key required)
  let weatherStr = "Weather unavailable.";
  try {
    const res = UrlFetchApp.fetch(
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=44.0521&longitude=-123.0868" +
      "&current_weather=true" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode" +
      "&temperature_unit=fahrenheit" +
      "&timezone=America%2FLos_Angeles" +
      "&forecast_days=1"
    );
    const w = JSON.parse(res.getContentText());
    const temp  = Math.round(w.current_weather.temperature);
    const hi    = Math.round(w.daily.temperature_2m_max[0]);
    const lo    = Math.round(w.daily.temperature_2m_min[0]);
    const precip = w.daily.precipitation_probability_max[0];
    const cond  = wmoCondition(w.current_weather.weathercode);
    weatherStr  = temp + "F " + cond + ". High " + hi + " / Low " + lo + ".";
    if (precip > 30) weatherStr += " Rain " + precip + "%.";
  } catch (e) {}

  // 3. SILVER — metals.live (free, no API key required)
  // Stores yesterday's price to calculate overnight % change
  let silverStr = "Silver: unavailable";
  try {
    const res   = UrlFetchApp.fetch("https://api.metals.live/v1/spot/silver");
    const data  = JSON.parse(res.getContentText());
    const price = parseFloat(data[0].silver);
    const prev  = parseFloat(props.getProperty("silverPrev") || price);
    const chg   = ((price - prev) / prev * 100).toFixed(1);
    const sign  = chg >= 0 ? "+" : "";
    silverStr   = "Silver: $" + price.toFixed(2) + " (" + sign + chg + "%)";
    props.setProperty("silverPrev", price.toString());
  } catch (e) {}

  // 4. CRYPTO — CoinGecko (free, no API key required)
  let ethStr = "ETH: unavailable";
  let solStr = "SOL: unavailable";
  try {
    const res = UrlFetchApp.fetch(
      "https://api.coingecko.com/api/v3/simple/price" +
      "?ids=ethereum,solana&vs_currencies=usd&include_24hr_change=true"
    );
    const c = JSON.parse(res.getContentText());

    const ethPrice = Math.round(c.ethereum.usd);
    const ethChg   = parseFloat(c.ethereum.usd_24h_change).toFixed(1);
    ethStr = "ETH: $" + ethPrice.toLocaleString() + " (" + (ethChg >= 0 ? "+" : "") + ethChg + "%)";

    const solPrice = parseFloat(c.solana.usd).toFixed(2);
    const solChg   = parseFloat(c.solana.usd_24h_change).toFixed(1);
    solStr = "SOL: $" + solPrice + " (" + (solChg >= 0 ? "+" : "") + solChg + "%)";
  } catch (e) {}

  // 5. CALENDAR — today's events from primary Google Calendar
  const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(today); endOfDay.setHours(23, 59, 59, 999);
  const events = CalendarApp.getDefaultCalendar().getEvents(startOfDay, endOfDay);
  const calLines = events
    .filter(function(e) { return !e.isAllDayEvent(); })
    .map(function(e) {
      const t = Utilities.formatDate(e.getStartTime(), TZ, "h:mma").toLowerCase();
      return t + " " + e.getTitle();
    });

  // 6. BUILD MESSAGE
  const parts = [
    dateStr,
    "",
    weatherStr,
    "",
    silverStr,
    ethStr,
    solStr,
  ];

  if (calLines.length > 0) {
    parts.push("");
    calLines.forEach(function(l) { parts.push(l); });
  }

  parts.push(
    "",
    "[ ] Morning routine",
    "[ ] Hike",
    "[ ] HOK deals",
    "[ ] VX queue"
  );

  // 7. SEND
  GmailApp.sendEmail(RECIPIENT, " ", parts.join("\n"));
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
