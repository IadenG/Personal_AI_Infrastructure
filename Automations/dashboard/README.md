# Mothership Dashboard — Shared Context

This file is the source of truth for what this system is, what's been built, what's next, and how to work on it.
**Read this at the start of every session before touching any code.**

---

## Who this is for

Iaden Gaines — operating across three domains simultaneously:

| Domain | What it is | Goal |
|---|---|---|
| HOK (House of Kairos) | Watch resale business | Key metrics visible, inventory tracked |
| School | University coursework | Never miss a deadline, extract deep knowledge |
| VX (Versionex Auto) | Car content brand | 4 videos posted per week, streamlined queue |

---

## What's been built (current state as of 2026-05-02)

### Dashboard — live web app
A dark command-center dashboard served by Google Apps Script. Opens in any browser, bookmarkable on desktop and iPhone home screen. Auto-refreshes every 5 minutes.

**Sections:**
- Quote of the day (rotating mental models, lessons, beliefs, mission)
- Live clock + date
- Weather (Eugene, OR — Open-Meteo API, free)
- Markets — Silver, ETH, SOL with green/red % change (Yahoo Finance + Kraken, free)
- HOK deals — total count + pipeline/in-system/sold/shipped breakdown with visual bars
- School — upcoming assignments sorted by due date, color-coded urgency, add from dashboard
- VX Queue — video pipeline with stage badges (shot → editing → done → posted), click to advance
- Daily Ritual — Morning routine, Hike, Yoga, Presence practice — resets each day automatically
- Rolling Tasks — carry-over tasks with categories and due dates, add from dashboard
- 14-day calendar — all Google Calendar events

### Morning Brief — daily Gmail
Formatted HTML email at 8am Pacific. Weather, markets, calendar, quote, daily ritual checklist. Links to Mothership dashboard.

### Google Sheet "Mothership" — the database
Five tabs:
- **Daily Tasks** — ritual items + completion dates (date-based reset, no cron needed)
- **Rolling Tasks** — carry-over tasks (Name | Category | DueDate | Done | CompletedDate | Created)
- **HOK** — deal rows (Deal ID | Status | Date | Notes)
- **School** — assignments (Assignment | Course | Due Date | Priority | Done | CompletedDate | Created)
- **VX Queue** — video pipeline (Title | Week | Stage | Notes | Created)

---

## Data sources — what's automatic vs. manual

| Section | Source | Auto or Manual |
|---|---|---|
| Weather | Open-Meteo API | Auto — no key needed |
| Markets (Silver) | Yahoo Finance SI=F | Auto — no key needed |
| Markets (ETH, SOL) | Kraken public API | Auto — no key needed |
| Calendar | Google Calendar API | Auto — syncs your calendars |
| HOK deal count | Google Sheet — HOK tab | Manual — you enter deals |
| School assignments | Google Sheet — School tab | Manual now → Canvas API next |
| VX video queue | Google Sheet — VX Queue tab | Manual — managed from dashboard |
| Daily tasks | Google Sheet — Daily Tasks tab | Manual setup once, then automatic |
| Rolling tasks | Google Sheet — Rolling Tasks tab | Manual — add from dashboard |

---

## HOK — platforms in use

- **WatchTrack** — inventory tracking (no API, manual entry)
- **eBay** — removed from automation plans
- **Facebook Marketplace** — no API, manual
- **Reddit** — no API, manual
- **Grailzee** — no API, manual
- **QuickBooks** — API available, planned for Phase 3 (revenue data)
- **Website** — API depends on platform

**HOK deal status flow:** `pipeline` → `in system` → `sold` → `shipped`

---

## School — platforms in use

- **Canvas** — assignment management
  - Current: manually enter assignments from syllabus at start of each term
  - Phase 2 planned: Canvas API auto-sync (get personal token from Canvas profile)

---

## VX — system

- Reference: `~/.claude/PAI/USER/PROJECTS/VX.md` for full workflow
- Target: 4 videos posted per week
- Stage flow on dashboard: `shot` → `editing` → `done` → `posted` → archived (hidden)
- Click the stage badge to advance — updates Google Sheet instantly

---

## Roadmap — what's next

### Phase 2 — Canvas API (highest value, ~1 session)
Connect Canvas so assignments sync automatically at the start of each term.
- User gets a personal access token from their school's Canvas profile
- Store token in Script Properties as `CANVAS_TOKEN`
- Store Canvas base URL as `CANVAS_URL` (e.g. `https://canvas.uoregon.edu`)
- `getSchoolAssignments()` fetches from Canvas API instead of the Sheet
- Assignments with due dates appear automatically in the dashboard

