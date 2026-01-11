# Wake Analyzer Integration Guide

## Overview

Wake Analyzer is a **Conversational Data Analysis Platform** integrated into the PointWake backend. It provides production-grade analytics with **zero AI hallucination** by ensuring all numerical results come from Python execution (pandas/numpy/sklearn).

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  React Frontend │─────▶│  Node.js Backend │─────▶│  Python Microservice│
│  (TypeScript)   │      │  (Express + Auth)│      │  (Flask + pandas)   │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
        │                         │                          │
        │                         │                          │
        ▼                         ▼                          ▼
   UI Components            PostgreSQL DB              Analytics Engine
   - Upload CSV             - Datasets table            - Plan Validator
   - Execute Plans          - Analyses table            - Execution Engine
   - View Results           - Multi-tenant              - Chart Generator
```

## Core Principles

1. **All numerical results MUST come from Python execution**
2. **No AI can fabricate or infer results**
3. **Claude acts ONLY as a planner (generates JSON plans)**
4. **Execution authority belongs solely to the Python engine**
5. **Charts and numbers come from the same filtered dataset**

## System Components

### 1. Python Microservice (`wake-analyzer-service/`)

**Location:** `/wake-analyzer-service`

**Components:**
- `app/plan_validator.py` - Validates execution plans against strict schema
- `app/execution_engine.py` - Executes analytics using pandas/numpy/sklearn
- `app/main.py` - Flask application with REST API

**Dependencies:**
```
flask, pandas, numpy, scikit-learn, statsmodels, matplotlib, seaborn
```

**Endpoints:**
- `GET /health` - Health check
- `POST /upload` - Upload CSV and get metadata
- `POST /validate` - Validate execution plan
- `POST /execute` - Execute analytics plan
- `GET /session/:id` - Get session metadata
- `DELETE /session/:id` - Delete session

### 2. Node.js Backend Integration

**Service Layer:** `server/services/WakeAnalyzerService.ts`
- Communicates with Python microservice via HTTP
- Handles file upload and storage
- Manages database persistence
- Enforces multi-tenant security

**API Routes:** `server/routes.ts`
- All routes under `/api/wake-analyzer/*`
- Protected by authentication middleware
- Integrates with existing user/account system

**Database Schema:** `shared/schema.ts`
```typescript
// Datasets table
wakeAnalyzerDatasets {
  id, accountId, userId, sessionId,
  filename, filePath, rowCount, columnCount,
  columns, columnTypes, uploadedAt, expiresAt
}

// Analyses table
wakeAnalyzerAnalyses {
  id, accountId, userId, datasetId, sessionId,
  executionPlan, result, chartData,
  filteredRowCount, executionTimeMs,
  success, errorMessage, executedAt
}
```

### 3. React Frontend

**Page:** `client/src/pages/wake-analyzer.tsx`
- Upload CSV datasets
- Execute analytics plans (JSON input)
- View results and charts
- Browse analysis history

**Navigation:** Added to sidebar under "Management"

## Execution Plan Schema

All analytics requests must be formatted as JSON execution plans:

```json
{
  "operation": "mean | sum | count | min | max | std | correlation | regression | forecast",
  "target_column": "string | null",
  "filters": [
    {
      "column": "string",
      "operator": "== | != | > | < | >= | <=",
      "value": "string | number"
    }
  ],
  "group_by": ["string"],
  "time_column": "string | null",
  "x_axis": "string | null",
  "y_axis": "string | null",
  "chart_type": "line | bar | scatter | heatmap | box | histogram | null",
  "requires_clarification": false,
  "clarification_question": null
}
```

### Example Plans

**Simple Mean:**
```json
{
  "operation": "mean",
  "target_column": "age",
  "filters": [],
  "chart_type": "histogram"
}
```

**Filtered Aggregation with Grouping:**
```json
{
  "operation": "sum",
  "target_column": "revenue",
  "filters": [
    {"column": "status", "operator": "==", "value": "active"}
  ],
  "group_by": ["region"],
  "chart_type": "bar"
}
```

**Correlation Analysis:**
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
  "chart_type": "scatter"
}
```

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd wake-analyzer-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Update Node.js Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Add to your `.env` or Replit Secrets:

```bash
# Wake Analyzer Configuration
WAKE_ANALYZER_SERVICE_URL=http://localhost:5000
WAKE_ANALYZER_UPLOAD_DIR=/tmp/wake-analyzer-uploads
WAKE_ANALYZER_PORT=5000
```

### 4. Push Database Schema

```bash
npm run db:push
```

This creates the `wake_analyzer_datasets` and `wake_analyzer_analyses` tables.

### 5. Start Services

**Terminal 1 - Python Service:**
```bash
cd wake-analyzer-service
source venv/bin/activate
python run.py
```

**Terminal 2 - Node.js Backend:**
```bash
npm run dev
```

### 6. Access Wake Analyzer

1. Login to PointWake
2. Navigate to "Wake Analyzer" in the sidebar
3. Upload a CSV file
4. Execute analytics plans

## Production Deployment

### Python Service (Option 1: Gunicorn)

```bash
cd wake-analyzer-service
gunicorn -w 4 -b 0.0.0.0:5000 app.main:app
```

### Python Service (Option 2: Docker)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY wake-analyzer-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY wake-analyzer-service/ .

EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app.main:app"]
```

### Environment Variables (Production)

```bash
WAKE_ANALYZER_SERVICE_URL=http://wake-analyzer-service:5000
WAKE_ANALYZER_UPLOAD_DIR=/var/wake-analyzer/uploads
NODE_ENV=production
```

## Security Considerations

1. **File Upload:** Only CSV files accepted, max 10MB
2. **Authentication:** All endpoints require valid user session
3. **Multi-tenancy:** All queries filtered by accountId
4. **No Code Execution:** Only predefined operations allowed
5. **Input Validation:** Plans validated before execution
6. **Session Isolation:** Each dataset has unique session ID
7. **Data Expiration:** Datasets auto-expire after 24 hours

## Validation Rules

The Python validator enforces:

1. Valid operation type
2. Required fields for each operation
3. Proper filter structure
4. Valid operators (==, !=, >, <, >=, <=)
5. Valid chart types
6. Clarification requirements

Invalid plans are rejected with detailed error messages.

## Error Handling

All execution errors are:
1. Caught and logged
2. Stored in the database
3. Returned to the user with context
4. Never cause system crashes

Example error response:
```json
{
  "success": false,
  "error": "Column 'invalid_col' not found in dataset"
}
```

## Governance & Auditability

Every execution is logged:
- **Who:** userId and accountId
- **What:** Full execution plan (JSON)
- **When:** Timestamp with millisecond precision
- **Result:** Success/failure, numerical output, chart data
- **Performance:** Execution time in milliseconds

This creates a full audit trail for compliance.

## Testing

### Test Python Service

```bash
# Upload CSV
curl -X POST http://localhost:5000/upload \
  -F "file=@test_data.csv"

# Execute plan
curl -X POST http://localhost:5000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc123",
    "plan": {
      "operation": "mean",
      "target_column": "age",
      "filters": []
    }
  }'
```

### Test via UI

1. Navigate to `/wake-analyzer`
2. Upload a sample CSV
3. Create a JSON plan in the "Analyze" tab
4. Click "Execute Plan"
5. View results and charts

## Troubleshooting

### Python service not responding
- Check if Python service is running: `curl http://localhost:5000/health`
- Verify port 5000 is not in use
- Check Python service logs

### Upload fails
- Verify file is valid CSV
- Check file size < 10MB
- Ensure upload directory exists and is writable

### Execution fails
- Validate JSON plan syntax
- Check column names match dataset
- Verify filter values match column types
- Review error message for details

### Charts not displaying
- Ensure matplotlib/seaborn installed
- Check browser console for image loading errors
- Verify base64 data is valid

## Future Enhancements

Potential improvements:
1. Natural language query parsing (integrate Claude API)
2. Saved query templates
3. Scheduled executions
4. Export results to PDF/Excel
5. Real-time collaboration
6. Advanced ML operations (clustering, classification)
7. Integration with external data sources

## Support

For issues or questions:
1. Check logs: Python service and Node.js backend
2. Review execution history in database
3. Test Python service endpoints directly
4. Verify environment variables are set
