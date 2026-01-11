# 🧪 Wake Analyzer - Validation Plan

**STATUS**: User Validation Mode - NO EXPANSION UNTIL VALIDATION PASSES

---

## 🎯 Validation Objectives

1. **Correctness** - All numerical results match Python ground truth
2. **UX Clarity** - Users understand what's happening without knowing Python
3. **Execution Integrity** - Audit trail is complete and trustworthy
4. **Error Handling** - System handles invalid inputs gracefully
5. **Session Isolation** - No data leakage between users

---

## 📋 Validation Checklist

### Phase 1: Basic Functionality
- [ ] CSV upload works (drag-and-drop + file picker)
- [ ] Schema detection is accurate (columns, types, row count)
- [ ] Data Health Report displays correctly
- [ ] Dataset list shows on dashboard
- [ ] Navigation works (dashboard ↔ analyze page)

### Phase 2: Analytics Execution
- [ ] Simple aggregations (mean, sum, count)
- [ ] Filtered aggregations
- [ ] Grouped aggregations
- [ ] Correlation analysis
- [ ] Linear regression
- [ ] Chart generation

### Phase 3: Results Verification
- [ ] Numerical results match manual calculations
- [ ] Charts align with computed values
- [ ] Execution proof panel updates
- [ ] Audit trail is complete
- [ ] Results are human-readable

### Phase 4: Error Handling
- [ ] Invalid column names handled
- [ ] Missing required fields caught
- [ ] Invalid operators rejected
- [ ] Empty dataset filtered handled
- [ ] Type mismatches caught

### Phase 5: Session Isolation
- [ ] Users only see their own datasets
- [ ] Concurrent users don't interfere
- [ ] Logout clears session properly

---

## 🧪 Test Datasets

### Dataset 1: Sales Data (test_sales.csv)
**Purpose**: Basic aggregations, filtering, grouping

```csv
date,region,product,sales,units
2024-01-01,North,Widget,1200,40
2024-01-01,South,Widget,980,35
2024-01-01,East,Gadget,1500,25
2024-01-02,North,Widget,1100,38
2024-01-02,South,Gadget,1350,22
2024-01-02,East,Widget,1050,36
2024-01-03,North,Gadget,1600,28
2024-01-03,South,Widget,900,32
2024-01-03,East,Gadget,1400,24
```

**Expected Results**:
- Total sales: 11,080
- Average sales: 1,231.11
- North region total: 3,900
- Widget product count: 5

### Dataset 2: Employee Data (test_employees.csv)
**Purpose**: Correlation, regression, segmentation

```csv
employee_id,name,age,department,years_experience,salary,performance_score
E001,Alice,28,Engineering,3,95000,4.2
E002,Bob,35,Engineering,8,110000,4.5
E003,Charlie,42,Management,15,125000,4.8
E004,Diana,31,Engineering,5,98000,4.3
E005,Eve,29,Marketing,4,75000,3.9
E006,Frank,38,Engineering,10,115000,4.6
E007,Grace,33,Marketing,6,82000,4.1
E008,Henry,45,Management,18,135000,4.9
E009,Ivy,27,Engineering,2,88000,4.0
E010,Jack,36,Marketing,7,85000,4.2
```

**Expected Results**:
- Average salary: 100,800
- Engineering average: 101,200
- Correlation (years_experience vs salary): ~0.95
- Regression slope: ~4,500 (salary increases ~$4.5K per year of experience)

### Dataset 3: Product Performance (test_products.csv)
**Purpose**: Outlier detection, small dataset handling

```csv
product,price,units_sold,revenue,rating
ProductA,29.99,1200,35988,4.5
ProductB,49.99,850,42491.5,4.7
ProductC,19.99,2100,41979,4.3
ProductD,99.99,150,14998.5,3.8
ProductE,39.99,950,37990.5,4.6
```

**Expected Results**:
- ProductD is outlier (low units_sold)
- Average rating: 4.38
- Total revenue: 173,447.5

