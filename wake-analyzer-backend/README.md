# Wake Analyzer Backend

FastAPI-based backend for Wake Analyzer - A conversational data analysis platform with **zero AI hallucination**.

## Architecture

```
┌─────────────────────────────────┐
│  FastAPI Application            │
│                                 │
│  ┌──────────┐  ┌─────────────┐ │
│  │   Auth   │  │  Analytics  │ │
│  │   (JWT)  │  │   Engine    │ │
│  └──────────┘  └─────────────┘ │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Execution Engine        │  │
│  │  (pandas/numpy/sklearn)  │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  SQLite Database         │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

## Core Principles

1. **ALL numerical results come from Python execution** (pandas/numpy/sklearn)
2. **NO AI fabrication** - results are always from actual computations
3. **Strict validation** - plans validated before execution
4. **Complete audit trail** - every execution logged
5. **Session isolation** - user data is completely isolated

## Project Structure

```
wake-analyzer-backend/
├── app/
│   ├── api/                 # API route handlers
│   │   ├── auth.py          # Authentication endpoints
│   │   └── analytics.py     # Analytics endpoints
│   ├── core/                # Core application logic
│   │   ├── config.py        # Configuration management
│   │   ├── database.py      # Database setup
│   │   ├── security.py      # JWT & password hashing
│   │   └── schemas.py       # Pydantic request/response models
│   ├── models/              # SQLAlchemy database models
│   │   ├── user.py          # User model
│   │   ├── dataset.py       # Dataset model
│   │   └── analysis.py      # Analysis execution history
│   ├── services/            # Business logic services
│   │   ├── execution_engine.py  # Analytics execution
│   │   └── plan_validator.py   # Plan validation
│   └── main.py              # FastAPI application entry point
├── Dockerfile               # Docker container definition
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Setup

### Local Development

1. **Create virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env - MUST change SECRET_KEY in production!
```

4. **Run the server:**
```bash
# Development (with auto-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

5. **Access API docs:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Docker Deployment

1. **Build image:**
```bash
docker build -t wake-analyzer-backend .
```

2. **Run container:**
```bash
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/wake_analyzer.db:/app/wake_analyzer.db \
  -e SECRET_KEY="your-secure-key" \
  --name wake-analyzer \
  wake-analyzer-backend
```

3. **Check logs:**
```bash
docker logs -f wake-analyzer
```

## API Endpoints

### Authentication

**POST /api/auth/register**
- Register new user account
- Body: `{"email": "...", "username": "...", "password": "..."}`
- Returns: User object

**POST /api/auth/login**
- Login to get JWT token
- Body: `{"username": "...", "password": "..."}`
- Returns: `{"access_token": "...", "token_type": "bearer"}`

**GET /api/auth/me**
- Get current user information
- Requires: Bearer token
- Returns: User object

### Analytics

**POST /api/analytics/upload**
- Upload CSV file for analysis
- Requires: Bearer token, multipart/form-data with "file" field
- Returns: `{"success": true, "session_id": "...", "metadata": {...}}`

**POST /api/analytics/validate**
- Validate execution plan without executing
- Requires: Bearer token
- Body: Execution plan JSON
- Returns: `{"valid": true/false, "errors": [...], "warnings": [...]}`

**POST /api/analytics/execute**
- Execute analytics plan
- Requires: Bearer token
- Body: `{"session_id": "...", "plan": {...}}`
- Returns: Execution result with numerical data and optional chart

**GET /api/analytics/datasets**
- Get all user's datasets
- Requires: Bearer token
- Returns: Array of dataset objects

**GET /api/analytics/datasets/{session_id}**
- Get specific dataset metadata
- Requires: Bearer token
- Returns: Dataset object

**GET /api/analytics/history/{session_id}**
- Get analysis history for a dataset
- Requires: Bearer token
- Returns: Array of analysis objects

**DELETE /api/analytics/datasets/{session_id}**
- Delete dataset and all analyses
- Requires: Bearer token
- Returns: 204 No Content

## Execution Plan Schema

Example execution plan:

```json
{
  "operation": "mean",
  "target_column": "age",
  "filters": [
    {
      "column": "status",
      "operator": "==",
      "value": "active"
    }
  ],
  "group_by": ["region"],
  "chart_type": "bar"
}
```

**Supported operations:**
- `mean`, `sum`, `count`, `min`, `max`, `std` (aggregations)
- `correlation` (requires x_axis, y_axis)
- `regression` (requires x_axis, y_axis)
- `forecast` (requires time_column, target_column)

**Supported operators:**
- `==`, `!=`, `>`, `<`, `>=`, `<=`

**Supported chart types:**
- `line`, `bar`, `scatter`, `heatmap`, `box`, `histogram`

## Security

### Authentication
- JWT-based authentication
- Passwords hashed with bcrypt
- Tokens expire after 24 hours

### Data Isolation
- All queries filtered by user_id
- Session-based dataset access
- File uploads validated (CSV only, 10MB max)

### Rate Limiting
- Upload limit: 10 per hour (configurable)
- Execution limit: 100 per hour (configurable)

### Input Validation
- Pydantic schemas validate all requests
- Execution plans validated before running
- No arbitrary code execution possible

## Database

SQLite schema:

```sql
-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
);

-- Datasets
CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    columns JSON NOT NULL,
    column_types JSON NOT NULL,
    uploaded_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Analyses
CREATE TABLE analyses (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    dataset_id TEXT REFERENCES datasets(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    execution_plan JSON NOT NULL,
    result JSON,
    chart_data TEXT,
    filtered_row_count INTEGER,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    executed_at TIMESTAMP
);
```

## Upgrading to Production Database

To switch from SQLite to PostgreSQL:

1. **Update DATABASE_URL in .env:**
```
DATABASE_URL=postgresql://user:password@localhost/wake_analyzer
```

2. **Install PostgreSQL driver:**
```bash
pip install psycopg2-binary
```

3. **Restart application** - tables will be created automatically

## File Storage

Currently uses local filesystem (`./uploads/`).

To upgrade to S3-compatible storage:

1. Install boto3: `pip install boto3`
2. Update `app/services/storage.py` (create abstraction layer)
3. Configure AWS credentials

## Monitoring

### Health Check
```bash
curl http://localhost:8000/health
```

### Logs
```bash
# Docker
docker logs -f wake-analyzer

# Local
# Logs printed to stdout
```

## Testing

Create `tests/test_api.py`:

```bash
pytest tests/
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT secret key | MUST CHANGE IN PRODUCTION |
| `DATABASE_URL` | Database connection string | sqlite:///./wake_analyzer.db |
| `UPLOAD_DIR` | File upload directory | ./uploads |
| `MAX_UPLOAD_SIZE` | Max file size in bytes | 10485760 (10MB) |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:3000 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiration | 1440 (24 hours) |

## Troubleshooting

### Issue: "No module named app"
**Solution:** Run from project root, not from `app/` directory

### Issue: Database locked
**Solution:** SQLite doesn't handle high concurrency well. Upgrade to PostgreSQL for production.

### Issue: Chart generation fails
**Solution:** Ensure matplotlib has write access to temp directory

### Issue: File upload fails
**Solution:** Check `UPLOAD_DIR` exists and is writable

## Performance

### Optimization Tips
1. Use PostgreSQL for production (better concurrency)
2. Mount volumes for persistent data in Docker
3. Use gunicorn/uvicorn workers for parallel requests
4. Consider Redis for rate limiting
5. Use S3 for file storage at scale

## License

MIT License - See parent repository for details
