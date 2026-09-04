import os

from dotenv import load_dotenv
from groq import Groq

from app.llm import LLM

load_dotenv()


class GroqLLM(LLM):

    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")

        self.client = Groq(api_key=api_key)

        self.model = "openai/gpt-oss-20b"

    def generate(self, prompt: str):

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0
        )

        content = response.choices[0].message.content

        if not content:
            raise RuntimeError("Database sent an empty response")

        return content.strip()