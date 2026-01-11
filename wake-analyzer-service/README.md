# Wake Analyzer Service

Python microservice for executing data analytics operations.

## Overview

Wake Analyzer is a **Conversational Data Analysis Platform** that provides:
- Strict execution plan validation
- Pandas-powered analytics execution
- Chart generation (matplotlib/seaborn)
- Zero AI hallucination guarantee (all results from Python)

## Architecture

```
Node.js Backend → HTTP → Python Service → pandas/numpy/sklearn
                                        → Results + Charts
```

## Installation

```bash
cd wake-analyzer-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running

```bash
# Development
FLASK_ENV=development python run.py

# Production
gunicorn -w 4 -b 0.0.0.0:5000 app.main:app
```

## Environment Variables

- `WAKE_ANALYZER_PORT` - Service port (default: 5000)
- `UPLOAD_FOLDER` - CSV upload directory (default: /tmp/wake-analyzer-uploads)
- `FLASK_ENV` - Set to 'development' for debug mode

## API Endpoints

### `GET /health`
Health check

### `POST /upload`
Upload CSV file and get metadata
- Form data: `file` (CSV file)
- Returns: session_id, columns, types, row count, preview

### `POST /validate`
Validate execution plan without executing
- Body: execution plan JSON
- Returns: validation result with errors/warnings

### `POST /execute`
Execute validated analytics plan
- Body: `{ session_id, plan }`
- Returns: numerical results and optional chart (base64)

### `GET /session/:id`
Get session metadata

### `DELETE /session/:id`
Delete session and associated file

## Execution Plan Schema

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

## Security

- No code execution beyond plan schema
- File uploads validated (CSV only)
- Session isolation
- No SQL injection risk (pandas-based)
- Input sanitization on all endpoints

## Testing

```bash
# Upload CSV
curl -X POST http://localhost:5000/upload \
  -F "file=@data.csv"

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