**Canvas API endpoints to use:**
```
GET /api/v1/planner/items?per_page=50  ← upcoming assignments and due dates
GET /api/v1/courses                     ← active courses
```

### Phase 3 — QuickBooks API (~1 session)
Connect QuickBooks for HOK financial metrics.
- Revenue this month
- Outstanding receivables (AR)
- Basic P&L summary
- Requires OAuth — more complex setup, but high value

### Phase 4 — iPhone optimization
- Responsive layout that stacks cleanly on mobile
- Touch-friendly task checkboxes
- Possibly a simplified mobile view vs. full desktop view

### Future ideas
- VX content calendar showing which week each video targets
- HOK revenue goal tracker vs. actuals
- School grade tracker per course
- Weather-based hike advisory (skip hike if rain > 60%)
- Twilio SMS integration for morning brief as a real text

---

## File structure

```
Automations/
├── morning_brief.js          ← Gmail daily brief (separate Apps Script project)
├── MORNING_BRIEF_README.md   ← morning brief setup guide
└── dashboard/
    ├── Code.js               ← server-side backend (paste into Apps Script as Code.gs)
    ├── Dashboard.html        ← client-side UI (paste into Apps Script as Dashboard.html)
    └── README.md             ← this file
```

---

## Setup (if starting from scratch)

### Step 1 — Create the Google Sheet
1. Go to **sheets.google.com** → New spreadsheet → name it **Mothership**
2. Copy the full URL from your browser bar

### Step 2 — Create the Apps Script project
1. Go to **script.google.com** → New project → name it **Mothership**
2. Delete all starter content in `Code.gs`

### Step 3 — Paste the code files
**Code.gs:** paste everything from `Code.js`

**Dashboard.html:** click **+** next to Files → HTML → name it exactly **Dashboard** → paste from `Dashboard.html`

Save both (Ctrl+S / Cmd+S)

### Step 4 — Connect the Sheet (via Project Settings)
1. Click the **gear icon (⚙)** in the left sidebar → Project Settings
2. Scroll to **Script Properties** → **Add script property**
3. Property: `SHEET_URL` · Value: your Sheet URL from Step 1
4. Click **Save script properties**

### Step 5 — Initialize the Sheet
1. In the function dropdown, select **initSheet** → click ▶ Run
2. Google asks for authorization → Review permissions → Allow
3. Check the Execution Log: should say "Sheet initialized. All 5 tabs ready."
4. Open your Mothership Sheet — you'll see 5 tabs created

### Step 6 — Deploy as web app
1. **Deploy** → **New deployment** → gear icon → **Web app**
2. Execute as: **Me** · Who has access: **Anyone with Google account**
3. Click Deploy → copy the web app URL

### Step 7 — Test and bookmark
Open the URL. Data fills in within ~5 seconds. Bookmark it.

**iPhone:** Open in Safari → Share → Add to Home Screen

---

## How to modify things

| What to change | Where |
|---|---|
| Your city / coordinates | `CONFIG` block at top of `Code.js` |
| Refresh interval | `CONFIG.refreshMinutes` in `Code.js` |
| Add a crypto market | Add pair to `CONFIG.cryptoPairs` (e.g. `"XBTUSD"` for BTC) |
| Add a daily ritual task | Open Daily Tasks tab in Sheet, add a row |
| Change HOK statuses | `CONFIG.hokStatuses` in `Code.js` |
| Add a rolling task category | Add `<option>` in `Dashboard.html` select with id `inp-cat` |
| Add a school assignment category | Add `<option>` in `Dashboard.html` select with id `sc-course` |
| Add new VX stage | Update `VX_STAGES` array in `Code.js` + add CSS class in `Dashboard.html` |

---

## After making code changes

Changes to `Code.js` or `Dashboard.html` require a **new deployment**:
1. In Apps Script: **Deploy** → **Manage deployments**
2. Click the pencil (edit) on your existing deployment
3. Change version to **"New version"**
4. Click **Deploy**
5. The URL stays the same — refresh your browser

---

## Key principle

Every piece of this system follows: **Input → Process → Output**
- Input: APIs + Google Sheet
- Process: Apps Script functions
- Output: the dashboard UI + morning email

To add anything new: identify the input (where does the data live?), write a server function to get it, add a render function in the HTML. The CONFIG block and README stay updated so either of us can pick this up cold.
