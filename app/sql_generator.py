from app.groq_client import GroqLLM


llm = GroqLLM()


def generate_sql(question: str, schema: str):
    prompt = f"""
You are an expert PostgreSQL SQL generator.

Your task is to convert the user's natural language question
into exactly ONE PostgreSQL SELECT query.

DATABASE SCHEMA:
{schema}

USER QUESTION:
{question}


IMPORTANT RULES:

1. Use ONLY tables and columns that actually exist in the database schema.

2. NEVER invent a database column.

3. Natural-language phrases are NOT automatically column names.

4. Only SELECT queries are allowed.

5. Never use INSERT.

6. Never use UPDATE.

7. Never use DELETE.

8. Never use DROP.

9. Never use ALTER.

10. Never use CREATE.

11. Never use TRUNCATE.

12. Use JOIN when multiple tables are required.

13. Before generating SQL, map the user's words to the
    actual tables and columns in the schema.

14. If the user asks for a calculation such as total,
    average, count, maximum, or minimum, use the appropriate
    SQL aggregation function.

15. Do not invent calculated columns.


BUSINESS MEANINGS:

These are meanings, NOT database column names.

"total order amount"
    means SUM(orders.amount)

"total order value"
    means SUM(orders.amount)

"order amount"
    means orders.amount

"total revenue"
    means SUM(revenue.amount)

"revenue amount"
    means revenue.amount

"total orders"
    means COUNT(orders.order_id)

"number of orders"
    means COUNT(orders.order_id)

"order count"
    means COUNT(orders.order_id)

"average order value"
    means AVG(orders.amount)

"average order amount"
    means AVG(orders.amount)

"maximum order amount"
    means MAX(orders.amount)

"minimum order amount"
    means MIN(orders.amount)


NEVER ASSUME THESE ARE DATABASE COLUMNS:

total_order_amount
total_order_value
total_revenue
total_orders
number_of_orders
order_count
average_order_value
average_order_amount
maximum_order_amount
minimum_order_amount


CUSTOMER / ORDER RELATIONSHIP:

customers.customer_id = orders.customer_id


CUSTOMER / REVENUE RELATIONSHIP:

customers.customer_id = revenue.customer_id


DATE RULES:

For July 2026:

date_column >= '2026-07-01'
AND date_column < '2026-08-01'


For August 2026:

date_column >= '2026-08-01'
AND date_column < '2026-09-01'


For last month:

date_column >= DATE_TRUNC(
    'month',
    CURRENT_DATE - INTERVAL '1 month'
)
AND date_column < DATE_TRUNC(
    'month',
    CURRENT_DATE
)


For this month:

date_column >= DATE_TRUNC(
    'month',
    CURRENT_DATE
)
AND date_column < DATE_TRUNC(
    'month',
    CURRENT_DATE + INTERVAL '1 month'
)


For last 7 days:

date_column >= CURRENT_DATE - INTERVAL '7 days'


AGGREGATION RULES:

If using SUM(), AVG(), COUNT(), MAX(), or MIN()
together with normal columns, use GROUP BY where required.

Example:

SELECT
    c.name,
    SUM(o.amount) AS total_order_amount
FROM customers c
JOIN orders o
    ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.name;


IMPORTANT:

The alias "total_order_amount" is allowed when created using:

SUM(o.amount) AS total_order_amount

But this is NOT allowed:

SELECT total_order_amount
FROM orders

because total_order_amount is not an actual database column.


LIMIT:

Do NOT use LIMIT unless the user explicitly asks for
a specific number of results.

For example:

"top 5 customers"

may use:

ORDER BY ...
LIMIT 5


OUTPUT:

Return ONLY the SQL query.

Do NOT return:

- Markdown
- ```sql
- Explanation
- Comments
- Multiple queries
- Natural language

Return exactly ONE PostgreSQL SELECT query.
"""

    sql = llm.generate(prompt)

    # Remove markdown if the model accidentally adds it
    sql = sql.replace("```sql", "")
    sql = sql.replace("```", "")

    sql = sql.strip()

    if not sql:
        raise ValueError("SQL generator returned an empty query")

    return sql