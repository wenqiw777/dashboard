# Learn Dashboard

A local-first knowledge base viewer + work tracker with Claude Code usage analytics.

## Features

### Knowledge Base
- Markdown viewer/editor with live preview, Mermaid diagrams, and CodeMirror
- Multi-directory support — add folders via native Finder picker or manual path
- Widget system: companion `.tsx` files inject interactive ECharts visualizations
- Light/dark mode with warm, low-saturation palette

### Work Tracker
- GitHub activity monitoring — commits and PRs across tracked repos
- Date range views (today, week, month, custom calendar picker)
- Workload charts with per-repo breakdown

### Claude Code Usage
- **Stats overview** — sessions, messages, output tokens, estimated cost (from `~/.claude/stats-cache.json`)
- **Contribution heatmap** — GitHub-style calendar showing daily message activity
- **Token usage by model** — stacked bar chart (last 30 days)
- **Activity Timeline** — real-time tracking via Claude Code Stop hook
  - **Day view** — zoomable 24h ruler (scroll to zoom, drag to pan, 15min granularity)
  - **Week view** — 7-day activity tracks with per-day durations
  - **Month view** — daily hours line chart
  - **Projects view** — horizontal bar chart of hours per project
  - Color-coded by project with legend
- **Model breakdown** — per-model tokens + estimated cost

## Setup

```bash
npm install
npm run dev
```

Runs on `localhost:5173` (frontend) + `localhost:8000` (API).

### Claude Code Activity Tracking (optional)

The Activity Timeline requires a Claude Code hook to record when you use Claude. Click **"Copy Setup Prompt"** in the Claude Usage tab and paste it into Claude Code, or manually add this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'INPUT=$(cat); curl -s -X POST http://localhost:8000/api/claude-ping -H \"Content-Type: application/json\" -d \"$INPUT\" --max-time 3 >/dev/null 2>&1 || true'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

This hook fires on every Claude response (globally, all projects) and records timestamp, session ID, and project name. Fails silently if the dashboard server isn't running.

## Data Storage

All data is local JSON files in `data/`:

| File | Contents |
|---|---|
| `claude-pings.json` | Activity pings `[{ ts, session, project }]` |
| `repos.json` | Tracked GitHub repositories |
| `config.json` | GitHub username + token |
| `learn-dirs.json` | Knowledge base directory paths |

Claude stats are read directly from `~/.claude/stats-cache.json` (managed by Claude Code).

## Tech Stack

React 19 · Vite · TypeScript · Express · ECharts · CodeMirror · react-markdown
