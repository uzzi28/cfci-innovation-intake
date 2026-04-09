from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer
from app.core.dependencies import settings_dependency, openai_service_dependency, db_dependency, user_dependency
from app.db.models.field_submission import FieldSubmission, FieldStatus
from app.db.models.message import Message
from app.db.models.conversation import Conversation
from app.db.models.form import Form
from app.db.models.form_template import FormTemplate
from app.db.models.field_template import FieldTemplate
from app.schemas.chat_schemas import (
    InitiateChatResponse, AdvanceChatRequest, AdvanceChatResponse,
    SimpleChatRequest, SimpleChatResponse
)
from app.schemas.openai_schemas import UpdateFormLLMOutput, DefaultLLMOutput
from app.utils.langgraph_utils import read_markdown_file
import logging
import uuid

# Create router for all chat-related endpoints
router = APIRouter(
    prefix="/api/chat", 
    tags=["chat"]
)

# Configure logging
logger = logging.getLogger(__name__)


def _fallback_agent_reply(turn_step: int) -> str:
    prompts = [
        "Thanks for sharing that. What should we call your project or organization?",
        "Got it. Who is the primary user or customer for this idea?",
        "Helpful context. What would success look like in the next few months?",
        "Understood. Is there a rough timeline or any constraints we should know about?",
    ]
    return prompts[turn_step % len(prompts)]


# In-memory conversation storage for guest mode
# In production, this should be Redis or a database
guest_conversations: dict[str, list[dict]] = {}

SYSTEM_PROMPT = """You are a friendly and professional AI assistant representing Duke University's Christensen Family Center for Innovation (CFCI). You help potential clients submit project proposals to CFCI's Product Lab.

Your personality:
- Warm, welcoming, and professional
- Curious about the client's ideas and genuinely interested in helping
- Clear and concise in your communication
- Encouraging and supportive of entrepreneurial endeavors

Your goal is to guide the conversation to collect information for a Product Brief submission:
1. Basic Info: Contact name, organization/startup name
2. Project Overview: What they want to build and why
3. Problem Statement: What problem they're solving
4. Target Audience: Who will use this product
5. Timeline & Resources: When do they need it, what resources do they have

Guidelines:
- Ask ONE question at a time to avoid overwhelming the user
- Acknowledge what they've shared before asking for more
- If they seem unsure, offer helpful examples or clarifications
- Be encouraging - startups and new ideas deserve support!
- Keep responses concise but friendly (2-3 sentences max)

Start by warmly greeting the user and asking about their project idea."""


@router.post("/simple")
async def simple_chat(
    payload: SimpleChatRequest,
    request: Request,
    openai_service = openai_service_dependency
):
    """
    Simplified chat endpoint for guest users (no authentication required).
    Maintains conversation history in memory.
    """
    
    # Generate or use existing conversation ID
    conversation_id = payload.conversation_id or str(uuid.uuid4())
    
    # Get or create conversation history
    if conversation_id not in guest_conversations:
        guest_conversations[conversation_id] = []
    
    conversation_history = guest_conversations[conversation_id]
    
    # Add user message to history
    conversation_history.append({
        "role": "user",
        "content": payload.message
    })
    
    try:
        # Call OpenAI with conversation history
        response = openai_service.simple_chat(
            messages=conversation_history,
            system_prompt=SYSTEM_PROMPT
        )
        
        # Add assistant response to history
        conversation_history.append({
            "role": "assistant", 
            "content": response
        })
        
        # Keep only last 20 messages to prevent token overflow
        if len(conversation_history) > 20:
            guest_conversations[conversation_id] = conversation_history[-20:]
        
        return SimpleChatResponse(
            conversation_id=conversation_id,
            message=response,
            sender="agent"
        )
        
    except Exception as e:
        logger.error(f"Error in simple_chat: {e}")
        return SimpleChatResponse(
            conversation_id=conversation_id,
            message=(
                "I'm having trouble reaching the AI service right now, but you can keep going—"
                "tell me a bit more about your idea and who it's for."
            ),
            sender="agent",
        )


@router.get("/greeting")
async def get_greeting():
    """
    Get the initial greeting message for a new conversation.
    """
    return {
        "message": "Hi! I'm an AI assistant here to help you create a Product Brief for the Christenson Family Center for Innovation. Tell me about your startup or project idea, and I'll help you put together a compelling submission. What are you working on?",
        "sender": "agent"
    }


