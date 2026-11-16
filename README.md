# PGRKAM Insight

## Live Application

**Visit PGRKAM Insight:**

https://pgrkam-insight.vercel.app

---

## Demo Login Credentials

You can use the following demo accounts to explore the website and test its functionality.

| Account | Email | Password |
|---|---|---|
| Admin | admin@example.com | `AdminPass123` |
| Test Candidate | testcandidate111@gmail.com | `TestCandidate123` |
| Sneaky | sneaky@example.com | `Password123` |

### How to Test
1. Open the deployed website.
2. Navigate to the login page.
3. Enter any of the demo account credentials above.
4. Explore the available features and test the application workflows.

**Note:** These credentials are provided strictly for demonstration and testing purposes. Please do not use them for personal accounts or sensitive information.

### Employment Discovery & Analytics Platform

PGRKAM Insight is a full-stack employment discovery and analytics platform inspired by the Punjab Government's PGRKAM platform.

It helps candidates discover jobs, maintain profiles, manage applications and receive personalized job recommendations. Administrators can manage job listings, monitor applications and analyse platform activity.

## 1. Features

### Candidate
- Registration and login.
- Profile and skill management.
- Job search, filtering and sorting.
- Personalized job recommendations.
- Save and manage jobs.
- Apply for jobs.
- Track application statuses.

### Admin
- Secure administrator login.
- Create, edit and manage job listings.
- Manage required job skills.
- View and filter applications.
- Update application statuses.
- Monitor platform analytics and KPIs.

### Analytics
- Browser event tracking.
- Session, source, campaign and device tracking.
- Daily active users.
- Registration and application analytics.
- Recommendation impressions and clicks.
- ETL processing and daily metrics.

## 2. Technology Stack

| Area | Technology |
|---|---|
| Frontend | React 19, JavaScript, Vite 8, CSS |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 7, PrismaPg |
| Authentication | JWT, bcryptjs |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit |
| Hosting | Vercel, Render, Neon |

## 3. Website Usage

### Candidate Guide

1. Open the website.
2. Register using your name, email and password.
3. Log in to access the Candidate Workspace.
4. Complete your profile with education, experience, location and skills.
5. Browse jobs using search and filters.
6. Open Recommended to view personalized job matches.
7. Save interesting opportunities.
8. Apply for suitable jobs.
9. Open My Applications to track application progress.
10. Log out when finished.

### Admin Guide

1. Open the website and select the Admin portal.
2. Log in using an authorized administrator account.
3. Access the Admin Dashboard.
4. Open Job Management to create, edit or close job listings.
5. Add job requirements, salary, location, education and required skills.
6. Open Application Management to review candidate applications.
7. Update application statuses.
8. Open Analytics to monitor registrations, engagement, applications and recommendation performance.

**Note:** Candidate accounts cannot access administrator-only APIs. Admin accounts must be created or promoted through the backend.

## 4. Recommendation System

The platform uses a weighted, rule-based recommendation algorithm to compare candidate profiles with open job listings.

| Matching factor | Weight |
|---|---:|
| Skills | 50% |
| Location | 15% |
| Experience | 15% |
| Job category | 10% |
| Education | 10% |
| **Total** | **100%** |

### How It Works

- Skills are matched using job skill requirements and importance values.
- Location is compared against the candidate's preferred location.
- Experience is evaluated against the job's required experience.
- Category is matched against the candidate's preference.
- Education is evaluated using an education-level ranking.

The final weighted score is calculated as:

```text
Final Score =
(Skills × 50 + Location × 15
+ Experience × 15 + Category × 10
+ Education × 10) / 100
```

The system returns a match percentage, matched skills and missing skills.

Recommendations are sorted from highest to lowest match score.

This is a rule-based recommendation system, not a trained machine learning model.

## 5. Web Development Architecture

### Frontend
Built using React and JavaScript.

Important concepts:
- Components and reusable UI.
- Props and state management.
- React hooks such as useState and useEffect.
- Conditional rendering.
- API integration using HTTP requests.
- Vite development and production builds.

### Backend
Built using Node.js and Express.

Responsibilities:
- REST API development.
- Authentication and authorization.
- Request validation.
- Database operations.
- Recommendation calculations.
- Job and application management.
- Event tracking and analytics.

### Application Flow

```text
React Frontend
      |
      v
Express REST API
      |
      v
Authentication and Validation
      |
      v
Business Logic
      |
      v
Prisma ORM
      |
      v
PostgreSQL Database
      |
      v
JSON Response
```

## 6. Database Design

PostgreSQL stores operational and analytical data in separate schemas.

### Public Schema

| Table | Purpose |
|---|---|
| users | User accounts and roles |
| candidate_profiles | Candidate information |
| skills | Skills catalog |
| candidate_skills | Candidate-skill relationships |
| jobs | Employment listings |
| job_skills | Job-skill relationships |
| saved_jobs | Saved opportunities |
| applications | Job applications |
| recommendations | Recommendation records |

### Analytics Schema

| Table | Purpose |
|---|---|
| user_events | Raw user activity |
| acquisition_sources | Acquisition information |
| recommendation_events | Recommendation interactions |
| daily_metrics | Aggregated daily metrics |
| rejected_events | Rejected events |
| etl_runs | ETL execution history |

### Database Relationships

- One user can have one candidate profile.
- One user can submit multiple applications.
- One job can receive multiple applications.
- Candidates and skills have a many-to-many relationship.
- Jobs and skills have a many-to-many relationship.
- Users can receive multiple recommendations.

Junction tables such as candidate_skills and job_skills manage many-to-many relationships.

## 7. SQL Concepts Used

The project uses relational database concepts including:

