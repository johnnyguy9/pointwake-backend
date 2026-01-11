"""
Plan Validator - Strict schema validation for execution plans
"""
from typing import Dict, Any, List


class PlanValidator:
    """Validates execution plans against strict schema before execution"""

    VALID_OPERATIONS = {
        'mean', 'sum', 'count', 'min', 'max', 'std',
        'correlation', 'regression', 'forecast'
    }

    VALID_OPERATORS = {'==', '!=', '>', '<', '>=', '<='}

    VALID_CHART_TYPES = {
        'line', 'bar', 'scatter', 'heatmap', 'box', 'histogram', None
    }

    @classmethod
    def validate_plan(cls, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate execution plan against schema.

        Returns:
            Dict with 'valid', 'errors', and 'warnings' keys
        """
        errors = []
        warnings = []

        # Check required fields
        if 'operation' not in plan:
            errors.append("Missing required field: 'operation'")
        elif plan['operation'] not in cls.VALID_OPERATIONS:
            errors.append(
                f"Invalid operation '{plan['operation']}'. "
                f"Must be one of: {', '.join(cls.VALID_OPERATIONS)}"
            )

        # Validate filters structure
        if 'filters' in plan:
            if not isinstance(plan['filters'], list):
                errors.append("'filters' must be an array")
            else:
                for i, filter_obj in enumerate(plan['filters']):
                    filter_errors = cls._validate_filter(filter_obj, i)
                    errors.extend(filter_errors)

        # Validate group_by
        if 'group_by' in plan:
            if not isinstance(plan['group_by'], list):
                errors.append("'group_by' must be an array")
            elif not all(isinstance(col, str) for col in plan['group_by']):
                errors.append("All 'group_by' elements must be strings")

        # Validate chart_type
        if 'chart_type' in plan:
            if plan['chart_type'] not in cls.VALID_CHART_TYPES:
                errors.append(
                    f"Invalid chart_type '{plan['chart_type']}'. "
                    f"Must be one of: {', '.join(str(ct) for ct in cls.VALID_CHART_TYPES if ct)}"
                )

        # Validate requires_clarification
        if plan.get('requires_clarification'):
            if not plan.get('clarification_question'):
                errors.append(
                    "When requires_clarification is true, "
                    "clarification_question must be provided"
                )

        # Operation-specific validation
        operation = plan.get('operation')

        if operation in ['mean', 'sum', 'std', 'min', 'max']:
            if not plan.get('target_column'):
                warnings.append(
                    f"Operation '{operation}' typically requires target_column"
                )

        if operation == 'correlation':
            if not (plan.get('x_axis') and plan.get('y_axis')):
                errors.append(
                    "Operation 'correlation' requires both x_axis and y_axis"
                )

        if operation == 'regression':
            if not (plan.get('x_axis') and plan.get('y_axis')):
                errors.append(
                    "Operation 'regression' requires both x_axis and y_axis"
                )

        if operation == 'forecast':
            if not plan.get('time_column'):
                errors.append("Operation 'forecast' requires time_column")
            if not plan.get('target_column'):
                errors.append("Operation 'forecast' requires target_column")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    @classmethod
    def _validate_filter(cls, filter_obj: Any, index: int) -> List[str]:
        """Validate a single filter object"""
        errors = []

        if not isinstance(filter_obj, dict):
            errors.append(f"Filter at index {index} must be an object")
            return errors

        # Required filter fields
        if 'column' not in filter_obj:
            errors.append(f"Filter at index {index} missing 'column'")
        elif not isinstance(filter_obj['column'], str):
            errors.append(f"Filter at index {index} 'column' must be a string")

        if 'operator' not in filter_obj:
            errors.append(f"Filter at index {index} missing 'operator'")
        elif filter_obj['operator'] not in cls.VALID_OPERATORS:
            errors.append(
                f"Filter at index {index} has invalid operator '{filter_obj['operator']}'. "
                f"Must be one of: {', '.join(cls.VALID_OPERATORS)}"
            )

        if 'value' not in filter_obj:
            errors.append(f"Filter at index {index} missing 'value'")

        return errors
