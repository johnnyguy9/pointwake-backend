# Wake Analyzer - Standalone Application

## 🎯 Overview

Wake Analyzer is a **standalone conversational data analysis platform** built with:
- **Backend**: Python 3.11 + FastAPI
- **Frontend**: Next.js 14 + Tailwind CSS
- **Database**: SQLite (upgradeable to PostgreSQL)
- **Storage**: Local filesystem (upgradeable to S3)
- **Auth**: JWT tokens

**Core Principle**: All numerical results come from Python execution - **ZERO AI hallucination**.

---

## 📁 Repository Structure

```
wake-analyzer-backend/         # FastAPI Python backend
├── app/
│   ├── api/                   # API route handlers
│   │   ├── auth.py            # Authentication (register/login)
│   │   └── analytics.py       # Upload, validate, execute
│   ├── core/                  # Core application logic
│   │   ├── config.py          # Settings management
│   │   ├── database.py        # SQLAlchemy setup
│   │   ├── security.py        # JWT & password hashing
│   │   └── schemas.py         # Pydantic models
│   ├── models/                # Database models
│   │   ├── user.py            # User authentication
│   │   ├── dataset.py         # Uploaded CSV metadata
│   │   └── analysis.py        # Execution history
│   ├── services/              # Business logic
│   │   ├── execution_engine.py  # Analytics (pandas/numpy/sklearn)
│   │   └── plan_validator.py   # Plan validation
│   └── main.py                # FastAPI app entry point
├── Dockerfile                 # Docker container
├── requirements.txt           # Python dependencies
└── README.md                  # Backend documentation

wake-analyzer-frontend/        # Next.js frontend
├── src/
│   ├── app/                   # Next.js 14 app router
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   ├── types/                 # TypeScript types
│   └── contexts/              # React contexts
├── package.json
├── next.config.js
└── tailwind.config.js
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (optional)

### 1. Start Backend

```bash
cd wake-analyzer-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure
cp .env.example .env
# IMPORTANT: Change SECRET_KEY in .env!

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend now running at: http://localhost:8000
API docs: http://localhost:8000/docs

### 2. Start Frontend

```bash
cd wake-analyzer-frontend

# Install dependencies
npm install

# Configure
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run development server
npm run dev
```

Frontend now running at: http://localhost:3000

### 3. Test the System

1. Go to http://localhost:3000
2. Register a new account
3. Upload a CSV file
4. Execute an analytics plan
5. View results and charts

---

## 🐳 Docker Deployment

### Backend Only

```bash
cd wake-analyzer-backend

docker build -t wake-analyzer-backend .

docker run -d \
  -p 8000:8000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/wake_analyzer.db:/app/wake_analyzer.db \
  -e SECRET_KEY="your-secure-random-key" \
  --name wake-analyzer-backend \
  wake-analyzer-backend
```

### Full Stack (Docker Compose)

Create `docker-compose.yml` in root:

```yaml
version: '3.8'

services:
  backend:
    build: ./wake-analyzer-backend
    ports:
      - "8000:8000"
    volumes:
      - ./data/uploads:/app/uploads
      - ./data/database:/app
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=sqlite:///./wake_analyzer.db
      - ALLOWED_ORIGINS=http://localhost:3000
    restart: unless-stopped

  frontend:
    build: ./wake-analyzer-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

---

## 📋 API Documentation

### Authentication

**POST /api/auth/register**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "securepass123",
  "full_name": "Full Name"
}
```
Returns: User object

**POST /api/auth/login**
```json
{
  "username": "username",
  "password": "securepass123"
}
```
Returns: `{"access_token": "...", "token_type": "bearer"}`

**GET /api/auth/me**
Headers: `Authorization: Bearer {token}`
Returns: Current user info

### Analytics

**POST /api/analytics/upload**
Headers: `Authorization: Bearer {token}`
Body: `multipart/form-data` with `file` field (CSV)
Returns:
```json
{
  "success": true,
  "session_id": "wa_1234567890_abcdef",
  "metadata": {
    "columns": ["col1", "col2"],
    "column_types": {"col1": "int64", "col2": "object"},
    "row_count": 1000,
    "preview": [...]
  }
}
```

**POST /api/analytics/validate**
Headers: `Authorization: Bearer {token}`
Body: Execution plan JSON
Returns: `{"valid": true/false, "errors": [], "warnings": []}`

**POST /api/analytics/execute**
Headers: `Authorization: Bearer {token}`
Body:
```json
{
  "session_id": "wa_1234567890_abcdef",
  "plan": {
    "operation": "mean",
    "target_column": "age",
    "filters": [
      {"column": "status", "operator": "==", "value": "active"}
    ],
    "chart_type": "histogram"
  }
}
```
Returns:
```json
{
  "success": true,
  "operation": "mean",
  "result": 42.5,
  "chart": "data:image/png;base64,...",
  "filtered_row_count": 850
}
```

**GET /api/analytics/datasets**
Headers: `Authorization: Bearer {token}`
Returns: Array of user's datasets

**GET /api/analytics/history/{session_id}**
Headers: `Authorization: Bearer {token}`
Returns: Array of analysis executions for dataset

**DELETE /api/analytics/datasets/{session_id}**
Headers: `Authorization: Bearer {token}`
Returns: 204 No Content

