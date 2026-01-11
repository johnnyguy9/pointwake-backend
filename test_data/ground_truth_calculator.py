#!/usr/bin/env python3
"""
Ground Truth Calculator
Calculates expected results for validation testing
Run this to verify Wake Analyzer results match Python calculations
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

print("=" * 60)
print("GROUND TRUTH CALCULATOR - Wake Analyzer Validation")
print("=" * 60)

# ========== SALES DATA ==========
print("\n📊 SALES DATA (test_sales.csv)")
print("-" * 60)

sales_df = pd.read_csv('test_sales.csv')
print(f"Rows: {len(sales_df)}")
print(f"Columns: {list(sales_df.columns)}")

print("\n✅ Expected Results:")
print(f"Total sales: {sales_df['sales'].sum()}")
print(f"Average sales: {sales_df['sales'].mean():.2f}")
print(f"North region total: {sales_df[sales_df['region'] == 'North']['sales'].sum()}")
print(f"Widget count: {len(sales_df[sales_df['product'] == 'Widget'])}")

print("\nGrouped by region (mean):")
grouped = sales_df.groupby('region')['sales'].mean()
for region, value in grouped.items():
    print(f"  {region}: {value:.2f}")

# ========== EMPLOYEE DATA ==========
print("\n" + "=" * 60)
print("👥 EMPLOYEE DATA (test_employees.csv)")
print("-" * 60)

emp_df = pd.read_csv('test_employees.csv')
print(f"Rows: {len(emp_df)}")
print(f"Columns: {list(emp_df.columns)}")

print("\n✅ Expected Results:")
print(f"Average salary: ${emp_df['salary'].mean():,.2f}")
print(f"Min salary: ${emp_df['salary'].min():,.2f}")
print(f"Max salary: ${emp_df['salary'].max():,.2f}")
print(f"Std dev: ${emp_df['salary'].std():,.2f}")

print("\nGrouped by department (mean salary):")
dept_grouped = emp_df.groupby('department')['salary'].mean()
for dept, value in dept_grouped.items():
    print(f"  {dept}: ${value:,.2f}")

print("\n📈 Correlation (years_experience vs salary):")
correlation = emp_df[['years_experience', 'salary']].corr().iloc[0, 1]
print(f"Correlation coefficient: {correlation:.4f}")
if correlation > 0.8:
    print("  → Strong positive correlation ✅")

print("\n📉 Linear Regression (years_experience → salary):")
X = emp_df[['years_experience']].values
y = emp_df['salary'].values
model = LinearRegression()
model.fit(X, y)
print(f"Slope: ${model.coef_[0]:,.2f} per year")
print(f"Intercept: ${model.intercept_:,.2f}")
print(f"R-squared: {model.score(X, y):.4f}")
print(f"Interpretation: Each year of experience adds ~${model.coef_[0]:,.0f} to salary")

# ========== PRODUCT DATA ==========
print("\n" + "=" * 60)
print("📦 PRODUCT DATA (test_products.csv)")
print("-" * 60)

prod_df = pd.read_csv('test_products.csv')
print(f"Rows: {len(prod_df)}")

print("\n✅ Expected Results:")
print(f"Total revenue: ${prod_df['revenue'].sum():,.2f}")
print(f"Average rating: {prod_df['rating'].mean():.2f}")
print(f"Average price: ${prod_df['price'].mean():.2f}")

print("\nOutlier Detection (units_sold):")
mean_units = prod_df['units_sold'].mean()
std_units = prod_df['units_sold'].std()
threshold = mean_units - 2 * std_units
outliers = prod_df[prod_df['units_sold'] < threshold]
if len(outliers) > 0:
    print(f"Outliers (< {threshold:.0f} units): {list(outliers['product'])}")
else:
    print("No outliers detected")

# ========== EDGE CASE DATA ==========
print("\n" + "=" * 60)
print("⚠️  EDGE CASE DATA (test_edge.csv)")
print("-" * 60)

edge_df = pd.read_csv('test_edge.csv')
print(f"Rows: {len(edge_df)}")

print("\n✅ Expected Results:")
print(f"Count: {len(edge_df)}")
print(f"Mean value: {edge_df['value'].mean():.2f}")
print(f"Category A count: {len(edge_df[edge_df['category'] == 'A'])}")
print(f"Category B count: {len(edge_df[edge_df['category'] == 'B'])}")

# ========== SUMMARY ==========
print("\n" + "=" * 60)
print("✅ VALIDATION SUMMARY")
print("=" * 60)
print("""
Use these ground truth values to validate Wake Analyzer results.

All calculations above are performed using:
- pandas (same library used by Wake Analyzer backend)
- numpy (same library used by Wake Analyzer backend)
- scikit-learn (same library used by Wake Analyzer backend)

If Wake Analyzer results don't match these values (±0.01 for rounding):
→ VALIDATION FAILURE - DO NOT DEPLOY

Upload each CSV to Wake Analyzer and execute the test plans
from VALIDATION_PLAN.md. Compare results with values above.
""")
