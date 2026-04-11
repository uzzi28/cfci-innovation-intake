from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.core.dependencies import db_dependency, user_dependency
from app.db.models.conversation import Conversation
from app.db.models.user import User
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import io
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

# Map field names to section titles and order
SECTION_ORDER = [
    ("Company Name", "Organization"),
    ("Primary contact", "Primary Contact"),
    ("Contact email", "Contact Email"),
    ("Website or primary link", "Website"),
    ("Problem statement", "Problem Statement"),
    ("Proposed solution", "Proposed Solution"),
    ("Target audience", "Target Audience"),
    ("Timeline & resources", "Timeline & Resources"),
]

@router.get("/submissions/{conversation_id}")
async def generate_pdf(
    conversation_id: int,
    db=db_dependency,
    user: User = user_dependency,
):
    conv = db.query(Conversation).get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.user_id != user.id and not getattr(user, "is_staff", False):
        raise HTTPException(status_code=403, detail="Not allowed to access this brief.")

    # Build field data
    fields = {}
    if conv.form and conv.form.field_submissions:
        for fs in conv.form.field_submissions:
            label = fs.field_template.name if fs.field_template else f"Field {fs.field_template_id}"
            fields[label] = fs.value or None

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.9 * inch,
        leftMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch
    )

    DUKE_BLUE = colors.HexColor('#00247d')
    DUKE_GOLD = colors.HexColor('#c4a000')
    LIGHT_GRAY = colors.HexColor('#f5f5f5')
    MID_GRAY = colors.HexColor('#888888')
    DARK = colors.HexColor('#1a1a2e')

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('BriefTitle', parent=styles['Normal'],
        fontSize=22, fontName='Helvetica-Bold',
        textColor=DUKE_BLUE, spaceAfter=8, alignment=TA_LEFT)

    subtitle_style = ParagraphStyle('BriefSubtitle', parent=styles['Normal'],
        fontSize=11, fontName='Helvetica',
        textColor=MID_GRAY, spaceAfter=2, spaceBefore=8)

    meta_style = ParagraphStyle('Meta', parent=styles['Normal'],
        fontSize=10, fontName='Helvetica',
        textColor=MID_GRAY, spaceAfter=0)

    section_header_style = ParagraphStyle('SectionHeader', parent=styles['Normal'],
        fontSize=9, fontName='Helvetica-Bold',
        textColor=DUKE_BLUE, spaceBefore=18, spaceAfter=4,
        textTransform='uppercase', letterSpacing=1)

    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=11, fontName='Helvetica',
        textColor=DARK, spaceAfter=4, leading=16)

    highlight_style = ParagraphStyle('Highlight', parent=styles['Normal'],
        fontSize=11, fontName='Helvetica-Bold',
        textColor=DARK, spaceAfter=4)

    story = []

    # ── Header ──────────────────────────────────────────────
    story.append(Paragraph("Product Brief", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Duke Engineering Project Intake · CFCI Product Lab", subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=DUKE_BLUE, spaceAfter=6))
    story.append(HRFlowable(width="100%", thickness=1, color=DUKE_GOLD, spaceAfter=12))

    # ── Submitter metadata row ───────────────────────────────
    name = f"{conv.owner.firstname} {conv.owner.lastname}" if conv.owner else "Unknown"
    email = conv.owner.email if conv.owner else ""
    date = conv.started_at.strftime("%B %d, %Y") if conv.started_at else "N/A"

    meta_data = [
        [Paragraph(f"<b>Submitted by</b>", meta_style),
         Paragraph(f"<b>Email</b>", meta_style),
         Paragraph(f"<b>Date</b>", meta_style)],
        [Paragraph(name, body_style),
         Paragraph(email, body_style),
         Paragraph(date, body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[2.2*inch, 2.8*inch, 1.8*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_GRAY),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (-1,0), MID_GRAY),
        ('BOTTOMPADDING', (0,0), (-1,0), 4),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,1), (-1,1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0,1), (-1,1), [colors.white]),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#dddddd'), spaceAfter=4))

    # ── Sections ─────────────────────────────────────────────
    # Identity section (company + contact inline)
    company = fields.get("Company Name")
    contact = fields.get("Primary contact")
    contact_email = fields.get("Contact email")
    website = fields.get("Website or primary link")

    story.append(Paragraph("Organization", section_header_style))
    if company:
        story.append(Paragraph(company, highlight_style))
    else:
        story.append(Paragraph("Not provided", body_style))

    if contact or contact_email:
        contact_line = " · ".join(filter(None, [contact, contact_email]))
        story.append(Paragraph(contact_line, body_style))

    if website:
        story.append(Paragraph(f"<u>{website}</u>", body_style))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#eeeeee'), spaceBefore=12, spaceAfter=4))

    # Main narrative sections
    narrative_fields = [
        ("Problem statement", "Problem Statement"),
        ("Proposed solution", "Proposed Solution"),
        ("Target audience", "Target Audience"),
        ("Timeline & resources", "Timeline & Resources"),
    ]

    for field_key, section_title in narrative_fields:
        value = fields.get(field_key)
        story.append(Paragraph(section_title, section_header_style))
        if value:
            story.append(Paragraph(value, body_style))
        else:
            story.append(Paragraph("Not yet provided.", ParagraphStyle('Empty', parent=body_style, textColor=MID_GRAY)))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#eeeeee'), spaceBefore=8, spaceAfter=4))

    # ── Footer ───────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=DUKE_BLUE))
    story.append(Paragraph(
        "Generated by Duke Engineering Project Intake · Christensen Family Center for Innovation",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8,
                       textColor=MID_GRAY, alignment=TA_CENTER, spaceBefore=6)
    ))

    doc.build(story)
    buffer.seek(0)

    filename = f"product_brief_{conversation_id}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )