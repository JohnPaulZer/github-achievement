# GitHub Achievement Progress Tracker

Live, GitHub-inspired tracker for estimated progress on selected GitHub achievements.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Data source: GitHub REST API + GitHub GraphQL API
- Sync: Manual refresh + auto-refresh polling + focus/revisit refresh + webhook-triggered refresh events (SSE)

## Folder Structure

```text
.
|- frontend/
|  |- src/
|  |  |- api/
|  |  |- components/
|  |  |- utils/
|  |  |- App.tsx
|  |  |- index.css
|  |  |- main.tsx
|  |  |- types.ts
|  |- .env.example
|  |- package.json
|  |- tailwind.config.js
|
|- backend/
|  |- src/
|  |  |- config/
|  |  |- lib/
|  |  |- routes/
|  |  |- services/
|  |  |- utils/
|  |  |- server.ts
|  |  |- types.ts
|  |- .env.example
|  |- package.json
```

## Achievements Covered

- Starstruck
- Quickdraw
- Pair Extraordinaire
- Pull Shark
- Galaxy Brain
- YOLO
- Public Sponsor

The app labels progress as estimated when GitHub does not expose exact official counters.

## Security Note

- GitHub token is optional.
- Token is sent per request for analysis and never saved in a database.
- Backend uses token only in memory for the current request.

## Local Setup

### 1. Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend default URL: http://localhost:5173
Backend default URL: http://localhost:5050

## Build

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

## API Endpoints

- GET /api/health
- POST /api/achievements/analyze
- GET /api/achievements/analyze/:username
- GET /api/sync/events/:username (SSE stream)
- POST /api/webhooks/github

### Analyze Request Body

```json
{
  "username": "octocat",
  "token": "optional-token",
  "forceRefresh": true
}
```

## Auto Update Strategy

The app updates progress via a hybrid sync model:

- On-demand analysis when user clicks Analyze Progress
- Manual Refresh Progress button
- Auto-refresh polling while dashboard is open
- Automatic refresh when the dashboard regains focus or is reopened on the same device
- Webhook event invalidates cache and emits SSE refresh-needed event
- Frontend listens to SSE and refreshes without full reload

## GitHub Webhook Setup (Optional)

1. Add a webhook in GitHub repository settings.
2. Payload URL: http://your-backend-host/api/webhooks/github
3. Content type: application/json
4. Secret must match backend .env GITHUB_WEBHOOK_SECRET
5. Select events relevant to stars, pull requests, issues, discussions, and sponsorship where available.

## Environment Variables

### backend/.env

- PORT
- CORS_ORIGIN
- PUBLIC_CACHE_TTL_SECONDS
- AUTH_CACHE_TTL_SECONDS
- AUTO_SYNC_INTERVAL_SECONDS
- GITHUB_WEBHOOK_SECRET

### frontend/.env

- VITE_API_BASE_URL

The frontend falls back to `http://<current-host>:5050` when `VITE_API_BASE_URL` is not provided.

## Notes on API Limitations

- Some achievement calculations are best-effort and approximate.
- Quickdraw depends on recent public events and can miss older/private activity.
- Pair Extraordinaire and YOLO inspect a limited set of recent merged PRs per sync.
- Galaxy Brain exact accepted-answer counts are not fully exposed by official APIs.
- Public Sponsor verification may be unavailable if token is missing or lacks scope.
