import os
import logging
from pyairtable import Api

logger = logging.getLogger(__name__)

def sync_to_airtable(conversation, fields: dict) -> str | None:
    """
    Sync a conversation's field submissions to Airtable.
    Returns the Airtable record ID if successful, None if failed.
    """
    api_key = os.getenv("AIRTABLE_API_KEY")
    base_id = os.getenv("AIRTABLE_BASE_ID")
    table_id = os.getenv("AIRTABLE_TABLE_ID")

    if not all([api_key, base_id, table_id]):
        logger.warning("Airtable credentials not configured, skipping sync.")
        return None

    try:
        api = Api(api_key)
        table = api.table(base_id, table_id)

        # Build record data
        record_data = {
            "Submitter Name": f"{conversation.owner.firstname} {conversation.owner.lastname}" if conversation.owner else "Unknown",
            "Submitter Email": conversation.owner.email if conversation.owner else "",
            "Submission Date": str(conversation.started_at.strftime("%Y-%m-%d") if conversation.started_at else ""),
            "Conversation ID": str(conversation.id),
        }

        # Add all form fields
        for field_name, value in fields.items():
            if value:
                record_data[field_name] = value

        # Check if record already exists for this conversation
        existing = table.all(formula=f"{{Conversation ID}}='{conversation.id}'")
        if existing:
            record_id = existing[0]["id"]
            table.update(record_id, record_data)
            logger.info("Updated Airtable record %s for conversation %s", record_id, conversation.id)
            return record_id
        else:
            record = table.create(record_data)
            record_id = record["id"]
            logger.info("Created Airtable record %s for conversation %s", record_id, conversation.id)
            return record_id

    except Exception as e:
        logger.error("Airtable sync failed for conversation %s: %s", conversation.id, e)
        return None