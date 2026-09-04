import sqlglot
from sqlglot import exp

from app.schema_inspector import get_database_schema


def validate_sql(sql: str) -> bool:
    is_valid, _ = validate_sql_with_reason(sql)
    return is_valid


def validate_sql_with_reason(sql: str):

    sql = sql.strip()

    if not sql:
        return False, "SQL query is empty"

    # ---------------------------------------------------------
    # 1. Parse SQL
    # ---------------------------------------------------------

    try:
        statements = sqlglot.parse(
            sql,
            dialect="postgres"
        )

    except Exception as e:
        return False, f"Invalid SQL syntax: {str(e)}"

    # ---------------------------------------------------------
    # 2. Only ONE SQL statement
    # ---------------------------------------------------------

    if len(statements) != 1:
        return False, "Only one SQL statement is allowed"

    expression = statements[0]

    # ---------------------------------------------------------
    # 3. Only SELECT allowed
    # ---------------------------------------------------------

    if not isinstance(expression, exp.Select):
        return False, "Only SELECT queries are allowed"

    # ---------------------------------------------------------
    # 4. Block dangerous operations
    # ---------------------------------------------------------

    dangerous_expressions = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.Alter,
        exp.Create,
        exp.Grant,
        exp.Revoke,
        exp.TruncateTable,
    )

    for node in expression.walk():

        if isinstance(node, dangerous_expressions):
            return False, "Dangerous SQL operation is not allowed"

    # ---------------------------------------------------------
    # 5. Get actual database schema
    # ---------------------------------------------------------

    schema = get_database_schema()

    valid_tables = set(schema.keys())

    table_columns = {}

    for table, columns in schema.items():

        table_columns[table] = {
            column["name"]
            for column in columns
        }

    # ---------------------------------------------------------
    # 6. Find tables + aliases used in query
    # ---------------------------------------------------------

    aliases = {}

    for table in expression.find_all(exp.Table):

        table_name = table.name

        # Check actual table exists
        if table_name not in valid_tables:

            return False, (
                f"Table '{table_name}' does not exist"
            )

        # Actual table name
        aliases[table_name] = table_name

        # Table alias
        alias = table.alias

        if alias:
            aliases[alias] = table_name

    # ---------------------------------------------------------
    # 7. IMPORTANT:
    #    Collect SELECT aliases
    #
    #    Example:
    #
    #    SUM(o.amount) AS total_order_amount
    #
    #    total_order_amount is NOT a database column.
    #    It is a calculated alias.
    # ---------------------------------------------------------

    select_aliases = set()

    for select_expression in expression.expressions:

        if isinstance(select_expression, exp.Alias):

            alias_name = select_expression.alias

            if alias_name:
                select_aliases.add(alias_name)

    # ---------------------------------------------------------
    # 8. Validate columns
    # ---------------------------------------------------------

    for column in expression.find_all(exp.Column):

        column_name = column.name

        # SELECT *
        if column_name == "*":
            continue

        # -----------------------------------------------------
        # IMPORTANT:
        #
        # If column is an alias generated inside SELECT,
        # do NOT validate it as a database column.
        #
        # Example:
        #
        # SUM(o.amount) AS total_order_amount
        #
        # total_order_amount is allowed.
        # -----------------------------------------------------

        if column_name in select_aliases:
            continue

        # -----------------------------------------------------
        # Column has table/alias reference
        #
        # Example:
        #
        # c.name
        # o.amount
        # -----------------------------------------------------

        table_reference = column.table

        if table_reference:

            if table_reference not in aliases:

                return False, (
                    f"Table or alias '{table_reference}' "
                    "does not exist in this query"
                )

            actual_table = aliases[table_reference]

            if column_name not in table_columns[actual_table]:

                return False, (
                    f"Column '{column_name}' does not exist "
                    f"in table '{actual_table}'"
                )

        # -----------------------------------------------------
        # Column without table reference
        #
        # Example:
        #
        # SELECT name
        # FROM customers
        # -----------------------------------------------------

        else:

            matching_tables = []

            for table_name, columns in table_columns.items():

                if column_name in columns:

                    matching_tables.append(table_name)

            # Column doesn't exist anywhere
            if len(matching_tables) == 0:

                return False, (
                    f"Column '{column_name}' "
                    "does not exist in the database"
                )

            # Column exists in multiple tables
            elif len(matching_tables) > 1:

                used_tables = set(aliases.values())

                used_matching_tables = (
                    set(matching_tables) & used_tables
                )

                if len(used_matching_tables) > 1:

                    return False, (
                        f"Column '{column_name}' is ambiguous"
                    )

    # ---------------------------------------------------------
    # 9. Everything is valid
    # ---------------------------------------------------------

    return True, None