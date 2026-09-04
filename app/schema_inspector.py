from sqlalchemy import inspect

from app.database import engine


def get_database_schema():

    inspector = inspect(engine)

    schema = {}

    for table in inspector.get_table_names():

        columns = inspector.get_columns(table)

        schema[table] = []

        for column in columns:

            schema[table].append({
                "name": column["name"],
                "type": str(column["type"])
            })

    return schema


def get_schema_text():

    schema = get_database_schema()

    lines = ["Database Schema:"]

    for table, columns in schema.items():

        lines.append("")
        lines.append(f"Table: {table}")

        for column in columns:

            lines.append(
                f"- {column['name']}: {column['type']}"
            )

    return "\n".join(lines)