import json

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from fastapi.middleware.cors import CORSMiddleware

from app.users import (
    create_user,
    authenticate_user,
    get_user
)

from app.auth import (
    create_access_token,
    get_current_user
)

from app.schema_inspector import get_schema_text

from app.clarification import analyze_question

from app.sql_generator import generate_sql

from app.sql_executor import execute_sql

from app.conversation import (
    create_conversation,
    get_conversation,
    get_all_conversations,
    update_conversation,
    rename_conversation,
    delete_conversation
)


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Text-to-SQL AI",
    description="AI-powered Text-to-SQL system with authentication",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# REQUEST MODELS
# =========================================================

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AskRequest(BaseModel):
    question: str


class ClarificationRequest(BaseModel):
    conversation_id: str
    answer: str


class RenameConversationRequest(BaseModel):
    title: str


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():
    return {
        "message": "Text-to-SQL AI is running!"
    }


# =========================================================
# AUTH - SIGNUP
# =========================================================

@app.post("/auth/signup")
def signup(data: SignupRequest):

    if not data.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Name is required"
        )

    if len(data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )

    try:

        user = create_user(
            name=data.name,
            email=data.email,
            password=data.password
        )

        token = create_access_token(
            user["user_id"]
        )

        return {
            "message": "Account created successfully",

            "access_token": token,

            "token_type": "bearer",

            "user": {
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user["email"],
                "created_at": user["created_at"]
            }
        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# =========================================================
# AUTH - LOGIN
# =========================================================

@app.post("/auth/login")
def login(data: LoginRequest):

    user = authenticate_user(
        email=data.email,
        password=data.password
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(
        user["user_id"]
    )

    return {
        "message": "Login successful",

        "access_token": token,

        "token_type": "bearer",

        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"]
        }
    }


# =========================================================
# AUTH - CURRENT USER
# =========================================================

@app.get("/auth/me")
def get_me(
    user_id: int = Depends(get_current_user)
):

    user = get_user(user_id)

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "user": user
    }


# =========================================================
# ASK AI
# =========================================================

@app.post("/ask")
def ask_ai(
    data: AskRequest,
    user_id: int = Depends(get_current_user)
):

    question = data.question.strip()

    if not question:

        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    try:

        # -------------------------------------------------
        # Get current database schema
        # -------------------------------------------------

        schema = get_schema_text()


        # -------------------------------------------------
        # Step 1: Analyze question
        # -------------------------------------------------

        analysis = analyze_question(
            question,
            schema
        )


        # -------------------------------------------------
        # Step 2: Question is ambiguous
        # -------------------------------------------------

        if analysis.get("is_ambiguous"):

            conversation = create_conversation(
                user_id=user_id,
                original_question=question,
                clarification_question=analysis.get(
                    "clarification_question"
                ),
                options=analysis.get(
                    "options",
                    []
                )
            )

            return {
                "status": "clarification_required",

                "conversation_id": conversation[
                    "conversation_id"
                ],

                "question": question,

                "clarification_question": analysis.get(
                    "clarification_question"
                ),

                "options": analysis.get(
                    "options",
                    []
                )
            }


        # -------------------------------------------------
        # Step 3: Question is clear
        # -------------------------------------------------

        sql = generate_sql(
            question,
            schema
        )


        # -------------------------------------------------
        # Step 4: Execute SQL
        # -------------------------------------------------

        result = execute_sql(sql)


        # -------------------------------------------------
        # Step 5: Save conversation
        # -------------------------------------------------

        conversation = create_conversation(
            user_id=user_id,
            original_question=question
        )

        conversation_id = conversation[
            "conversation_id"
        ]


        update_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            final_sql=sql,
            result=json.dumps(result),
            status="completed"
        )


        # -------------------------------------------------
        # Return response
        # -------------------------------------------------

        return {
            "status": "completed",

            "conversation_id": conversation_id,

            "question": question,

            "sql": sql,

            "result": result
        }


    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(error)}"
        )


# =========================================================
# CLARIFICATION ANSWER
# =========================================================

@app.post("/clarify")
def clarify_question(
    data: ClarificationRequest,
    user_id: int = Depends(get_current_user)
):

    answer = data.answer.strip()

    if not answer:

        raise HTTPException(
            status_code=400,
            detail="Clarification answer cannot be empty"
        )


    # -----------------------------------------------------
    # Get conversation
    # -----------------------------------------------------

    conversation = get_conversation(
        conversation_id=data.conversation_id,
        user_id=user_id
    )

    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )


    # -----------------------------------------------------
    # Get original question
    # -----------------------------------------------------

    original_question = conversation[
        "original_question"
    ]


    try:

        # -------------------------------------------------
        # Get database schema
        # -------------------------------------------------

        schema = get_schema_text()


        # -------------------------------------------------
        # Combine original question + clarification
        # -------------------------------------------------

        clarified_question = f"""
Original user question:

{original_question}

User's clarification:

{answer}
"""


        # -------------------------------------------------
        # Generate SQL
        # -------------------------------------------------

        sql = generate_sql(
            clarified_question,
            schema
        )


        # -------------------------------------------------
        # Execute SQL
        # -------------------------------------------------

        result = execute_sql(sql)


        # -------------------------------------------------
        # Save clarification + final result
        # -------------------------------------------------

        update_conversation(
            conversation_id=data.conversation_id,
            user_id=user_id,
            user_answer=answer,
            final_sql=sql,
            result=json.dumps(result),
            status="completed"
        )


        # -------------------------------------------------
        # Return result
        # -------------------------------------------------

        return {
            "status": "completed",

            "conversation_id": data.conversation_id,

            "question": original_question,

            "clarification_answer": answer,

            "sql": sql,

            "result": result
        }


    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(error)}"
        )


# =========================================================
# GET ALL USER CONVERSATIONS
# =========================================================

@app.get("/conversations")
def conversations(
    user_id: int = Depends(get_current_user)
):

    return {
        "conversations": get_all_conversations(
            user_id
        )
    }


# =========================================================
# GET ONE CONVERSATION
# =========================================================

@app.get("/conversations/{conversation_id}")
def conversation_details(
    conversation_id: str,
    user_id: int = Depends(get_current_user)
):

    conversation = get_conversation(
        conversation_id=conversation_id,
        user_id=user_id
    )

    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return {
        "conversation": conversation
    }


# =========================================================
# RENAME CONVERSATION
# =========================================================

@app.patch("/conversations/{conversation_id}")
def rename_chat(
    conversation_id: str,
    data: RenameConversationRequest,
    user_id: int = Depends(get_current_user)
):

    title = data.title.strip()

    if not title:

        raise HTTPException(
            status_code=400,
            detail="Title cannot be empty"
        )

    if len(title) > 200:

        raise HTTPException(
            status_code=400,
            detail="Title cannot exceed 200 characters"
        )

    conversation = rename_conversation(
        conversation_id=conversation_id,
        user_id=user_id,
        title=title
    )

    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return {
        "message": "Conversation renamed successfully",

        "conversation": conversation
    }


# =========================================================
# DELETE CONVERSATION
# =========================================================

@app.delete("/conversations/{conversation_id}")
def remove_conversation(
    conversation_id: str,
    user_id: int = Depends(get_current_user)
):

    deleted = delete_conversation(
        conversation_id=conversation_id,
        user_id=user_id
    )

    if not deleted:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return {
        "message": "Conversation deleted successfully"
    }