### Dataset 4: Edge Cases (test_edge.csv)
**Purpose**: Missing data, mixed types, small dataset

```csv
id,value,category
1,100,A
2,200,B
3,150,A
```

**Expected Results**:
- Count: 3
- Mean value: 150
- Category A count: 2

---

## 🎯 Must-Pass Scenarios

### Scenario 1: Simple Aggregation
**Business Question**: "What's the average salary?"

**Execution Plan**:
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": []
}
```

**Expected Result**: 100,800
**Validation**: Manual calculation matches

---

### Scenario 2: Filtered Aggregation
**Business Question**: "What's the total sales in the North region?"

**Execution Plan**:
```json
{
  "operation": "sum",
  "target_column": "sales",
  "filters": [
    {"column": "region", "operator": "==", "value": "North"}
  ]
}
```

**Expected Result**: 3,900
**Validation**: Sum of North region = 1200 + 1100 + 1600 = 3,900

---

### Scenario 3: Grouped Aggregation
**Business Question**: "What's the average sales by region?"

**Execution Plan**:
```json
{
  "operation": "mean",
  "target_column": "sales",
  "filters": [],
  "group_by": ["region"],
  "chart_type": "bar"
}
```

**Expected Result**:
```json
{
  "North": 1300,
  "South": 1076.67,
  "East": 1316.67
}
```

**Validation**:
- North: (1200 + 1100 + 1600) / 3 = 1300
- South: (980 + 1350 + 900) / 3 = 1076.67
- East: (1500 + 1050 + 1400) / 3 = 1316.67

---

### Scenario 4: Correlation
**Business Question**: "Is there a relationship between experience and salary?"

**Execution Plan**:
```json
{
  "operation": "correlation",
  "x_axis": "years_experience",
  "y_axis": "salary",
  "chart_type": "scatter"
}
```

**Expected Result**: correlation_coefficient ≈ 0.95 (strong positive)
**Validation**: Visual scatter plot shows clear upward trend

---

### Scenario 5: Linear Regression
**Business Question**: "How much does salary increase per year of experience?"

**Execution Plan**:
```json
{
  "operation": "regression",
  "x_axis": "years_experience",
  "y_axis": "salary",
  "chart_type": "scatter"
}
```

**Expected Result**:
- slope: ~4,500
- intercept: ~75,000
- r_squared: ~0.90

**Validation**: For each year of experience, salary increases by ~$4,500

---

### Scenario 6: Count with Filter
**Business Question**: "How many engineering employees are there?"

**Execution Plan**:
```json
{
  "operation": "count",
  "filters": [
    {"column": "department", "operator": "==", "value": "Engineering"}
  ]
}
```

**Expected Result**: 5
**Validation**: Count Engineering rows in CSV

---

## ❌ Error Handling Tests

### Error 1: Invalid Column Name
**Execution Plan**:
```json
{
  "operation": "mean",
  "target_column": "non_existent_column",
  "filters": []
}
```

**Expected Behavior**:
- Error message: "Column 'non_existent_column' not found in dataset"
- Execution marked as failed
- No crash or data corruption

---

### Error 2: Missing Required Field
**Execution Plan**:
```json
{
  "operation": "correlation",
  "x_axis": "age"
}
```

**Expected Behavior**:
- Error message: "Operation 'correlation' requires both x_axis and y_axis"
- Validation catches it before execution

---

### Error 3: Type Mismatch
**Execution Plan**:
```json
{
  "operation": "mean",
  "target_column": "name",
  "filters": []
}
```

**Expected Behavior**:
- Error message about non-numeric column
- Clear explanation

---

### Error 4: Empty Result Set
**Execution Plan**:
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": [
    {"column": "department", "operator": "==", "value": "NonExistentDept"}
  ]
}
```

**Expected Behavior**:
- Error message: "Filters resulted in empty dataset"
- No division by zero errors

---

## 🧑‍💼 "Python for Dummies" Test

