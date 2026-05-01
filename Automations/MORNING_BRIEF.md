# Morning Brief

Daily automated text sent at 8:00 AM Pacific. Edit any section below to change what shows up.

---

## Config

| Setting | Value |
|---|---|
| Delivery time | 8:00 AM Pacific |
| Location | Eugene, OR |
| Timezone | America/Los_Angeles |

---

## Sections

---

### 1. Greeting
Today's date + day of week. One line.

Example output:
```
Friday, May 1
```

---

### 2. Weather — Eugene, OR
Current conditions + today's high/low + precipitation warning if any.

Example output:
```
Weather: 58F cloudy. High 67 / Low 44. No rain.
```

---

### 3. Markets
Prices + overnight % change.

Assets tracked:
- Silver (XAG/USD)
- Ethereum (ETH/USD)
- Solana (SOL/USD)

Example output:
```
Silver: $32.10 (+0.4%)
ETH:    $2,840 (-1.2%)
SOL:    $148   (+2.1%)
```

> To add an asset, add a bullet above. To remove one, delete the bullet.

---

### 4. Today's Calendar
Events pulled from Google Calendar, sorted by time. Skipped if empty.

Example output:
```
3:00p ASTR121 - Willamette 100
4:00p CS102 - Lillis 182
```

---

### 5. Daily Checklist
Fixed tasks that appear every day. These also feed into the Dashboard task tracker.

Current list:
- Morning routine (shower, coffee, breakfast, vitamins)
- Hike
- HOK deal flow check
- VX content queue check

Example output:
```
[ ] Morning routine
[ ] Hike
[ ] HOK deals
[ ] VX queue
```

> To add a task, add a bullet above. To remove one, delete the bullet.

---

## Format Rules

- Plain text only — no markdown, no emojis
- Keep it tight — this is a text message
- Sections separated by a blank line
- No filler words, no sign-off

---

## Example Full Output

```
Friday, May 1

Weather: 58F cloudy. High 67 / Low 44.

Silver: $32.10 (+0.4%)
ETH: $2,840 (-1.2%)
SOL: $148 (+2.1%)

3:00p ASTR121 - Willamette 100
4:00p CS102 - Lillis 182

[ ] Morning routine
[ ] Hike
[ ] HOK deals
[ ] VX queue
```
