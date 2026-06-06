# Specification: Jules

## 1. Project Overview

**Project:** Jules
**GitHub:** https://github.com/9KMan/JOB-20260606131441-000075
**Lead:** https://www.upwork.com/jobs/~022063237346834466492
**Client:** Jules
**Tier:** LARGE
**Budget:** $6,000.00 fixed-price
**Rate:** $6/hr

## 2. Technical Stack

TypeScript strict · Next.js 16 API routes (App Router) · Supabase (Postgres) · SWR · Docker Compose · GitHub Actions · Sentry · Centrifugo · Rust engine (read-only)

## 3. Architecture

- Backend: REST API with appropriate framework
- Database: PostgreSQL with schema design
- Frontend: Responsive web application
- Auth: JWT-based authentication

### API Design
- RESTful endpoints with JSON request/response
- Authentication via JWT (HS256) or bcrypt
- Middleware for logging, error handling, CORS
- Versioned routes (/api/v1/...)

### Data Layer
- PostgreSQL as primary datastore
- Connection pooling via PGBouncer or similar
- Migration management via Alembic or raw SQL
- Indexes on foreign keys and high-cardinality columns

### Frontend (if applicable)
- Single-page application or server-rendered pages
- Responsive UI with modern CSS/JS framework
- State management for complex client-side logic

## 4. Data Model

### Core Entities
- Define entity schema based on job requirements
- Use UUIDs for primary keys (not auto-increment)
- Add created_at / updated_at timestamps to all tables
- Soft-delete pattern where appropriate

### Relationships
- Foreign key constraints with ON DELETE CASCADE
- Many-to-many via junction tables
- Eager loading for nested relationships in API

## 5. Project Structure

```
├── api/                  # FastAPI / Express routes + schemas
├── models/               # DB models / SQLAlchemy / Prisma
├── services/             # Business logic layer
├── workers/              # Background jobs (Celery, BullMQ, etc.)
├── migrations/           # DB migrations (Alembic / Flyway)
├── tests/                # Unit + integration tests
├── Dockerfile            # Production container
├── docker-compose.yml     # Local dev environment
└── README.md             # Setup instructions
```

## 6. Out of Scope

- Mobile apps (web only unless specified)
- Third-party integrations not mentioned in requirements
- Performance optimization at scale (1M+ users)
- White-label / multi-tenant unless explicitly required

## 7. Acceptance Criteria

- [ ] Application builds and runs without errors
- [ ] Core functionality implemented as described
- [ ] Basic tests covering key features
- [ ] README with setup instructions
- [ ] Docker configuration for deployment

**GitHub:** https://github.com/9KMan/JOB-20260606131441-000075
