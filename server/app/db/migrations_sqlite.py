"""
Lightweight ALTERs for existing SQLite files (create_all does not add new columns).
"""
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def run_sqlite_migrations(engine) -> None:
    url = str(engine.url)
    if not url.startswith("sqlite"):
        return

    with engine.begin() as conn:

        def columns(table: str) -> set:
            r = conn.execute(text(f"PRAGMA table_info({table})"))
            return {row[1] for row in r.fetchall()}

        def add_column(table: str, col: str, ddl: str) -> None:
            if col in columns(table):
                return
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
            logger.info("SQLite migration: added %s.%s", table, col)

        add_column("users", "is_staff", "is_staff INTEGER DEFAULT 0")
        add_column("conversations", "brief_locked_at", "brief_locked_at DATETIME")
        add_column("conversations", "last_draft_saved_at", "last_draft_saved_at DATETIME")
        add_column("conversations", "submission_review_status", "submission_review_status VARCHAR(32)")
        add_column("field_templates", "sort_order", "sort_order INTEGER DEFAULT 0")
        add_column("field_templates", "is_required", "is_required INTEGER DEFAULT 1")
        add_column("form_templates", "intake_title", "intake_title VARCHAR")
