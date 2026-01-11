"""
Pydantic schemas for API request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============ AUTH SCHEMAS ============

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ DATASET SCHEMAS ============

class DatasetMetadata(BaseModel):
    columns: List[str]
    column_types: Dict[str, str]
    row_count: int
    preview: List[Dict[str, Any]]


class DatasetUploadResponse(BaseModel):
    success: bool
    session_id: str
    metadata: DatasetMetadata


class DatasetResponse(BaseModel):
    id: str
    session_id: str
    filename: str
    row_count: int
    column_count: int
    columns: List[str]
    column_types: Dict[str, str]
    uploaded_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


# ============ EXECUTION PLAN SCHEMAS ============

class FilterSchema(BaseModel):
    column: str
    operator: str = Field(..., pattern="^(==|!=|>|<|>=|<=)$")
    value: Any


class ExecutionPlan(BaseModel):
    operation: str = Field(..., pattern="^(mean|sum|count|min|max|std|correlation|regression|forecast)$")
    target_column: Optional[str] = None
    filters: List[FilterSchema] = []
    group_by: List[str] = []
    time_column: Optional[str] = None
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    chart_type: Optional[str] = Field(None, pattern="^(line|bar|scatter|heatmap|box|histogram)$")
    requires_clarification: bool = False
    clarification_question: Optional[str] = None


class ValidationResult(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class ExecutionRequest(BaseModel):
    session_id: str
    plan: ExecutionPlan


class ExecutionResult(BaseModel):
    success: bool
    operation: Optional[str] = None
    result: Optional[Any] = None
    chart: Optional[str] = None
    filtered_row_count: Optional[int] = None
    error: Optional[str] = None
    requires_clarification: Optional[bool] = None
    clarification_question: Optional[str] = None


# ============ ANALYSIS HISTORY SCHEMAS ============

class AnalysisResponse(BaseModel):
    id: str
    session_id: str
    execution_plan: Dict[str, Any]
    result: Optional[Any]
    chart_data: Optional[str]
    filtered_row_count: Optional[int]
    execution_time_ms: Optional[int]
    success: bool
    error_message: Optional[str]
    executed_at: datetime

    class Config:
        from_attributes = True
