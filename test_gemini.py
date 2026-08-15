import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

resp = client.models.generate_content(
    model="gemini-flash-lite-latest",
    contents="Say hello in Bahasa Malaysia and Manglish, one sentence each."
)
print(resp.text)