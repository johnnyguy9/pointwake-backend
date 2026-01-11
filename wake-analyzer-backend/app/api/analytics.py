"""
Analytics API routes - Upload, Execute, History
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.schemas import (
    DatasetUploadResponse,
    DatasetResponse,
    ExecutionRequest,
    ExecutionResult,
    ValidationResult,
    AnalysisResponse,
    ExecutionPlan
)
from app.models.user import User
from app.models.dataset import Dataset
from app.models.analysis import Analysis
from app.services.execution_engine import ExecutionEngine
from app.services.plan_validator import PlanValidator

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload CSV file for analysis
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed"
        )

    # Generate session ID
    session_id = f"wa_{datetime.utcnow().timestamp()}_{os.urandom(8).hex()}"

    # Save file
    file_path = os.path.join(settings.UPLOAD_DIR, f"{session_id}.csv")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Load and analyze CSV
        engine = ExecutionEngine()
        result = engine.load_csv(file_path)

        if not result['success']:
            os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result['error']
            )

        # Store dataset metadata
        dataset = Dataset(
            user_id=current_user.id,
            session_id=session_id,
            filename=file.filename,
            file_path=file_path,
            row_count=result['row_count'],
            column_count=len(result['columns']),
            columns=result['columns'],
            column_types=result['column_types']
        )

        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        return {
            'success': True,
            'session_id': session_id,
            'metadata': {
                'columns': result['columns'],
                'column_types': result['column_types'],
                'row_count': result['row_count'],
                'preview': result['preview']
            }
        }

    except Exception as e:
        # Cleanup on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.post("/validate", response_model=ValidationResult)
async def validate_plan(
    plan: ExecutionPlan,
    current_user: User = Depends(get_current_user)
):
    """
    Validate execution plan without executing
    """
    validation = PlanValidator.validate_plan(plan.dict())

    return {
        'valid': validation['valid'],
        'errors': validation['errors'],
        'warnings': validation['warnings']
    }


@router.post("/execute", response_model=ExecutionResult)
async def execute_plan(
    request: ExecutionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute analytics plan on uploaded dataset
    """
    start_time = datetime.utcnow()

    # Verify dataset belongs to user
    dataset = db.query(Dataset).filter(
        Dataset.session_id == request.session_id,
        Dataset.user_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    # Validate plan
    plan_dict = request.plan.dict()
    validation = PlanValidator.validate_plan(plan_dict)

    if not validation['valid']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                'error': 'Plan validation failed',
                'validation_errors': validation['errors']
            }
        )

    # Check for clarification requirement
    if request.plan.requires_clarification:
        return {
            'success': False,
            'requires_clarification': True,
            'clarification_question': request.plan.clarification_question
        }

    # Execute
    engine = ExecutionEngine()
    load_result = engine.load_csv(dataset.file_path)

    if not load_result['success']:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load CSV: {load_result['error']}"
        )

    result = engine.execute_plan(plan_dict)

    execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

    # Log execution
    analysis = Analysis(
        user_id=current_user.id,
        dataset_id=dataset.id,
        session_id=request.session_id,
        execution_plan=plan_dict,
        result=result.get('result') if result['success'] else None,
        chart_data=result.get('chart'),
        filtered_row_count=result.get('filtered_row_count'),
        execution_time_ms=execution_time,
        success=result['success'],
        error_message=result.get('error')
    )

    db.add(analysis)
    db.commit()

    return result


@router.get("/datasets", response_model=List[DatasetResponse])
async def get_user_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all datasets for current user
    """
    datasets = db.query(Dataset).filter(
        Dataset.user_id == current_user.id
    ).order_by(Dataset.uploaded_at.desc()).limit(20).all()

    return datasets


@router.get("/datasets/{session_id}", response_model=DatasetResponse)
async def get_dataset(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get dataset metadata by session ID
    """
    dataset = db.query(Dataset).filter(
        Dataset.session_id == session_id,
        Dataset.user_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    return dataset


@router.get("/history/{session_id}", response_model=List[AnalysisResponse])
async def get_analysis_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get analysis history for a dataset
    """
    dataset = db.query(Dataset).filter(
        Dataset.session_id == session_id,
        Dataset.user_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    analyses = db.query(Analysis).filter(
        Analysis.dataset_id == dataset.id
    ).order_by(Analysis.executed_at.desc()).limit(50).all()

    return analyses


@router.delete("/datasets/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete dataset and all associated analyses
    """
    dataset = db.query(Dataset).filter(
        Dataset.session_id == session_id,
        Dataset.user_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    # Delete file
    if os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)

    # Database cascade will handle analyses
    db.delete(dataset)
    db.commit()

    return None
