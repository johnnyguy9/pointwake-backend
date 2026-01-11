"""
Analysis model for execution history and audit trail
"""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String, nullable=False)
    execution_plan = Column(JSON, nullable=False)  # The full plan JSON
    result = Column(JSON, nullable=True)  # Numerical results
    chart_data = Column(Text, nullable=True)  # Base64 chart image
    filtered_row_count = Column(Integer, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="analyses")
    dataset = relationship("Dataset", back_populates="analyses")
