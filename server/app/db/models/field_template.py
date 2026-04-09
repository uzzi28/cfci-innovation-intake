from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base

class FieldType(str, enum.Enum):
    STRING = "string"
    LONG_TEXT = "long_text"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    DATE = "date"
    EMAIL = "email"
    PHONE = "phone"
    ADDRESS = "address"
    URL = "url"

class FieldTemplate(Base):
    __tablename__ = "field_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    field_type = Column(Enum(FieldType), index=True)
    description = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_required = Column(Boolean, nullable=False, default=True, server_default="1")

    # ----Timestamps----
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    # ----Foreign Keys----
    form_id = Column(Integer, ForeignKey("forms.id"))
    form_template_id = Column(Integer, ForeignKey("form_templates.id"))

    # ----Relationships----
    form = relationship("Form", back_populates="field_templates")
    form_template = relationship("FormTemplate", back_populates="field_templates")
    field_submissions = relationship("FieldSubmission", back_populates="field_template", cascade="all, delete-orphan")

