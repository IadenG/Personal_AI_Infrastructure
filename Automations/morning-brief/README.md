# Morning Brief

A daily HTML email delivered to Gmail at 8am Pacific. Weather, markets, calendar, and a rotating mental model — all in one place before the day starts.

---

## What it delivers

| Section | Source | Notes |
|---|---|---|
| Quote | Hardcoded rotation | Mental models, lessons, beliefs, mission |
| Weather | Open-Meteo API | Free, no key required |
| Silver | Yahoo Finance | SI=F futures |
| ETH / SOL | Kraken API | Free, no key required |
| Calendar | Google Calendar | Filters out birthdays/holidays |
| Ritual checklist | Hardcoded | Edit directly in the script |

---

## Architecture

```
Google Apps Script (cloud, runs on Google's servers)
       |
       |── Fetch: weather, silver, ETH, SOL, calendar
       |── Build: HTML email + plain text fallback
       |── Send: GmailApp → iadengaines25@gmail.com
       |
Gmail app on iPhone → push notification
```

The key insight: **Google runs this script on their servers at 8am every day.** Your phone doesn't need to be involved. The script fetches everything, builds the email, and Gmail delivers it. Your iPhone just receives it like any other email.

---

## Setup (one-time)

1. Go to [script.google.com](https://script.google.com)
2. Click **New project** → paste the full contents of `morning_brief.js`
3. Click **Save**
4. Run `testBrief()` first — Google will ask you to authorize Gmail + Calendar access. Approve it.
5. Check Gmail — you should receive the brief within seconds
6. Set the daily trigger:
   - Click the **clock icon** (Triggers) in the left sidebar
   - **Add Trigger** → Function: `sendMorningBrief` → Event: Time-driven → Day timer → 7am–8am
7. Done. The script runs automatically every morning.

**On iPhone:** Make sure the Gmail app has notifications enabled in iOS Settings → Gmail → Notifications → Allow.

---

## Testing

Run `testBrief()` from the Apps Script editor any time you want to verify it works. It fires the full function — real data, real email. Check the **Execution Log** (View → Logs) for any errors.

---

## How to know if it's broken

Google Apps Script can send you an automatic alert if the script fails:
- In the Triggers panel, click the **three dots** next to your trigger → **Notification settings**
- Set: **Send email immediately** on failure

This means if the script ever crashes (API down, quota hit, code error), you get an email before you notice the brief didn't arrive.

---

## How to modify it

**Change the delivery email:**
```javascript
const RECIPIENT = "iadengaines25@gmail.com"; // line 7
```

**Change the location (for weather):**
```javascript
// Find the Open-Meteo URL and update latitude/longitude
"?latitude=44.0521&longitude=-123.0868"
// Eugene, OR = 44.0521, -123.0868
// Use maps.google.com to find coordinates for any location
```

**Change the ritual checklist:**
```javascript
const ritual = ["Breakfast", "Focus work", "HOK deals", "VX queue", "Hike"]; // in buildHtml()
```

**Add a new quote:**
```javascript
// Add to the quotes array in getDailyQuote()
// Format: "[Category] The quote text."
"[Lesson] Your new quote here.",
```

**Add a new market:**
- Find a Kraken ticker pair at kraken.com/features/api
- Copy the ETH or SOL fetch block and change the pair name

---

## Upgrading to SMS (later)

If you ever want a real text message instead of (or in addition to) the Gmail notification, the cleanest upgrade is **Twilio**:
- Sign up at twilio.com → get Account SID + Auth Token
- Store credentials in Apps Script: **Project Settings → Script Properties**
- Replace `GmailApp.sendEmail` with a `UrlFetchApp.fetch` call to Twilio's API

This sends a real SMS to any phone, any carrier, from a real phone number. ~$1/month for daily messages.

---

## System thinking: why this is built this way

Every system has three parts: **Input → Process → Output**

- **Input:** APIs (weather, prices, calendar)
- **Process:** fetch, format, assemble
- **Output:** email to Gmail

The system is only as reliable as its weakest link. The original version used an email-to-SMS gateway (weak link — carrier dependent, no feedback on failure). Gmail is a strong link — it always delivers, the app notifies you, and you can check it from any device.

**Failure detection:** the trigger notification setting (see above) is how you know before you need to know. Don't wait to notice the brief didn't arrive — let the system tell you.
