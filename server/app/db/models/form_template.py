from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class FormTemplate(Base):
    """
    Represents a template for forms that can be reused.
    For now, this is a placeholder for future functionality,
    where admins can define different form templates for different 
    use cases.

    A couple of notes:
    - Each form template can have multiple field templates associated with it,
      defining the structure of the form.
    - This model is separate from the actual "Form" model, which represents
      an instance of a form being filled out during a conversation.
    """
    __tablename__ = "form_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    # Shown in form builder settings (e.g. application title)
    intake_title = Column(String, nullable=True)

    # ----Timestamps----
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    # ----Relationships----
    forms = relationship("Form", back_populates="form_template")
    field_templates = relationship("FieldTemplate", back_populates="form_template")