@router.post("/initiate")
async def initiate_chat(
    db = db_dependency,
    user = user_dependency
):
    """
    Endpoint to initiate a new chat session (requires authentication).
    """
    
    init_message = """Hi! I'm an AI assistant here to help you with your questions about the Christenson
Family Center for Innovation. How can I assist you today?"""
    
    try:
        db_conv = Conversation(
            title=f"CFCI x {user.firstname} {user.lastname} Chat",
            user_id=user.id
        )
        db.add(db_conv)
        db.commit()
        db.refresh(db_conv)
        logger.info(f"Conversation created with ID {db_conv.id} for user {user.id}.")
    except Exception as e:
        logger.error(f"Error creating conversation for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create conversation.")

    try:
        template = db.query(FormTemplate).order_by(FormTemplate.id.asc()).first()
        if template:
            form = Form(user_id=user.id, form_template_id=template.id)
            db.add(form)
            db.commit()
            db.refresh(form)
            db_conv.form_id = form.id
            db.add(db_conv)
            db.commit()
            db.refresh(db_conv)
            field_defs = (
                db.query(FieldTemplate)
                .filter(
                    FieldTemplate.form_template_id == template.id,
                    FieldTemplate.form_id.is_(None),
                )
                .order_by(FieldTemplate.sort_order.asc(), FieldTemplate.id.asc())
                .all()
            )
            for ft in field_defs:
                db.add(
                    FieldSubmission(
                        form_id=form.id,
                        field_template_id=ft.id,
                        status=FieldStatus.DRAFT,
                        value=None,
                    )
                )
            db.commit()
            logger.info("Linked form %s with %s fields to conversation %s", form.id, len(field_defs), db_conv.id)
    except Exception as e:
        logger.warning("Could not attach intake form to conversation %s: %s", db_conv.id, e)
        db.rollback()

    try:
        db_message = Message(
            sender="agent",
            message_num=0,
            content=init_message,
            user_id=user.id,
            conversation_id=db_conv.id
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        logger.info(f"Initial message added to conversation {db_conv.id} with message num {db_message.message_num} and system ID {db_message.id}.")
    except Exception as e:
        logger.error(f"Error creating initial message for conversation {db_conv.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create initial message.")

    response = InitiateChatResponse(
        conversation_id=db_conv.id,
        message_id=db_message.id,
        message_num=db_message.message_num,
        sender=db_message.sender,
        content=db_message.content
    )

    return response
    

@router.post("/advance")
async def advance_chat(
    payload: AdvanceChatRequest,
    request: Request,
    db = db_dependency,
    user = user_dependency,
    openai_service = openai_service_dependency
):
    """
    Main endpoint used to advance an existing conversation (requires authentication).
    """

    # Load conv from db
    conv = db.query(Conversation).get(payload.conversation_id)
    if not conv or conv.user_id != user.id:
        logger.error(f"Conversation ID {payload.conversation_id} not found or does not belong to user {user.id}.")
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if conv.brief_locked_at is not None:
        raise HTTPException(
            status_code=403,
            detail="This intake brief has been reviewed by staff and is locked. Contact CFCI if you need changes.",
        )

    # Add user's latest message to the db
    try:
        user_message = Message(
            sender="user",
            message_num=payload.message_step_num + 1,
            content=payload.user_message,
            user_id=user.id,
            conversation_id=conv.id
        )
        db.add(user_message)
        db.commit()
        db.refresh(user_message)
        logger.info(f"User message added to conversation {conv.id} with message num {user_message.message_num} and system ID {user_message.id}.")
    except Exception as e:
        logger.error(f"Fatal error adding user message to conversation {conv.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add user message.")

    # Load form context if form exists
    form_context = ""
    if conv.form:
        try:
            form = conv.form
            form_template = form.form_template  
            field_templates = form_template.field_templates if form_template else []
            field_submissions = [fs for fs in form.field_submissions]

            form_context = "### LATEST STATE OF THE FORM\n\n"

            for field_template in field_templates:
                submission = next((fs for fs in field_submissions if fs.field_template_id == field_template.id), None)
                ft_type = (
                    field_template.field_type.value
                    if hasattr(field_template.field_type, "value")
                    else str(field_template.field_type)
                )
                form_context += f"Field name: {field_template.name}\n"
                form_context += f"Field data type: {ft_type}\n"
                form_context += f"Field instructions: {field_template.description or ''}\n"
                form_context += f"Current value: {submission.value if submission else 'NONE'}\n"
                form_context += "--\n"
            logger.info(f"Successfully loaded form context for conversation {conv.id}.")
        except Exception as e:
            logger.warning(f"Could not load form context for conversation {conv.id}: {e}")
            form_context = ""

    # Get recent messages for context
    recent_messages = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.message_num.desc()).limit(20).all()
    recent_messages.reverse()
    
    chat_history = ""
    for msg in recent_messages:
        role = "User" if msg.sender == "user" else "Agent"
        chat_history += f"{role}: {msg.content}\n"

    # Generate response using OpenAI
    try:
        prompt_template = read_markdown_file("app/prompts/generate_response.md")
        full_prompt = prompt_template.replace("{{FORM_CONTEXT}}", form_context)
        full_prompt = full_prompt.replace("{{CHAT_HISTORY}}", chat_history)

        logger.info(f"Calling LLM to generate agent response for conversation {conv.id}.")
        llm_response = openai_service.handle_message(
            user_prompt=full_prompt,
            response_format=DefaultLLMOutput
        )
        response_text = llm_response["response"].output_text
        logger.info(f"Received response from LLM for conversation {conv.id}.")
    except Exception as e:
        logger.warning("LLM call failed for conversation %s, using fallback: %s", conv.id, e)
        response_text = _fallback_agent_reply(payload.message_step_num)

    # Store agent response
    try:
        agent_message = Message(
            sender="agent",
            message_num=user_message.message_num + 1,
            content=response_text,
            user_id=user.id,
            conversation_id=conv.id
        )
        db.add(agent_message)
        db.commit()
        db.refresh(agent_message)
        logger.info(f"Agent message added to conversation {conv.id} with message num {agent_message.message_num}.")
    except Exception as e:
        logger.error(f"Fatal error adding agent message to conversation {conv.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add agent message.")
    
    return AdvanceChatResponse(
        message_id=agent_message.id,
        message_num=agent_message.message_num,
        sender=agent_message.sender,
        content=agent_message.content
    )