---

## 🔐 Security

### Authentication
- JWT tokens with bcrypt password hashing
- Tokens expire after 24 hours (configurable)
- All analytics endpoints require authentication

### Data Isolation
- Users can only access their own datasets
- Session-based access control
- File uploads validated (CSV only, 10MB max)

### Input Validation
- Pydantic schemas validate all requests
- Execution plans validated before running
- No arbitrary code execution possible
- Rate limiting on uploads and executions

### Production Checklist
- [ ] Change `SECRET_KEY` to strong random value
- [ ] Enable HTTPS (reverse proxy like nginx/Caddy)
- [ ] Set `DEBUG=false`
- [ ] Use PostgreSQL instead of SQLite
- [ ] Use S3 for file storage
- [ ] Add rate limiting middleware
- [ ] Enable database backups
- [ ] Monitor logs and errors

---

## 📊 Execution Plan Schema

All analytics requests must follow this schema:

```typescript
{
  operation: "mean" | "sum" | "count" | "min" | "max" | "std" | "correlation" | "regression" | "forecast",
  target_column?: string,
  filters: [
    {
      column: string,
      operator: "==" | "!=" | ">" | "<" | ">=" | "<=",
      value: any
    }
  ],
  group_by?: string[],
  time_column?: string,     // For forecast
  x_axis?: string,          // For correlation/regression
  y_axis?: string,          // For correlation/regression
  chart_type?: "line" | "bar" | "scatter" | "heatmap" | "box" | "histogram",
  requires_clarification?: boolean,
  clarification_question?: string
}
```

### Example Plans

**Simple Mean:**
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": []
}
```

**Grouped Aggregation:**
```json
{
  "operation": "sum",
  "target_column": "revenue",
  "filters": [
    {"column": "year", "operator": "==", "value": 2024}
  ],
  "group_by": ["region"],
  "chart_type": "bar"
}
```

**Correlation:**
```json
{
  "operation": "correlation",
  "x_axis": "age",
  "y_axis": "income",
  "chart_type": "scatter"
}
```

**Linear Regression:**
```json
{
  "operation": "regression",
  "x_axis": "years_experience",
  "y_axis": "salary",
  "filters": [
    {"column": "department", "operator": "==", "value": "Engineering"}
  ],
  "chart_type": "scatter"
}
```

---

## 🔄 Upgrade Paths

### From SQLite to PostgreSQL

1. Install driver:
```bash
pip install psycopg2-binary
```

2. Update `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/wake_analyzer
```

3. Restart application (tables created automatically)

### From Local Storage to S3

1. Install boto3:
```bash
pip install boto3
```

2. Create storage abstraction layer in `app/services/storage.py`

3. Update upload logic to use S3

4. Set S3 credentials in environment

### Add Redis Rate Limiting

1. Install dependencies:
```bash
pip install redis slowapi
```

2. Add middleware in `app/main.py`

3. Configure Redis connection

---

## 🧪 Testing

Create `tests/test_api.py`:

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_register():
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpass123"
    })
    assert response.status_code == 201

# Add more tests...
```

Run:
```bash
pytest tests/
```

---

## 🐛 Troubleshooting

### Backend Issues

**Issue**: Database locked
**Solution**: SQLite doesn't handle concurrency well. Use PostgreSQL for production.

**Issue**: Module not found
**Solution**: Ensure you're running from project root, not from `app/` directory.

**Issue**: Chart generation fails
**Solution**: Check matplotlib has write access to temp directory.

### Frontend Issues

**Issue**: API calls fail with CORS error
**Solution**: Add frontend URL to `ALLOWED_ORIGINS` in backend `.env`.

**Issue**: "Network Error"
**Solution**: Verify `NEXT_PUBLIC_API_URL` points to running backend.

---

## 📈 Performance Tips

1. **Use PostgreSQL** for production (better concurrency than SQLite)
2. **Mount persistent volumes** in Docker for data safety
3. **Use gunicorn/uvicorn workers** for parallel requests
4. **Enable caching** for dataset metadata
5. **Use S3** for file storage at scale
6. **Add Redis** for rate limiting and session management
7. **Monitor with Prometheus/Grafana**

---

## 🔧 Development

### Backend Development

```bash
cd wake-analyzer-backend
source venv/bin/activate

# Auto-reload on changes
uvicorn app.main:app --reload

# Run tests
pytest tests/ -v

# Check types
mypy app/
```

### Frontend Development

```bash
cd wake-analyzer-frontend

# Development mode
npm run dev

# Type check
npm run lint

# Build for production
npm run build
npm start
```

---

## 📦 Deployment Options

### Option 1: Railway
- Push to GitHub
- Connect Railway to repo
- Set environment variables
- Deploy automatically

### Option 2: Fly.io
```bash
fly launch
fly deploy
```

### Option 3: DigitalOcean App Platform
- Connect GitHub repo
- Configure build settings
- Deploy

### Option 4: AWS ECS (Advanced)
- Build Docker images
- Push to ECR
- Create ECS task definition
- Deploy service

---

## 📝 License

MIT License - See repository for details

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📞 Support

For issues and questions:
- Open a GitHub issue
- Check API docs at `/docs`
- Review troubleshooting section

---

**Built with ❤️ for data analysts who demand accuracy**
