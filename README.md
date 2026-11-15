# PGRKAM Insight

PGRKAM Insight is an employment discovery and analytics web application inspired by the Punjab Government's PGRKAM platform. It helps candidates browse and apply for jobs, maintain a skills profile, save opportunities, and receive job recommendations. It also records product events so administrators can understand how people use the platform.

## Features

- Candidate registration, login, profile and skill management
- Job search and filtering, saved jobs, and applications
- Job recommendations based on candidate and job skills
- Admin workflows for jobs and applications
- Browser event tracking, including session, source, campaign, and device information
- Analytics API and analytics data stored separately from operational data

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, JavaScript, Vite 8, CSS |
| Backend | Node.js (ES modules), Express 5 |
| Database | PostgreSQL |
| ORM and migrations | Prisma 7 with the PostgreSQL adapter |
| Authentication | JWT and bcryptjs |
| Request validation and security | Zod, Helmet, CORS, express-rate-limit |

## Repository layout

```text
backend/
  prisma/                 Prisma schema and committed database migrations
  prisma7.config.ts       Prisma CLI configuration
  scripts/                Admin, seed, and ETL scripts
  src/routes/             Auth, jobs, applications, profiles, analytics, and event APIs
  src/server.js           Express API entry point
frontend/vite-project/
  src/                     React application and browser event tracking
 database/                 SQL schema/reference files
 docs/                     Project documentation
```

## Prerequisites

- Node.js and npm
- PostgreSQL running locally for development
- A PostgreSQL database and reachable connection string for any hosted deployment

## Local development setup

Each developer should use their own local PostgreSQL database and credentials. From the repository root, create the database using your local PostgreSQL username:

```bash
createdb pgrkam_insight
psql pgrkam_insight -c "SELECT current_user;"
```

Create `backend/.env` (do not commit it):

```dotenv
PORT=5001
DATABASE_URL=postgresql://YOUR_LOCAL_POSTGRES_USERNAME@localhost:5432/pgrkam_insight
FRONTEND_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-local-secret
```

Install backend dependencies, generate the Prisma client, and apply the committed migrations:

```bash
cd backend
npm install
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
```

Load the skills catalog (needed for skill-based profile and recommendation flows):

```bash
npm run seed-skills
```

Optionally create an administrator account in this local database:

```bash
npm run create-admin -- admin@example.com ChangeThisPassword123 "Site Admin"
```

In one terminal, start the API:

```bash
cd backend
npm run dev
```

The API listens on port `5001`. Its health endpoint is `http://localhost:5001/api/health`.

In a second terminal, start the frontend:

```bash
cd frontend/vite-project
npm install
npm run dev
```

Vite normally serves the app at `http://localhost:5173`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `5001` locally. |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma and the API. |
| `FRONTEND_ORIGIN` | Exact browser origin allowed by the API's CORS configuration. |
| `JWT_SECRET` | Secret used to sign and verify authentication tokens. Set a strong private value. |

### Frontend (`frontend/vite-project/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL compiled into the Vite frontend. |

Vite exposes variables prefixed with `VITE_` in browser code. Never place database credentials or other private secrets in frontend variables.

> **API URL note:** The main app and event tracker currently compose the API URL differently. Before setting a production `VITE_API_URL`, make their path convention consistent: the app's API helper expects a base ending in `/api`, while the tracker appends `/api/events` to the configured value.

## API overview

All API routes use the `/api` prefix. The backend includes endpoints for:

- `/api/health` — service health check
- `/api/auth` — registration, login, and authenticated user details
- `/api/jobs` and `/api/admin/jobs` — job browsing and administration
- `/api/applications` and `/api/admin/applications` — candidate applications and administration
- `/api/profile`, `/api/skills`, and `/api/options` — candidate profile and catalog data
- `/api/saved-jobs` and `/api/recommendations` — saved jobs and personalized recommendations
- `/api/events` and `/api/analytics` — event collection and analytics

Authentication-protected routes require a bearer token. Admin routes require an administrator account.

## Database and migrations

Prisma schema is in `backend/prisma/schema.prisma`; committed migrations are in `backend/prisma/migrations`. For a new database, apply the committed migrations with `prisma migrate deploy`. Do not use `migrate reset` on data you need to keep. Keep each developer's `.env` local and commit schema changes together with their generated migration.

For a hosted deployment, use a managed PostgreSQL database and configure `DATABASE_URL` on the backend host. Run the migrations against that database before serving traffic, and set `FRONTEND_ORIGIN` to the deployed frontend's exact origin. The local `localhost` connection string only works on the developer's machine.

### Normalization and ER model

The operational data is split into related entities such as users, profiles, jobs, skills, applications, and recommendations to reduce duplicated data. Many-to-many relationships are represented by junction tables: `candidate_skills`, `job_skills`, and `saved_jobs`; unique constraints prevent duplicate links. Analytics data is kept in the separate `analytics` schema, with raw events, recommendation events, and summarized daily metrics.

Key relationships: a user can have one candidate profile and many applications, saved jobs, and events; jobs can have many applications and skills; users and skills are linked through `candidate_skills`, while jobs and skills are linked through `job_skills`. Recommendations connect a user to a job, and recommendation events record interaction with a recommendation.

## Scripts

Backend scripts (run from `backend/`):

- `npm run dev` — start the API with Nodemon
- `npm start` — start the API
- `npm run seed-skills` — insert the skills catalog (safe to run again)
- `npm run create-admin -- <email> <password> [name]` — create or promote an admin user
- `npm run seed-demo` — load the demo data provided by the project
- `npm run etl` — run the analytics ETL script

Frontend scripts (run from `frontend/vite-project/`):

- `npm run dev` — start Vite development server
- `npm run build` — create the production build in `dist/`
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

The backend's current `npm test` script is a placeholder; no automated backend test suite is configured by that script yet.
