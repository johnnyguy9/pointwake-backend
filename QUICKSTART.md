# ⚡ Wake Analyzer - Quick Start Guide

Get Wake Analyzer running in **5 minutes** with Docker Compose!

---

## 🎯 What You're Building

**Wake Analyzer** is a conversational data analysis platform with:
- ✅ **Zero AI hallucination** - all results from Python execution
- ✅ **FastAPI backend** with pandas/numpy/sklearn
- ✅ **Next.js frontend** with modern SaaS UI
- ✅ **SQLite database** (upgradeable to PostgreSQL)
- ✅ **Local file storage** (upgradeable to S3)
- ✅ **JWT authentication**
- ✅ **Complete audit trail**

---

## 🚀 Option 1: Docker Compose (FASTEST)

### Prerequisites
- Docker & Docker Compose installed
- Ports 3000 and 8000 available

### Steps

1. **Clone or navigate to the repository**
```bash
cd wake-analyzer
```

2. **Create environment file**
```bash
cp .env.example .env

# Edit .env and change SECRET_KEY!
# Generate a secure key:
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

3. **Start the services**
```bash
docker-compose up -d
```

4. **Check status**
```bash
docker-compose ps
docker-compose logs -f
```

5. **Access the application**
- Frontend: **http://localhost:3000**
- Backend API: **http://localhost:8000**
- API Docs: **http://localhost:8000/docs**

6. **Create your account**
- Go to http://localhost:3000
- Click "Create a new account"
- Register with email, username, password
- Auto-login after registration

7. **Upload CSV and analyze**
- Click "Upload CSV" on dashboard
- Drag and drop your CSV file
- Click on the dataset to start analyzing
- Enter JSON execution plans
- View results and charts

### Stop Services
```bash
docker-compose down
```

### Reset Everything
```bash
docker-compose down -v
rm -rf data/
```

---

## 🛠️ Option 2: Manual Setup (Development)

### Backend Setup

```bash
cd wake-analyzer-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# IMPORTANT: Change SECRET_KEY in .env!

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend running at: **http://localhost:8000**

### Frontend Setup

Open **new terminal**:

```bash
cd wake-analyzer-frontend

# Install dependencies
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run development server
npm run dev
```

Frontend running at: **http://localhost:3000**

---

## 📊 Testing the System

### 1. Register Account
- Go to http://localhost:3000
- Click "Create a new account"
- Fill in email, username, password
- Submit

### 2. Upload CSV
Example CSV content (`test_data.csv`):
```csv
name,age,department,salary
Alice,28,Engineering,95000
Bob,35,Engineering,110000
Charlie,42,Management,125000
Diana,31,Engineering,98000
Eve,29,Marketing,75000
```

- Click "Upload CSV" button
- Select or drag the CSV file
- Wait for upload and analysis

### 3. Execute Analytics

Example execution plan (copy-paste into Query Interface):

**Simple Mean:**
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": [],
  "chart_type": "histogram"
}
```

**Grouped Sum:**
```json
{
  "operation": "sum",
  "target_column": "salary",
  "filters": [],
  "group_by": ["department"],
  "chart_type": "bar"
}
```

**Filtered Mean:**
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": [
    {"column": "department", "operator": "==", "value": "Engineering"}
  ]
}
```

**Correlation:**
```json
{
  "operation": "correlation",
  "x_axis": "age",
  "y_axis": "salary",
  "chart_type": "scatter"
}
```

### 4. View Results
- Results appear in the right panel
- Charts display below results
- Execution proof panel shows audit trail (left bottom)

---

## 🔍 Supported Operations

| Operation | Description | Required Fields |
|-----------|-------------|-----------------|
| `mean` | Average value | target_column |
| `sum` | Total sum | target_column |
| `count` | Row count | - |
| `min` | Minimum value | target_column |
| `max` | Maximum value | target_column |
| `std` | Standard deviation | target_column |
| `correlation` | Correlation coefficient | x_axis, y_axis |
| `regression` | Linear regression | x_axis, y_axis |
| `forecast` | Time series forecast | time_column, target_column |

