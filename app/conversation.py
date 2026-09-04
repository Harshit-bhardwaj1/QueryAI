import json
import uuid

from sqlalchemy import text

from app.database import engine


# =========================================================
# CREATE CONVERSATION
# =========================================================

def create_conversation(
    user_id: int,
    original_question: str,
    clarification_question: str | None = None,
    options: list | None = None,
):
    conversation_id = str(uuid.uuid4())

    title = original_question.strip()[:60]

    options_text = None

    if options:
        options_text = json.dumps(options)

    with engine.begin() as connection:

        result = connection.execute(
            text("""
                INSERT INTO ai_conversations (
                    conversation_id,
                    user_id,
                    title,
                    original_question,
                    clarification_question,
                    options,
                    status
                )
                VALUES (
                    :conversation_id,
                    :user_id,
                    :title,
                    :original_question,
                    :clarification_question,
                    :options,
                    'started'
                )
                RETURNING
                    conversation_id,
                    user_id,
                    title,
                    original_question,
                    clarification_question,
                    options,
                    user_answer,
                    final_sql,
                    result,
                    status,
                    created_at
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "title": title,
                "original_question": original_question,
                "clarification_question": clarification_question,
                "options": options_text,
            }
        )

        return dict(result.mappings().one())


# =========================================================
# GET ONE CONVERSATION
# =========================================================

def get_conversation(
    conversation_id: str,
    user_id: int
):
    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    conversation_id,
                    user_id,
                    title,
                    original_question,
                    clarification_question,
                    options,
                    user_answer,
                    final_sql,
                    result,
                    status,
                    created_at
                FROM ai_conversations
                WHERE conversation_id = :conversation_id
                AND user_id = :user_id
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user_id
            }
        )

        conversation = result.mappings().first()

        if not conversation:
            return None

        return dict(conversation)


# =========================================================
# GET ALL USER CONVERSATIONS
# =========================================================

def get_all_conversations(user_id: int):

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    conversation_id,
                    user_id,
                    title,
                    original_question,
                    clarification_question,
                    options,
                    user_answer,
                    final_sql,
                    result,
                    status,
                    created_at
                FROM ai_conversations
                WHERE user_id = :user_id
                ORDER BY created_at DESC
            """),
            {
                "user_id": user_id
            }
        )

        return [
            dict(row)
            for row in result.mappings().all()
        ]


# =========================================================
# UPDATE CONVERSATION
# =========================================================

def update_conversation(
    conversation_id: str,
    user_id: int,
    user_answer: str | None = None,
    final_sql: str | None = None,
    result: str | None = None,
    status: str | None = None
):

    with engine.begin() as connection:

        existing = connection.execute(
            text("""
                SELECT conversation_id
                FROM ai_conversations
                WHERE conversation_id = :conversation_id
                AND user_id = :user_id
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user_id
            }
        ).first()

        if not existing:
            return None

        connection.execute(
            text("""
                UPDATE ai_conversations
                SET
                    user_answer = COALESCE(
                        :user_answer,
                        user_answer
                    ),

                    final_sql = COALESCE(
                        :final_sql,
                        final_sql
                    ),

                    result = COALESCE(
                        :result,
                        result
                    ),

                    status = COALESCE(
                        :status,
                        status
                    )
                WHERE conversation_id = :conversation_id
                AND user_id = :user_id
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "user_answer": user_answer,
                "final_sql": final_sql,
                "result": result,
                "status": status
            }
        )

        return get_conversation(
            conversation_id,
            user_id
        )


# =========================================================
# RENAME CONVERSATION
# =========================================================

def rename_conversation(
    conversation_id: str,
    user_id: int,
    title: str
):

    with engine.begin() as connection:

        result = connection.execute(
            text("""
                UPDATE ai_conversations
                SET title = :title
                WHERE conversation_id = :conversation_id
                AND user_id = :user_id
                RETURNING
                    conversation_id,
                    user_id,
                    title
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "title": title.strip()
            }
        )

        conversation = result.mappings().first()

        if not conversation:
            return None

        return dict(conversation)


# =========================================================
# DELETE CONVERSATION
# =========================================================

def delete_conversation(
    conversation_id: str,
    user_id: int
):

    with engine.begin() as connection:

        result = connection.execute(
            text("""
                DELETE FROM ai_conversations
                WHERE conversation_id = :conversation_id
                AND user_id = :user_id
                RETURNING conversation_id
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user_id
            }
        )

        deleted = result.first()

        if not deleted:
            return False

        return True