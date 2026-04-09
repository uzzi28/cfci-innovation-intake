from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from app.core.dependencies import db_dependency, staff_user_dependency
from app.db.models.conversation import Conversation
from app.db.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
)


def _template_field_label(fs) -> str:
    if fs.field_template:
        return fs.field_template.name
    return f"Field {fs.field_template_id}"


def _completeness_percent(conv: Conversation) -> int:
    if not conv.form or not conv.form.field_submissions:
        return 0
    subs = list(conv.form.field_submissions)
    total = len(subs)
    if total == 0:
        return 0
    filled = sum(1 for s in subs if s.value and str(s.value).strip())
    return int(round(100 * filled / total))


def _org_from_fields(fields: dict) -> str | None:
    for key in ("Company Name", "Organization", "company name", "organization"):
        if key in fields and fields[key]:
            return str(fields[key])
    for k, v in fields.items():
        if "company" in k.lower() or "organization" in k.lower():
            if v:
                return str(v)
    return None


ALLOWED_SUBMISSION_STATUS = frozenset({"draft", "pending", "reviewed"})


def _computed_submission_status(conv: Conversation, completeness: int) -> str:
    """Legacy heuristic when staff has never set submission_review_status."""
    if conv.brief_locked_at:
        return "reviewed"
    if completeness >= 95:
        return "pending"
    if completeness < 40:
        return "draft"
    return "pending"


def _effective_submission_status(conv: Conversation, completeness: int) -> str:
    raw = (conv.submission_review_status or "").strip().lower()
    if raw in ALLOWED_SUBMISSION_STATUS:
        return raw
    return _computed_submission_status(conv, completeness)


@router.get("/submissions")
async def get_all_submissions(
    db=db_dependency,
    user=staff_user_dependency,
):
    try:
        conversations = (
            db.query(Conversation).join(User).order_by(Conversation.updated_at.desc()).all()
        )

        result = []
        for conv in conversations:
            fields = {}
            if conv.form and conv.form.field_submissions:
                for fs in conv.form.field_submissions:
                    fields[_template_field_label(fs)] = fs.value

            completeness = _completeness_percent(conv)
            status = _effective_submission_status(conv, completeness)
            org = _org_from_fields(fields)

            result.append(
                {
                    "conversation_id": conv.id,
                    "title": conv.title,
                    "started_at": str(conv.started_at),
                    "updated_at": str(conv.updated_at),
                    "brief_locked_at": str(conv.brief_locked_at) if conv.brief_locked_at else None,
                    "last_draft_saved_at": str(conv.last_draft_saved_at)
                    if conv.last_draft_saved_at
                    else None,
                    "completeness_percent": completeness,
                    "submission_status": status,
                    "partner_name": f"{conv.owner.firstname} {conv.owner.lastname}",
                    "organization": org,
                    "user": {
                        "id": conv.owner.id,
                        "email": conv.owner.email,
                        "name": f"{conv.owner.firstname} {conv.owner.lastname}",
                    },
                    "form_fields": fields,
                    "message_count": len(conv.messages),
                }
            )

        return {"submissions": result, "total": len(result)}

    except Exception as e:
        logger.error(f"Error fetching submissions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch submissions.")


@router.get("/submissions/{conversation_id}")
async def get_submission_detail(
    conversation_id: int,
    db=db_dependency,
    user=staff_user_dependency,
):
    conv = db.query(Conversation).get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    fields = {}
    if conv.form and conv.form.field_submissions:
        for fs in conv.form.field_submissions:
            fields[_template_field_label(fs)] = fs.value

    messages = [
        {
            "message_num": msg.message_num,
            "sender": msg.sender,
            "content": msg.content,
            "created_at": str(msg.created_at),
        }
        for msg in conv.messages
    ]

    completeness = _completeness_percent(conv)

    return {
        "conversation_id": conv.id,
        "title": conv.title,
        "started_at": str(conv.started_at),
        "updated_at": str(conv.updated_at),
        "brief_locked_at": str(conv.brief_locked_at) if conv.brief_locked_at else None,
        "last_draft_saved_at": str(conv.last_draft_saved_at) if conv.last_draft_saved_at else None,
        "completeness_percent": completeness,
        "submission_status": _effective_submission_status(conv, completeness),
        "user": {
            "id": conv.owner.id,
            "email": conv.owner.email,
            "name": f"{conv.owner.firstname} {conv.owner.lastname}",
        },
        "form_fields": fields,
        "messages": messages,
    }


class LockBriefBody(BaseModel):
    lock: bool = Field(default=True, description="If true, freeze submitter edits after staff review.")


class SubmissionStatusBody(BaseModel):
    submission_status: Literal["draft", "pending", "reviewed"]


@router.patch("/submissions/{conversation_id}/status")
async def patch_submission_review_status(
    conversation_id: int,
    body: SubmissionStatusBody,
    db=db_dependency,
    user=staff_user_dependency,
):
    """
    Staff workflow for a submission: draft (still in progress), pending (in review),
    reviewed (staff done — locks submitter brief edits).
    """
    conv = db.query(Conversation).get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    conv.submission_review_status = body.submission_status
    if body.submission_status == "reviewed":
        if conv.brief_locked_at is None:
            conv.brief_locked_at = datetime.now(timezone.utc)
    else:
        conv.brief_locked_at = None

    db.add(conv)
    db.commit()
    db.refresh(conv)

    completeness = _completeness_percent(conv)
    return {
        "conversation_id": conv.id,
        "submission_status": _effective_submission_status(conv, completeness),
        "brief_locked_at": str(conv.brief_locked_at) if conv.brief_locked_at else None,
    }


@router.post("/submissions/{conversation_id}/lock-brief")
async def lock_submitter_brief(
    conversation_id: int,
    body: LockBriefBody,
    db=db_dependency,
    user=staff_user_dependency,
):
    """Staff confirms review of the full brief; submitter can no longer chat to change it."""
    conv = db.query(Conversation).get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if body.lock:
        if conv.brief_locked_at is None:
            conv.brief_locked_at = datetime.now(timezone.utc)
        conv.submission_review_status = "reviewed"
        db.add(conv)
        db.commit()
    else:
        conv.brief_locked_at = None
        if (conv.submission_review_status or "").lower() == "reviewed":
            conv.submission_review_status = "pending"
        db.add(conv)
        db.commit()
    return {"conversation_id": conv.id, "brief_locked_at": str(conv.brief_locked_at) if conv.brief_locked_at else None}
