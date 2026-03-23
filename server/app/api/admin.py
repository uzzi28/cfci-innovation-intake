from fastapi import APIRouter, HTTPException, Depends
from app.core.dependencies import db_dependency, user_dependency
from app.db.models.conversation import Conversation
from app.db.models.user import User
from app.db.models.message import Message
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"]
)

@router.get("/submissions")
async def get_all_submissions(
    db = db_dependency,
    user = user_dependency
):
    """
    Returns all conversations with user info and latest message.
    Admin only.
    """
    try:
        conversations = db.query(Conversation).join(User).order_by(
            Conversation.updated_at.desc()
        ).all()

        result = []
        for conv in conversations:
            # Get form field submissions if form exists
            fields = {}
            if conv.form and conv.form.field_submissions:
                for fs in conv.form.field_submissions:
                    field_name = fs.field_template.field_name if fs.field_template else str(fs.field_template_id)
                    fields[field_name] = fs.value

            result.append({
                "conversation_id": conv.id,
                "title": conv.title,
                "started_at": str(conv.started_at),
                "updated_at": str(conv.updated_at),
                "user": {
                    "id": conv.owner.id,
                    "email": conv.owner.email,
                    "name": f"{conv.owner.firstname} {conv.owner.lastname}"
                },
                "form_fields": fields,
                "message_count": len(conv.messages)
            })

        return {"submissions": result, "total": len(result)}

    except Exception as e:
        logger.error(f"Error fetching submissions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch submissions.")


@router.get("/submissions/{conversation_id}")
async def get_submission_detail(
    conversation_id: int,
    db = db_dependency,
    user = user_dependency
):
    """
    Returns full detail of a single submission including all messages.
    """
    conv = db.query(Conversation).get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    fields = {}
    if conv.form and conv.form.field_submissions:
        for fs in conv.form.field_submissions:
            field_name = fs.field_template.field_name if fs.field_template else str(fs.field_template_id)
            fields[field_name] = fs.value

    messages = [
        {
            "message_num": msg.message_num,
            "sender": msg.sender,
            "content": msg.content,
            "created_at": str(msg.created_at)
        }
        for msg in conv.messages
    ]

    return {
        "conversation_id": conv.id,
        "title": conv.title,
        "started_at": str(conv.started_at),
        "user": {
            "id": conv.owner.id,
            "email": conv.owner.email,
            "name": f"{conv.owner.firstname} {conv.owner.lastname}"
        },
        "form_fields": fields,
        "messages": messages
    }