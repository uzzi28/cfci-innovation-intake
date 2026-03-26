from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.core.dependencies import db_dependency, user_dependency
from app.db.models.conversation import Conversation
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
import io
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/pdf",
    tags=["pdf"]
)

@router.get("/submissions/{conversation_id}")
async def generate_pdf(
    conversation_id: int,
    db = db_dependency,
    user = user_dependency
):
    conv = db.query(Conversation).get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    # Build field data
    fields = {}
    if conv.form and conv.form.field_submissions:
        for fs in conv.form.field_submissions:
            field_name = fs.field_template.field_name if fs.field_template else f"Field {fs.field_template_id}"
            fields[field_name] = fs.value or "Not provided"

    # Generate PDF in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#00247d'),
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20
    )
    field_label_style = ParagraphStyle(
        'FieldLabel',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#00247d'),
        fontName='Helvetica-Bold',
        spaceBefore=14,
        spaceAfter=4
    )
    field_value_style = ParagraphStyle(
        'FieldValue',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=4
    )

    story = []

    # Header
    story.append(Paragraph("Product Brief", title_style))
    story.append(Paragraph("Christensen Family Center for Innovation — Duke Product Lab", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#00247d')))
    story.append(Spacer(1, 16))

    # Submitter info
    if conv.owner:
        story.append(Paragraph("Submitted by", field_label_style))
        story.append(Paragraph(f"{conv.owner.firstname} {conv.owner.lastname} — {conv.owner.email}", field_value_style))

    story.append(Paragraph("Submission Date", field_label_style))
    story.append(Paragraph(str(conv.started_at.strftime("%B %d, %Y") if conv.started_at else "N/A"), field_value_style))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0')))

    # Form fields
    if fields:
        for field_name, value in fields.items():
            story.append(Paragraph(field_name, field_label_style))
            story.append(Paragraph(str(value), field_value_style))
    else:
        story.append(Spacer(1, 20))
        story.append(Paragraph("No form fields have been submitted yet.", field_value_style))

    doc.build(story)
    buffer.seek(0)

    filename = f"product_brief_{conversation_id}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )