"""
DB bootstrap: migrations (via create_tables), optional dev user, default intake template, staff flags.
"""
import logging
import os

from app.core.security import hash_password, verify_password
from app.db.database import SessionLocal, create_tables
from app.db.models.user import User
from app.db.models.form_template import FormTemplate
from app.db.models.field_template import FieldTemplate, FieldType

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATE_KEY = "default_intake"


def _staff_email_set() -> set[str]:
    raw = os.getenv(
        "STAFF_EMAILS",
        "tingting.li@duke.edu",
    )
    return {x.strip().lower() for x in raw.split(",") if x.strip()}


def sync_staff_flags(db) -> None:
    for email in _staff_email_set():
        u = db.query(User).filter(User.email == email).first()
        if u and not u.is_staff:
            u.is_staff = True
            logger.info("Granted staff to %s (STAFF_EMAILS)", email)
    db.commit()


def ensure_default_intake_template(db) -> FormTemplate | None:
    tpl = db.query(FormTemplate).filter(FormTemplate.name == DEFAULT_TEMPLATE_KEY).first()
    if tpl:
        if not tpl.intake_title:
            tpl.intake_title = "Duke Engineering Project Intake Application"
            db.commit()
        return tpl

    tpl = FormTemplate(
        name=DEFAULT_TEMPLATE_KEY,
        description="Configurable intake fields for Duke Engineering Project Intake",
        intake_title="Duke Engineering Project Intake Application",
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)

    seed_fields = [
        ("Company Name", FieldType.STRING, "Legal or working name of your organization", True),
        ("Primary contact", FieldType.STRING, "Full name of the person we should reach", True),
        ("Contact email", FieldType.EMAIL, "We will use this for follow-up", True),
        ("Website or primary link", FieldType.URL, "Company site, deck, or LinkedIn", False),
        ("Problem statement", FieldType.LONG_TEXT, "What pain are you solving, and for whom?", True),
        ("Proposed solution", FieldType.LONG_TEXT, "How will you address the problem?", False),
        ("Target audience", FieldType.LONG_TEXT, "Who will use this product or service?", True),
        ("Timeline & resources", FieldType.LONG_TEXT, "When do you need this, and what help do you need?", False),
    ]
    for i, (name, ftype, desc, required) in enumerate(seed_fields):
        db.add(
            FieldTemplate(
                name=name,
                field_type=ftype,
                description=desc,
                sort_order=i,
                is_required=required,
                form_template_id=tpl.id,
                form_id=None,
            )
        )
    db.commit()
    logger.info("Created default intake template id=%s with %s fields", tpl.id, len(seed_fields))
    return tpl


def run_startup_seed() -> None:
    create_tables()

    db = SessionLocal()
    try:
        ensure_default_intake_template(db)
        sync_staff_flags(db)
    except Exception:
        logger.exception("Template/staff seed failed")
        db.rollback()
    finally:
        db.close()

    raw = os.getenv("SEED_DEV_USER", "true").lower().strip()
    if raw in ("0", "false", "no", "off"):
        return

    email = (os.getenv("DEV_SEED_EMAIL") or "tingting.li@duke.edu").strip().lower()
    password = os.getenv("DEV_SEED_PASSWORD") or "cfci1234"
    firstname = os.getenv("DEV_SEED_FIRSTNAME") or "Ting Ting"
    lastname = os.getenv("DEV_SEED_LASTNAME") or "Li"
    staff_emails = _staff_email_set()

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if verify_password(password, existing.hashed_password):
                logger.info("Dev seed: user %s already present with expected password.", email)
            else:
                reset = os.getenv("DEV_SEED_RESET_PASSWORD", "true").lower().strip()
                if reset not in ("0", "false", "no", "off"):
                    existing.hashed_password = hash_password(password)
                    logger.info("Dev seed: updated password for %s", email)
                else:
                    logger.info("Dev seed: user %s exists; DEV_SEED_RESET_PASSWORD disabled.", email)
            existing.is_staff = email in staff_emails
            db.commit()
            return
        user = User(
            email=email,
            firstname=firstname,
            lastname=lastname,
            hashed_password=hash_password(password),
            is_staff=email in staff_emails,
        )
        db.add(user)
        db.commit()
        logger.info("Dev seed: created test user %s (staff=%s)", email, user.is_staff)
    except Exception:
        logger.exception("Dev seed: failed to create test user")
        db.rollback()
    finally:
        db.close()