### Operators
- `==` Equal to
- `!=` Not equal to
- `>` Greater than
- `<` Less than
- `>=` Greater than or equal
- `<=` Less than or equal

### Chart Types
- `histogram` - Distribution histogram
- `bar` - Bar chart
- `line` - Line chart
- `scatter` - Scatter plot
- `box` - Box plot
- `heatmap` - Correlation heatmap

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill process if needed
kill -9 <PID>

# Or use different port
uvicorn app.main:app --port 8001
```

### Frontend won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

### Docker issues
```bash
# View logs
docker-compose logs backend
docker-compose logs frontend

# Restart services
docker-compose restart

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### "Network Error" in frontend
- Check backend is running: `curl http://localhost:8000/health`
- Check NEXT_PUBLIC_API_URL is set correctly
- Check CORS settings in backend .env

### CSV upload fails
- Ensure file is valid CSV format
- Check file size < 10MB
- Verify backend UPLOAD_DIR exists and is writable

### JWT token expired
- Tokens expire after 24 hours
- Click "Sign out" and login again
- Or increase ACCESS_TOKEN_EXPIRE_MINUTES in backend .env

---

## 📁 Data Location

### Docker Compose
- Database: `./data/database/wake_analyzer.db`
- Uploads: `./data/uploads/`

### Manual Setup
- Database: `wake-analyzer-backend/wake_analyzer.db`
- Uploads: `wake-analyzer-backend/uploads/`

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] Change SECRET_KEY to strong random value
- [ ] Enable HTTPS (use nginx/Caddy reverse proxy)
- [ ] Set DEBUG=false in backend
- [ ] Update ALLOWED_ORIGINS to production domain
- [ ] Use PostgreSQL instead of SQLite
- [ ] Use S3 for file storage
- [ ] Enable database backups
- [ ] Add rate limiting
- [ ] Set up monitoring (logs, errors, performance)

---

## 📖 Next Steps

1. **Read the full documentation**
   - Backend: `wake-analyzer-backend/README.md`
   - Full system: `WAKE_ANALYZER_STANDALONE.md`

2. **Explore the API**
   - Visit http://localhost:8000/docs
   - Try API endpoints directly

3. **Test with your own data**
   - Upload real CSV files
   - Create custom execution plans
   - Review execution proof panel

4. **Deploy to production**
   - See deployment section in WAKE_ANALYZER_STANDALONE.md
   - Consider Railway, Fly.io, or DigitalOcean

---

## 🆘 Get Help

- Check `WAKE_ANALYZER_STANDALONE.md` for detailed docs
- Review `wake-analyzer-backend/README.md` for API reference
- Check backend logs: `docker-compose logs backend`
- Check frontend logs: `docker-compose logs frontend`
- View browser console for frontend errors (F12)

---

## ✅ Success Indicators

You know it's working when:
- ✅ Frontend loads at http://localhost:3000
- ✅ Backend health check returns: http://localhost:8000/health
- ✅ You can register and login
- ✅ You can upload a CSV file
- ✅ You can execute a plan and see results
- ✅ Charts display correctly
- ✅ Execution proof panel shows audit trail

---

**🎉 You're ready! Upload a CSV and start analyzing!**

---

## 🏗️ Project Structure

```
.
├── wake-analyzer-backend/       # FastAPI + Python backend
│   ├── app/
│   │   ├── api/                 # API routes
│   │   ├── core/                # Config, DB, security
│   │   ├── models/              # Database models
│   │   ├── services/            # Business logic
│   │   └── main.py              # App entry point
│   ├── Dockerfile
│   └── requirements.txt
│
├── wake-analyzer-frontend/      # Next.js + React frontend
│   ├── src/
│   │   ├── app/                 # Pages (App Router)
│   │   ├── components/          # React components
│   │   ├── lib/                 # Utilities
│   │   ├── types/               # TypeScript types
│   │   └── contexts/            # React contexts
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml           # Full stack orchestration
├── .env.example                 # Environment template
├── QUICKSTART.md                # This file
└── WAKE_ANALYZER_STANDALONE.md  # Complete documentation
```

---

**Built with ❤️ for data analysts who demand accuracy**
