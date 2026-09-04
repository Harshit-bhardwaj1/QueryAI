import json

from app.groq_client import GroqLLM


llm = GroqLLM()


AMBIGUOUS_WORDS = {
    "best",
    "top",
    "good",
    "popular",
    "valuable",
    "important",
    "worst",
    "successful",
    "performing"
}


def needs_clarification(question: str) -> bool:

    question_lower = question.lower()

    return any(
        word in question_lower
        for word in AMBIGUOUS_WORDS
    )


def analyze_question(question: str, schema: str):

    prompt = f"""
You are a database query clarification assistant.

Database Schema:
{schema}

User Question:
{question}

Determine whether the question is ambiguous.

Rules:

1. If there is one clear interpretation, return false.
2. If a subjective word creates multiple interpretations,
   return true.
3. Examples:
   best, top, good, popular, valuable,
   successful, worst, performing.
4. If ambiguous, ask ONE short clarification question.
5. Give 2 to 4 useful options.
6. Options must be based on the database schema.
7. Return ONLY valid JSON.

Example:

{{
    "is_ambiguous": true,
    "clarification_question":
        "How would you like to define best customers?",
    "options": [
        "Highest total order amount",
        "Most number of orders",
        "Highest total revenue"
    ]
}}

For clear question:

{{
    "is_ambiguous": false,
    "clarification_question": null,
    "options": []
}}
"""

    response = llm.generate(prompt)

    response = response.replace("```json", "")
    response = response.replace("```", "")
    response = response.strip()

    try:
        return json.loads(response)

    except json.JSONDecodeError:

        raise ValueError(
            "Invalid clarification response from AI"
        )