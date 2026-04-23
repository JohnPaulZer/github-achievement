# GitHub Achievement Counter

## Purpose

This web app analyzes a GitHub user's achievement progress and displays it as a clean live counter dashboard.

It is made for tracking GitHub profile achievements such as:

- Starstruck
- Quickdraw
- Pair Extraordinaire
- Pull Shark
- Galaxy Brain
- YOLO
- Public Sponsor

The app shows the current counter value, current tier, next tier target, progress bar, achievement status, and detailed detected stats for each badge. It also shows a compact achievement summary row with tier multipliers such as `x2`, `x3`, and `x4`.

Public GitHub data works without a token. A GitHub token improves accuracy, raises API limits, and can include private repositories or private pull requests when the token belongs to the same GitHub account being analyzed.

## Live Link

Local frontend:

```text
http://localhost:5173
```

Local backend:

```text
http://localhost:5050
```

Add your deployed frontend URL here when the app is published.

## What The App Does

The app checks GitHub activity and estimates achievement progress by combining:

- GitHub REST API data
- GitHub GraphQL API data
- Public GitHub profile achievement badges
- Public sponsorship/profile information
- Recent events, pull requests, reviews, commits, discussions, and repositories

The backend tries to make counters more accurate by using official profile badge data as a minimum floor when GitHub does not expose the exact badge counter directly.

## Achievements Tracked

### Starstruck

Tracks repositories created by the user and uses the highest star count found.

### Quickdraw

Tracks issues or pull requests closed within 5 minutes of opening.

### Pair Extraordinaire

Tracks co-authored commits on merged pull requests.

### Pull Shark

Tracks pull requests opened by the user that have been merged.

### Galaxy Brain

Tracks accepted GitHub Discussion answers where available.

### YOLO

Tracks pull requests merged without review.

### Public Sponsor

Tracks whether the user publicly sponsors someone through GitHub Sponsors.

## Main Features

- GitHub username analysis
- Optional GitHub token support
- Token tutorial modal
- Error modal for invalid usernames, invalid tokens, rate limits, and API errors
- Loading animation while analyzing
- Clean achievement counter cards
- Show Details modal for each achievement
- Achievement summary row with badge multipliers
- Animated notifications when achievements change
- Auto-sync and manual refresh
- Server-sent events for webhook-triggered refresh
- GitHub Sponsors floating button for JohnPaulZer
- Production security headers with Helmet
- API rate limit of 100 requests per 5 minutes

## Process

### 1. Copy environment files

From the project root:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

On macOS or Linux:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### 4. Start the backend

```bash
cd backend
npm run dev
```

The backend runs at:

```text
http://localhost:5050
```

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

### 6. Use the app

1. Open `http://localhost:5173`.
2. Enter a GitHub username.
3. Optional: paste a GitHub token for better accuracy.
4. Click `Analyze`.
5. Review the achievement cards.
6. Click `Show Details` on any card to see detected stats and tier targets.
7. Use `Refresh` to force a new sync.
8. Keep `Auto-sync` enabled if you want the app to refresh automatically.

## GitHub Token

A token is optional, but recommended.

Without a token, the app can analyze public GitHub data only. With a token, the app gets higher GitHub API limits and can include private or token-accessible data when the token belongs to the analyzed account.

### Fine-Grained Token Recommended

Open:

```text
https://github.com/settings/personal-access-tokens/new
```

Create a fine-grained token with read-only access.

Recommended permissions:

- Metadata: read
- Contents: read
- Pull requests: read
- Issues: read
- Discussions: read
- Events: read, if shown by GitHub

Do not add write, admin, workflow, secret, or organization permissions for this app.

### Classic Token Fallback

Open:

```text
https://github.com/settings/tokens/new
```

For public data only, a classic token with no scopes can raise API limits.

For private repository data, classic tokens need the broad `repo` scope. Use that only if you understand and accept the wider access.

### How To Use The Token

1. Generate the token in GitHub.
2. Copy it immediately.
3. Paste it into the app's optional `Token` field.
4. Enter the matching GitHub username.
5. Click `Analyze`.

The token is sent to the backend for GitHub API requests. The frontend keeps it only in current React state and does not save it to local storage.

You can also set a backend token in `backend/.env`:

```env
GITHUB_TOKEN=your_token_here
```

This lets the backend reuse a server-side token for higher API limits. For private activity, use a token from the same account being analyzed.

## Security

Current security features:

- `.env` files are ignored by Git.
- GitHub token is not saved in browser local storage.
- Backend does not return the token to the frontend.
- Token-based cache keys use SHA-256 token hashes, not raw token values.
- Express JSON body limit is `1mb`.
- Helmet adds production-friendly security headers.
- API rate limit is `100` requests per `5` minutes by default.
- Production requires a specific `CORS_ORIGIN`.
- Webhook signature verification is supported through `GITHUB_WEBHOOK_SECRET`.
- Production error responses hide raw upstream details.

## Notes

- GitHub does not expose every official achievement counter directly.
- Some values are estimates.
- Public profile badges are used as a lower-bound source when available.
- Quickdraw depends on recent event history and may miss older activity.
- Private repositories require a token with access to those repositories.
- Organization repositories may require SSO or organization approval.
- Public Sponsor checks can depend on public profile visibility and GraphQL availability.
- GitHub API rate limits still apply even with a token.

## Screenshots

Add screenshots of the app here after deployment or final UI capture:

```text
docs/screenshots/dashboard.png
docs/screenshots/details-modal.png
docs/screenshots/token-tutorial.png
```

## Summary

GitHub Achievement Counter is a full-stack React and Express app for analyzing GitHub achievement progress. It helps users see which GitHub achievements are unlocked, which tier they are on, how close they are to the next tier, and what GitHub activity was detected to calculate each badge.
