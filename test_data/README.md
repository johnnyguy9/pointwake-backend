# Wake Analyzer - Test Data for Validation

This directory contains curated test datasets and tools for **systematic validation** of Wake Analyzer.

---

## 📁 Test Datasets

### test_sales.csv
**Size**: 9 rows × 5 columns
**Purpose**: Basic aggregations, filtering, grouping
**Columns**: date, region, product, sales, units

**Use for testing**:
- Sum, mean, count operations
- Filtering by region/product
- Grouped aggregations
- Bar charts

---

### test_employees.csv
**Size**: 10 rows × 7 columns
**Purpose**: Correlation, regression, segmentation
**Columns**: employee_id, name, age, department, years_experience, salary, performance_score

**Use for testing**:
- Correlation analysis (experience vs salary)
- Linear regression
- Department segmentation
- Scatter plots

---

### test_products.csv
**Size**: 5 rows × 5 columns
**Purpose**: Outlier detection, small datasets
**Columns**: product, price, units_sold, revenue, rating

**Use for testing**:
- Small dataset handling
- Outlier detection
- Min/max operations
- Edge cases

---

### test_edge.csv
**Size**: 3 rows × 3 columns
**Purpose**: Minimal dataset, edge cases
**Columns**: id, value, category

**Use for testing**:
- Very small datasets
- Simple operations
- Edge case handling

---

## 🧮 Ground Truth Calculator

Run `ground_truth_calculator.py` to calculate expected results:

```bash
cd test_data
python3 ground_truth_calculator.py
```

This script uses **pandas, numpy, and scikit-learn** (the same libraries Wake Analyzer uses) to calculate ground truth values.

**Output includes**:
- All expected numerical results
- Correlation coefficients
- Regression parameters
- Grouped aggregations
- Outlier detection results

**Use this to verify**:
- Wake Analyzer results match Python calculations
- No rounding errors beyond ±0.01
- All operations are correct

---

## ✅ Validation Workflow

### Step 1: Calculate Ground Truth
```bash
python3 ground_truth_calculator.py > expected_results.txt
```

### Step 2: Upload to Wake Analyzer
1. Start Wake Analyzer: `docker-compose up -d`
2. Go to http://localhost:3000
3. Register/login
4. Upload each CSV file

### Step 3: Execute Test Plans
Use execution plans from `VALIDATION_PLAN.md` and compare results with `expected_results.txt`

### Step 4: Verify Results
- [ ] Numerical results match (±0.01)
- [ ] Charts display correctly
- [ ] Execution proof panel updates
- [ ] No errors or crashes

---

## 🎯 Quick Test Commands

### Test 1: Simple Mean (test_employees.csv)
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": []
}
```
**Expected**: 100,800

---

### Test 2: Filtered Sum (test_sales.csv)
```json
{
  "operation": "sum",
  "target_column": "sales",
  "filters": [
    {"column": "region", "operator": "==", "value": "North"}
  ]
}
```
**Expected**: 3,900

---

### Test 3: Grouped Mean (test_sales.csv)
```json
{
  "operation": "mean",
  "target_column": "sales",
  "group_by": ["region"],
  "chart_type": "bar"
}
```
**Expected**: North: 1300, South: 1076.67, East: 1316.67

---

### Test 4: Correlation (test_employees.csv)
```json
{
  "operation": "correlation",
  "x_axis": "years_experience",
  "y_axis": "salary",
  "chart_type": "scatter"
}
```
**Expected**: correlation_coefficient ≈ 0.95

---

### Test 5: Regression (test_employees.csv)
```json
{
  "operation": "regression",
  "x_axis": "years_experience",
  "y_axis": "salary",
  "chart_type": "scatter"
}
```
**Expected**: slope ≈ 4,500, r_squared ≈ 0.90

---

## ❌ Error Test Cases

### Invalid Column
```json
{
  "operation": "mean",
  "target_column": "invalid_column",
  "filters": []
}
```
**Expected**: Error with message "Column 'invalid_column' not found"

---

### Missing Required Field
```json
{
  "operation": "correlation",
  "x_axis": "age"
}
```
**Expected**: Validation error before execution

---

### Empty Result Set
```json
{
  "operation": "mean",
  "target_column": "salary",
  "filters": [
    {"column": "department", "operator": "==", "value": "NonExistent"}
  ]
}
```
**Expected**: Error "Filters resulted in empty dataset"

---

## 📊 Expected Results Summary

### test_sales.csv
- Total sales: 11,080
- Average sales: 1,231.11
- North total: 3,900
- Widget count: 5
- North mean: 1,300
- South mean: 1,076.67
- East mean: 1,316.67

### test_employees.csv
- Average salary: $100,800
- Min salary: $75,000
- Max salary: $135,000
- Engineering avg: $101,200
- Correlation (exp vs salary): 0.95
- Regression slope: ~$4,500/year
- R-squared: ~0.90

### test_products.csv
- Total revenue: $173,447.50
- Average rating: 4.38
- Outlier: ProductD (150 units)

### test_edge.csv
- Count: 3
- Mean value: 150
- Category A count: 2

---

## ✅ Validation Sign-Off

After testing all scenarios:
- [ ] All numerical results verified
- [ ] All charts verified
- [ ] All error cases handled
- [ ] Execution proof complete
- [ ] No crashes or silent failures

**Validated by**: _______________
**Date**: _______________

**STATUS**: PASS / FAIL

---

## 🚨 Critical Notes

1. **Rounding**: Results may differ by ±0.01 due to floating-point precision
2. **Chart visual**: Verify charts match computed values visually
3. **Execution proof**: Every execution must appear in audit trail
4. **Error messages**: Must be clear and helpful, not cryptic
5. **No Python**: Users should never see Python code or technical jargon

---

**USE THESE FILES TO VALIDATE BEFORE DEPLOYMENT**