- DDL: CREATE, ALTER and DROP.
- DML: INSERT, UPDATE and DELETE.
- SELECT and WHERE filtering.
- INNER JOIN and LEFT JOIN.
- GROUP BY and HAVING.
- Aggregate functions such as COUNT, SUM and AVG.
- Subqueries and CASE statements.
- Primary keys and foreign keys.
- Unique constraints and indexes.
- Database normalization.
- Transactions and ACID properties.

Prisma manages database access, while PostgreSQL executes the underlying SQL operations.

## 8. Data Analytics and ETL

The platform collects events such as:

- Session starts.
- Page views.
- Registrations and logins.
- Job searches and views.
- Job saves and applications.
- Recommendation impressions and clicks.

Events can contain user identifiers, anonymous identifiers, session information, timestamps, source, campaign and device information.

### ETL Process

The ETL script is located at:

`backend/scripts/run-etl.js`

ETL stands for Extract, Transform and Load.

1. **Extract:** Retrieve raw event and application data.
2. **Transform:** Calculate daily activity, registrations, application metrics and recommendation performance.
3. **Load:** Store aggregated results in the analytics.daily_metrics table.

ETL execution details are recorded in analytics.etl_runs.

## 9. Python and Data Science

The current application does not contain Python source files. Its backend, recommendation algorithm and ETL pipeline use JavaScript, Prisma and SQL.

Python could be used in future extensions for:

- Data analysis using Pandas and NumPy.
- Visualization using Matplotlib and Seaborn.
- Machine learning using Scikit-learn.
- Employment trend analysis.
- Skill-demand forecasting.
- Advanced recommendation models.

These are potential extensions, not currently deployed features.

## 10. Project Structure

```text
pgrkam-insight/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── scripts/
│   │   ├── create-admin.js
│   │   ├── seed-demo.js
│   │   ├── seed-skills.js
│   │   └── run-etl.js
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── db.js
│   │   └── server.js
│   ├── prisma7.config.ts
│   └── package.json
│
├── frontend/
│   └── vite-project/
│       ├── src/
│       └── package.json
│
├── database/
│   └── schema.sql
│
├── docs/
└── README.md
```

## 11. Local Installation

### Prerequisites
- Node.js and npm.
- PostgreSQL.
- Git.

### Step 1: Clone the repository

```bash
git clone https://github.com/konsiddharth-7/pgrkam-insight.git
cd pgrkam-insight
```

### Step 2: Create the database

```bash
createdb pgrkam_insight
```

### Step 3: Configure backend/.env

```dotenv
PORT=5001
DATABASE_URL=postgresql://YOUR_LOCAL_POSTGRES_USERNAME@localhost:5432/pgrkam_insight
FRONTEND_ORIGIN=http://localhost:5173
JWT_SECRET=your_private_random_secret
```

### Step 4: Install backend dependencies

```bash
cd backend
npm install
```

### Step 5: Generate Prisma Client and apply migrations

```bash
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
```

### Step 6: Load the skills catalog

```bash
npm run seed-skills
```

### Step 7: Create an administrator account

```bash
npm run create-admin -- admin@example.com ChangeThisPassword123 "Site Admin"
```

### Step 8: Start the backend

```bash
npm run dev
```

API address:

`http://localhost:5001`

Health check:

`http://localhost:5001/api/health`

### Step 9: Configure the frontend

Create `frontend/vite-project/.env`:

```dotenv
VITE_API_URL=http://localhost:5001/api
```

Install and start:

```bash
cd frontend/vite-project
npm install
npm run dev
```

Open:

`http://localhost:5173`

## 12. Important Scripts

Run backend scripts from the backend directory.

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm start` | Start production server |
| `npm run seed-skills` | Load skills catalog |
| `npm run create-admin` | Create or promote an admin |
| `npm run seed-demo` | Generate synthetic demo data |
| `npm run etl` | Run analytics ETL |
| `npx prisma migrate deploy --config prisma7.config.ts` | Apply migrations |
| `npx prisma migrate status --config prisma7.config.ts` | Check migration status |

The demo seed creates synthetic candidate accounts, jobs, applications, recommendations and events. Use it only in an appropriate test or demonstration database.

## 13. Deployment

The application uses three deployment services.

| Service | Responsibility |
|---|---|
| Vercel | React frontend |
| Render | Node.js and Express backend |
| Neon | Managed PostgreSQL database |

### Frontend
- Root: `frontend/vite-project`
- Build: `npm run build`
- Output: `dist`
- Environment variable: `VITE_API_URL`

### Backend
- Root: `backend/`
- Build: `npm install && npx prisma generate --config prisma7.config.ts`
- Start: `npm start`

### Database
Neon PostgreSQL stores operational and analytics data. Production migrations must be applied before serving traffic.

## 14. Security

The application implements:

- bcryptjs password hashing.
- JWT authentication.
- Role-based authorization.
- Zod request validation.
- Helmet security headers.
- CORS configuration.
- Rate limiting.
- Database constraints and transactions.

Never commit `.env` files or expose database credentials and JWT secrets in frontend code.

## 15. Limitations and Future Improvements

Potential improvements include:

- Machine learning-based recommendations.
- Python-based analytics and forecasting.
- Resume parsing.
- Employer accounts.
- Email notifications.
- Advanced analytics dashboards.
- Expanded automated testing.
- Improved recommendation evaluation.

The current backend npm test script is a placeholder; a full automated backend test suite is not yet configured.

## 16. Conclusion

PGRKAM Insight demonstrates the integration of full-stack web development, REST APIs, authentication, relational database design, SQL, weighted recommendation algorithms and data analytics.

It provides a practical employment platform where candidates can discover opportunities and administrators can manage listings and understand platform performance.

---

