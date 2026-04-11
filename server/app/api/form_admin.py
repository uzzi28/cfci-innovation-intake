"""
Staff-only CRUD for the global intake field template (form builder).
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func

from app.core.dependencies import db_dependency, staff_user_dependency
from app.db.models.form_template import FormTemplate
from app.db.models.field_template import FieldTemplate, FieldType
from app.db.models.field_submission import FieldSubmission
from app.seed import DEFAULT_TEMPLATE_KEY

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/intake-form", tags=["admin-form"])


def _default_template(db):
    tpl = db.query(FormTemplate).filter(FormTemplate.name == DEFAULT_TEMPLATE_KEY).first()
    if not tpl:
        raise HTTPException(status_code=500, detail="Default intake template missing; restart server to seed.")
    return tpl


class FieldOut(BaseModel):
    id: int
    name: str
    field_type: str
    description: str | None
    sort_order: int
    is_required: bool


class IntakeTemplateOut(BaseModel):
    template_id: int
    intake_title: str | None
    fields: list[FieldOut]


class FieldCreate(BaseModel):
    name: str
    field_type: str = "string"
    description: str | None = None
    is_required: bool = True


class FieldPatch(BaseModel):
    name: str | None = None
    field_type: str | None = None
    description: str | None = None
    is_required: bool | None = None
    sort_order: int | None = None


class ReorderBody(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1)


class IntakeTitleBody(BaseModel):
    intake_title: str


def _parse_field_type(raw: str) -> FieldType:
    key = (raw or "string").lower().strip()
    mapping = {
        "string": FieldType.STRING,
        "short_text": FieldType.STRING,
        "long_text": FieldType.LONG_TEXT,
        "integer": FieldType.INTEGER,
        "number": FieldType.INTEGER,
        "boolean": FieldType.BOOLEAN,
        "checkbox": FieldType.BOOLEAN,
        "date": FieldType.DATE,
        "email": FieldType.EMAIL,
        "phone": FieldType.PHONE,
        "address": FieldType.ADDRESS,
        "url": FieldType.URL,
        "link": FieldType.URL,
    }
    if key not in mapping:
        raise HTTPException(status_code=400, detail=f"Unsupported field_type: {raw}")
    return mapping[key]


def _serialize_field(ft: FieldTemplate) -> FieldOut:
    return FieldOut(
        id=ft.id,
        name=ft.name,
        field_type=ft.field_type.value if hasattr(ft.field_type, "value") else str(ft.field_type),
        description=ft.description,
        sort_order=ft.sort_order or 0,
        is_required=bool(ft.is_required),
    )


@router.get("", response_model=IntakeTemplateOut)
async def get_intake_template(db=db_dependency, user=staff_user_dependency):
    tpl = _default_template(db)
    fields = (
        db.query(FieldTemplate)
        .filter(FieldTemplate.form_template_id == tpl.id, FieldTemplate.form_id.is_(None))
        .order_by(FieldTemplate.sort_order.asc(), FieldTemplate.id.asc())
        .all()
    )
    return IntakeTemplateOut(
        template_id=tpl.id,
        intake_title=tpl.intake_title,
        fields=[_serialize_field(f) for f in fields],
    )


@router.put("/settings/title")
async def update_intake_title(
    body: IntakeTitleBody,
    db=db_dependency,
    user=staff_user_dependency,
):
    tpl = _default_template(db)
    tpl.intake_title = body.intake_title.strip() or tpl.intake_title
    db.add(tpl)
    db.commit()
    return {"template_id": tpl.id, "intake_title": tpl.intake_title}


@router.post("/fields", response_model=FieldOut)
async def create_field(
    body: FieldCreate,
    db=db_dependency,
    user=staff_user_dependency,
):
    tpl = _default_template(db)
    mx = (
        db.query(func.max(FieldTemplate.sort_order))
        .filter(FieldTemplate.form_template_id == tpl.id, FieldTemplate.form_id.is_(None))
        .scalar()
    )
    next_order = (mx or 0) + 1
    ft = FieldTemplate(
        name=body.name.strip(),
        field_type=_parse_field_type(body.field_type),
        description=body.description,
        sort_order=next_order,
        is_required=body.is_required,
        form_template_id=tpl.id,
        form_id=None,
    )
    db.add(ft)
    db.commit()
    db.refresh(ft)
    return _serialize_field(ft)


@router.patch("/fields/{field_id}", response_model=FieldOut)
async def patch_field(
    field_id: int,
    body: FieldPatch,
    db=db_dependency,
    user=staff_user_dependency,
):
    tpl = _default_template(db)
    ft = (
        db.query(FieldTemplate)
        .filter(
            FieldTemplate.id == field_id,
            FieldTemplate.form_template_id == tpl.id,
            FieldTemplate.form_id.is_(None),
        )
        .first()
    )
    if not ft:
        raise HTTPException(status_code=404, detail="Field not found.")
    if body.name is not None:
        ft.name = body.name.strip()
    if body.field_type is not None:
        ft.field_type = _parse_field_type(body.field_type)
    if body.description is not None:
        ft.description = body.description
    if body.is_required is not None:
        ft.is_required = body.is_required
    if body.sort_order is not None:
        ft.sort_order = body.sort_order
    db.add(ft)
    db.commit()
    db.refresh(ft)
    return _serialize_field(ft)


@router.delete("/fields/{field_id}")
async def delete_field(
    field_id: int,
    db=db_dependency,
    user=staff_user_dependency,
):
    tpl = _default_template(db)
    ft = (
        db.query(FieldTemplate)
        .filter(
            FieldTemplate.id == field_id,
            FieldTemplate.form_template_id == tpl.id,
            FieldTemplate.form_id.is_(None),
        )
        .first()
    )
    if not ft:
        raise HTTPException(status_code=404, detail="Field not found.")
    used = db.query(FieldSubmission).filter(FieldSubmission.field_template_id == field_id).count()
    if used > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete: submissions already reference this field.",
        )
    db.delete(ft)
    db.commit()
    return {"deleted": field_id}


@router.post("/fields/reorder")
async def reorder_fields(
    body: ReorderBody,
    db=db_dependency,
    user=staff_user_dependency,
):
    tpl = _default_template(db)
    fields = (
        db.query(FieldTemplate)
        .filter(FieldTemplate.form_template_id == tpl.id, FieldTemplate.form_id.is_(None))
        .all()
    )
    id_set = {f.id for f in fields}
    if len(id_set) == 0:
        return {"ok": True}
    if set(body.ordered_ids) != id_set:
        raise HTTPException(status_code=400, detail="ordered_ids must include every field id exactly once.")
    for i, fid in enumerate(body.ordered_ids):
        ft = next(f for f in fields if f.id == fid)
        ft.sort_order = i
        db.add(ft)
    db.commit()
    return {"ok": True}
