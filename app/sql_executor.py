from decimal import Decimal
from datetime import date, datetime
from app.database import engine
from app.sql_validator import validate_sql_with_reason
from sqlalchemy import text


MAX_RESULT_ROWS = 500


def make_json_safe(value):
    """
    Convert PostgreSQL/Python values into JSON-serializable values.
    """

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: make_json_safe(val)
            for key, val in value.items()
        }

    if isinstance(value, list):
        return [
            make_json_safe(item)
            for item in value
        ]

    return value


def execute_sql(sql: str):

    # Validate SQL before execution
    is_valid, reason = validate_sql_with_reason(sql)

    if not is_valid:
        raise ValueError(reason)

    try:

        with engine.connect() as connection:

            result = connection.execute(text(sql))

            rows = result.mappings().fetchmany(MAX_RESULT_ROWS)

            # Convert SQLAlchemy RowMapping objects
            # into normal JSON-safe dictionaries
            return [
                {
                    key: make_json_safe(value)
                    for key, value in dict(row).items()
                }
                for row in rows
            ]

    except Exception as e:

        raise RuntimeError(
            f"Database execution failed: {str(e)}"
        )