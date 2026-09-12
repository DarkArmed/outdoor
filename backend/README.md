# Backend

Outdoor planning backend service.

## Stack

- Python 3.11+
- FastAPI
- SQLAlchemy 2.0
- PostgreSQL (production) / SQLite (tests)
- Alembic
- JWT authentication

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
cp .env.example .env
```

For local development with SQLite, set:

```env
DATABASE_URL=sqlite:///./outdoor.db
SECRET_KEY=dev-secret-change-me
```

## Database migrations

```bash
alembic upgrade head
```

## Seed data

Import existing site data and create default user from `config/profile.json`:

```bash
python -m app.seed
```

## Run

```bash
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## Test

```bash
pytest
```

Tests use an in-memory SQLite database.
