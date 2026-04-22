# MERN TypeScript Workspace

This workspace is split into two separate folders:

- `frontend` - React + TypeScript + Vite + Tailwind CSS
- `backend` - Node.js + Express + TypeScript + Mongoose

## Run Frontend

```bash
cd frontend
npm run dev
```

## Run Backend

```bash
cd backend
copy .env.example .env
npm run dev
```

Backend health endpoint:

- `GET http://localhost:5000/api/health`

## Build

```bash
cd frontend
npm run build

cd ../backend
npm run build
```
