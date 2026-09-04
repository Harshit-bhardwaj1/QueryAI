from sqlalchemy import text

from app.database import engine
from app.auth import hash_password, verify_password


def create_user(
    name: str,
    email: str,
    password: str
):

    email = email.strip().lower()

    with engine.begin() as connection:

        existing = connection.execute(
            text("""
                SELECT user_id
                FROM users
                WHERE email = :email
            """),
            {
                "email": email
            }
        ).fetchone()

        if existing:
            raise ValueError(
                "An account with this email already exists"
            )

        password_hash = hash_password(password)

        result = connection.execute(
            text("""
                INSERT INTO users (
                    name,
                    email,
                    password_hash
                )
                VALUES (
                    :name,
                    :email,
                    :password_hash
                )
                RETURNING user_id, name, email, created_at
            """),
            {
                "name": name.strip(),
                "email": email,
                "password_hash": password_hash
            }
        )

        user = result.mappings().one()

        return dict(user)


def authenticate_user(
    email: str,
    password: str
):

    email = email.strip().lower()

    with engine.connect() as connection:

        user = connection.execute(
            text("""
                SELECT
                    user_id,
                    name,
                    email,
                    password_hash,
                    created_at
                FROM users
                WHERE email = :email
            """),
            {
                "email": email
            }
        ).mappings().first()

    if not user:
        return None

    if not verify_password(
        password,
        user["password_hash"]
    ):
        return None

    return dict(user)


def get_user(user_id: int):

    with engine.connect() as connection:

        user = connection.execute(
            text("""
                SELECT
                    user_id,
                    name,
                    email,
                    created_at
                FROM users
                WHERE user_id = :user_id
            """),
            {
                "user_id": user_id
            }
        ).mappings().first()

    if not user:
        return None

    return dict(user)