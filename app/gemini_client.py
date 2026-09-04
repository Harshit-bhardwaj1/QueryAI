# Gemini client is currently disabled.
# We are using Groq for the project.

# import os
# from dotenv import load_dotenv
# from google import genai
# from app.llm import LLM

# load_dotenv()


# class GeminiLLM(LLM):

#     def __init__(self):
#         api_key = os.getenv("GEMINI_API_KEY")

#         if not api_key:
#             raise RuntimeError("GEMINI_API_KEY is not configured")

#         self.client = genai.Client(api_key=api_key)

#     def generate(self, prompt: str) -> str:

#         chat = self.client.chats.create(
#             model="gemini-3.5-flash-lite"
#         )

#         response = chat.send_message(prompt)

#         if not response.text:
#             raise RuntimeError("Gemini returned an empty response")

#         return response.text.strip()