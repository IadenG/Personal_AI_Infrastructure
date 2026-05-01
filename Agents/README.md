# Agents

This folder contains the system prompts and context files for Kairos, Kai, and ARK.
Each agent profile is synced to its corresponding Claude Project via GitHub.

---

## Making Changes

Edit any file in `Profiles/` and run these three commands in Terminal to push the update to GitHub.
Claude Projects will pick up the change on its next sync.

```bash
cd /Users/iadengaines/Documents/Github/Personal_AI_Infrastructure
git add .
git commit -m "your note about what you changed"
git push
```

Example:
```bash
git commit -m "updated Kairos listing templates — added Watchbox platform"
```

---

## Agent Files

| File | Claude Project | Purpose |
|---|---|---|
| `Profiles/KAIROS.md` | Kairos | HOK advisor — watch trading, luxury, deal flow |
| `Profiles/KAI.md` | Kai | VX media operator — content system, team coordination |
| `Profiles/ARK.md` | ARK | Engineering mentor — first principles, robotics, long arc |
| `Profiles/HOK_LISTING_TEMPLATES.md` | Kairos | Listing templates for IG, Reddit, Chrono24, eBay, DM |

---

## Claude Projects Setup

Each project needs two things:
1. **Instructions** — paste the agent's `.md` file into the Instructions field
2. **Project Knowledge** — upload or sync via GitHub the relevant context files

| Project | Instructions | Knowledge Files |
|---|---|---|
| Kairos | `KAIROS.md` | `HOK_LISTING_TEMPLATES.md` + GOALS, MISSION, BELIEFS from TELOS |
| Kai | `KAI.md` | — |
| ARK | `ARK.md` | GOALS, MISSION, BELIEFS, MODELS from TELOS |
