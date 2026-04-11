"""
Authenticated submitter actions on their own conversations (draft, email stub).
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.dependencies import db_dependency, user_dependency
from app.db.models.conversation import Conversation
from app.db.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class EmailBriefBody(BaseModel):
    note: str | None = None


@router.post("/{conversation_id}/save-draft")
async def save_draft(
    conversation_id: int,
    db=db_dependency,
    user: User = user_dependency,
):
    conv = db.query(Conversation).get(conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv.last_draft_saved_at = datetime.now(timezone.utc)
    db.add(conv)
    db.commit()
    return {"conversation_id": conv.id, "last_draft_saved_at": str(conv.last_draft_saved_at)}


@router.post("/{conversation_id}/email-brief")
async def email_brief_stub(
    conversation_id: int,
    body: EmailBriefBody,
    db=db_dependency,
    user: User = user_dependency,
):
    """
    Placeholder for CFCI email integration. Logs intent; wire SMTP or SendGrid later.
    """
    conv = db.query(Conversation).get(conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    logger.info(
        "email-brief requested conv=%s user=%s note=%s (stub — no mail sent)",
        conversation_id,
        user.email,
        body.note,
    )
    return {
        "status": "queued",
        "message": "Email pipeline not configured; your request was recorded for development.",
        "conversation_id": conv.id,
    }


@router.get("/{conversation_id}/status")
async def conversation_status(
    conversation_id: int,
    db=db_dependency,
    user: User = user_dependency,
):
    conv = db.query(Conversation).get(conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {
        "conversation_id": conv.id,
        "brief_locked_at": str(conv.brief_locked_at) if conv.brief_locked_at else None,
        "last_draft_saved_at": str(conv.last_draft_saved_at) if conv.last_draft_saved_at else None,
    }
