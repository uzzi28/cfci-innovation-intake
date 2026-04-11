from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    firstname = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_staff = Column(Boolean, nullable=False, default=False, server_default="0")

    # One-to-many relationship with Conversation, Form, and Message models
    conversations = relationship("Conversation", back_populates="owner")
    forms = relationship("Form", back_populates="owner")
    messages = relationship("Message", back_populates="owner")