### Test 1: No Technical Jargon
**User sees**: "Average salary for Engineering department"
**User does NOT see**: "pandas.DataFrame.groupby().mean()"

### Test 2: Business Language
**User asks**: "What's the relationship between experience and pay?"
**System responds**: "Correlation coefficient: 0.95 (strong positive relationship)"
**NOT**: "Pearson r = 0.95, p < 0.001"

### Test 3: Assumptions Explained
**When showing regression**:
- "For each additional year of experience, salary increases by approximately $4,500"
- "This linear model explains 90% of salary variation"

### Test 4: Chart Labels
- X-axis: "Years of Experience" (not "x_axis")
- Y-axis: "Salary ($)" (not "y_axis")
- Title: "Salary vs Experience - Linear Regression" (not "Scatter Plot")

---

## ✅ Validation Success Criteria

### Numerical Correctness
- [ ] All results match manual calculations (±0.01 for rounding)
- [ ] Charts accurately represent computed values
- [ ] No silent failures or incorrect results

### UX Clarity
- [ ] Users understand what each result means
- [ ] Error messages are helpful, not cryptic
- [ ] No technical jargon in user-facing text
- [ ] Execution proof panel makes sense to non-technical users

### Execution Integrity
- [ ] Every execution is logged
- [ ] Audit trail shows all details
- [ ] Success/failure is clear
- [ ] Timestamps are accurate

### Error Handling
- [ ] Invalid inputs caught before execution
- [ ] Clear error messages
- [ ] No system crashes
- [ ] Failed executions logged properly

### Session Isolation
- [ ] User A cannot see User B's datasets
- [ ] Concurrent uploads don't interfere
- [ ] Logout clears all session data

---

## 📊 Validation Workflow

### Step 1: Environment Setup
```bash
# Start services
docker-compose up -d

# Verify health
curl http://localhost:8000/health
# Should return: {"status": "healthy", ...}
```

### Step 2: Create Test User
1. Go to http://localhost:3000
2. Register: testuser / test@example.com / SecurePass123
3. Login successfully
4. Verify dashboard loads

### Step 3: Upload Test Datasets
1. Upload test_sales.csv
2. Verify: 9 rows, 5 columns detected
3. Verify: column types are correct
4. Upload test_employees.csv
5. Verify: 10 rows, 7 columns detected

### Step 4: Execute Must-Pass Scenarios
For each scenario:
1. Copy execution plan
2. Paste into Query Interface
3. Click "Execute Plan"
4. Verify result matches expected
5. Check execution proof panel
6. Verify chart (if applicable)

### Step 5: Execute Error Tests
For each error test:
1. Execute invalid plan
2. Verify error is caught
3. Verify error message is clear
4. Verify no system crash
5. Verify execution logged as failed

### Step 6: Verify Execution Proof
1. Check execution proof panel shows all executions
2. Verify success/failure indicators
3. Verify execution times
4. Verify result previews
5. Verify no missing data

### Step 7: Session Isolation Test
1. Open incognito window
2. Register second user
3. Upload different dataset
4. Verify first user can't see it
5. Verify no cross-contamination

---

## 🐛 Issue Tracking

### Found Issues
Document any validation failures here:

**Issue Template**:
```
ISSUE #: [number]
SCENARIO: [which test]
EXPECTED: [what should happen]
ACTUAL: [what actually happened]
SEVERITY: [Critical / High / Medium / Low]
BLOCKER: [Yes / No]
```

---

## ✅ Sign-Off

Validation complete when:
- [ ] All must-pass scenarios pass
- [ ] All error handling tests pass
- [ ] "Python for Dummies" test passes
- [ ] Session isolation confirmed
- [ ] Zero critical or high-severity blockers
- [ ] UX is clear and intuitive
- [ ] Numerical correctness verified

**Validated by**: _______________
**Date**: _______________
**Deployment Authorization**: _______________

---

**NO DEPLOYMENT UNTIL THIS CHECKLIST IS 100% COMPLETE**
