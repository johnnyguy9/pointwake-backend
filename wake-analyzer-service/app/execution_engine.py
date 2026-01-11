"""
Execution Engine - Executes validated analytics plans
All numerical results MUST come from this engine.
NO results may be fabricated or computed outside this module.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns


class ExecutionEngine:
    """
    Executes analytics operations on CSV data.
    This is the ONLY authority for numerical results.
    """

    def __init__(self):
        self.df: Optional[pd.DataFrame] = None
        self.column_info: Dict[str, str] = {}

    def load_csv(self, file_path: str) -> Dict[str, Any]:
        """
        Load CSV file and return metadata.

        Returns:
            Dictionary with column names, types, and row count
        """
        try:
            self.df = pd.read_csv(file_path)

            # Infer and store column types
            self.column_info = {
                col: str(dtype) for col, dtype in self.df.dtypes.items()
            }

            return {
                'success': True,
                'columns': list(self.df.columns),
                'column_types': self.column_info,
                'row_count': len(self.df),
                'preview': self.df.head(5).to_dict(orient='records')
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def execute_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a validated analytics plan.

        Args:
            plan: Validated execution plan

        Returns:
            Execution results with numerical outputs and charts
        """
        if self.df is None:
            return {
                'success': False,
                'error': 'No CSV data loaded'
            }

        try:
            # Apply filters first
            filtered_df = self._apply_filters(self.df, plan.get('filters', []))

            if filtered_df.empty:
                return {
                    'success': False,
                    'error': 'Filters resulted in empty dataset'
                }

            # Execute the operation
            operation = plan['operation']
            result = self._execute_operation(filtered_df, plan)

            # Generate chart if requested
            chart_data = None
            if plan.get('chart_type'):
                chart_data = self._generate_chart(filtered_df, plan)

            return {
                'success': True,
                'operation': operation,
                'result': result,
                'chart': chart_data,
                'filtered_row_count': len(filtered_df)
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Execution failed: {str(e)}'
            }

    def _apply_filters(self, df: pd.DataFrame, filters: List[Dict]) -> pd.DataFrame:
        """Apply filters to dataframe"""
        filtered = df.copy()

        for f in filters:
            column = f['column']
            operator = f['operator']
            value = f['value']

            if column not in filtered.columns:
                raise ValueError(f"Column '{column}' not found in dataset")

            # Convert value to appropriate type
            col_dtype = filtered[column].dtype
            if pd.api.types.is_numeric_dtype(col_dtype):
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    raise ValueError(
                        f"Cannot compare numeric column '{column}' with non-numeric value '{value}'"
                    )

            # Apply operator
            if operator == '==':
                filtered = filtered[filtered[column] == value]
            elif operator == '!=':
                filtered = filtered[filtered[column] != value]
            elif operator == '>':
                filtered = filtered[filtered[column] > value]
            elif operator == '<':
                filtered = filtered[filtered[column] < value]
            elif operator == '>=':
                filtered = filtered[filtered[column] >= value]
            elif operator == '<=':
                filtered = filtered[filtered[column] <= value]

        return filtered

    def _execute_operation(self, df: pd.DataFrame, plan: Dict[str, Any]) -> Any:
        """Execute the specified operation"""
        operation = plan['operation']
        target_col = plan.get('target_column')
        group_by = plan.get('group_by', [])

        # Aggregation operations
        if operation == 'mean':
            if group_by:
                return df.groupby(group_by)[target_col].mean().to_dict()
            return float(df[target_col].mean())

        elif operation == 'sum':
            if group_by:
                return df.groupby(group_by)[target_col].sum().to_dict()
            return float(df[target_col].sum())

        elif operation == 'count':
            if group_by:
                return df.groupby(group_by).size().to_dict()
            return int(len(df))

        elif operation == 'min':
            if group_by:
                return df.groupby(group_by)[target_col].min().to_dict()
            return float(df[target_col].min())

        elif operation == 'max':
            if group_by:
                return df.groupby(group_by)[target_col].max().to_dict()
            return float(df[target_col].max())

        elif operation == 'std':
            if group_by:
                return df.groupby(group_by)[target_col].std().to_dict()
            return float(df[target_col].std())

        # Correlation
        elif operation == 'correlation':
            x_col = plan['x_axis']
            y_col = plan['y_axis']
            correlation = df[[x_col, y_col]].corr().iloc[0, 1]
            return {
                'correlation_coefficient': float(correlation),
                'x_column': x_col,
                'y_column': y_col
            }

        # Regression
        elif operation == 'regression':
            x_col = plan['x_axis']
            y_col = plan['y_axis']

            X = df[[x_col]].values
            y = df[y_col].values

            model = LinearRegression()
            model.fit(X, y)

            r_squared = model.score(X, y)

            return {
                'slope': float(model.coef_[0]),
                'intercept': float(model.intercept_),
                'r_squared': float(r_squared),
                'x_column': x_col,
                'y_column': y_col
            }

        # Forecast
        elif operation == 'forecast':
            time_col = plan['time_column']
            target_col = plan['target_column']

            # Sort by time
            df_sorted = df.sort_values(time_col)

            # Simple exponential smoothing forecast
            values = df_sorted[target_col].values

            # Use last 12 points or all if less
            train_size = min(len(values), 12)
            train = values[-train_size:]

            try:
                model = ExponentialSmoothing(
                    train,
                    seasonal_periods=4,
                    trend='add',
                    seasonal='add'
                )
                fitted = model.fit()
                forecast = fitted.forecast(steps=3)

                return {
                    'forecast_values': [float(v) for v in forecast],
                    'last_actual': float(values[-1]),
                    'target_column': target_col
                }
            except:
                # Fallback to simple moving average if exponential smoothing fails
                forecast_value = float(np.mean(train))
                return {
                    'forecast_values': [forecast_value] * 3,
                    'last_actual': float(values[-1]),
                    'target_column': target_col,
                    'method': 'simple_average'
                }

        else:
            raise ValueError(f"Unknown operation: {operation}")

    def _generate_chart(self, df: pd.DataFrame, plan: Dict[str, Any]) -> Optional[str]:
        """Generate chart and return as base64 encoded image"""
        chart_type = plan.get('chart_type')
        if not chart_type:
            return None

        try:
            plt.figure(figsize=(10, 6))

            if chart_type == 'line':
                x_col = plan.get('x_axis')
                y_col = plan.get('y_axis') or plan.get('target_column')
                if x_col and y_col:
                    plt.plot(df[x_col], df[y_col])
                    plt.xlabel(x_col)
                    plt.ylabel(y_col)

            elif chart_type == 'bar':
                x_col = plan.get('x_axis')
                y_col = plan.get('y_axis') or plan.get('target_column')
                if x_col and y_col:
                    if plan.get('group_by'):
                        grouped = df.groupby(x_col)[y_col].mean()
                        grouped.plot(kind='bar')
                    else:
                        plt.bar(df[x_col], df[y_col])
                    plt.xlabel(x_col)
                    plt.ylabel(y_col)

            elif chart_type == 'scatter':
                x_col = plan.get('x_axis')
                y_col = plan.get('y_axis')
                if x_col and y_col:
                    plt.scatter(df[x_col], df[y_col], alpha=0.5)
                    plt.xlabel(x_col)
                    plt.ylabel(y_col)

            elif chart_type == 'histogram':
                target_col = plan.get('target_column')
                if target_col:
                    plt.hist(df[target_col], bins=30, edgecolor='black')
                    plt.xlabel(target_col)
                    plt.ylabel('Frequency')

            elif chart_type == 'box':
                target_col = plan.get('target_column')
                if target_col:
                    plt.boxplot(df[target_col])
                    plt.ylabel(target_col)

            elif chart_type == 'heatmap':
                # Correlation heatmap of numeric columns
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                if len(numeric_cols) > 1:
                    corr_matrix = df[numeric_cols].corr()
                    sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', center=0)

            plt.title(f"{plan['operation'].title()} - {chart_type.title()} Chart")
            plt.tight_layout()

            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=100)
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.read()).decode()
            plt.close()

            return f"data:image/png;base64,{image_base64}"

        except Exception as e:
            print(f"Chart generation failed: {e}")
            return None
