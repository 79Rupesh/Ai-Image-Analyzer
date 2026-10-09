
import os
import json
import base64
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from openai import OpenAI

load_dotenv()

app = FastAPI(title="AI Image Analyzer API")

# Allow the local HTML frontend to call this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "null",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

api_key = os.getenv("OPENROUTER_API_KEY")

client = (
    OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    if api_key
    else None
)


@app.get("/")
def home():
    return {"message": "AI Image Analyzer backend is running"}


@app.post("/api/analyze")
async def analyze_image(image: UploadFile = File(...)):

    if client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is missing in .env",
        )

    if image.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG or WEBP image.",
        )

    # Read uploaded image; limit size to 10 MB.
    raw_bytes = await image.read()

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    if len(raw_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image size must be 10 MB or less.",
        )

    try:
        with Image.open(BytesIO(raw_bytes)) as uploaded:
            uploaded.load()
            rgb_image = uploaded.convert("RGB")

        # Convert the image to valid JPEG bytes.
        buffer = BytesIO()
        rgb_image.save(buffer, format="JPEG", quality=90)

        image_base64 = base64.b64encode(
            buffer.getvalue()
        ).decode("ascii")

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Could not read the uploaded image.",
        )

    image_url = "data:image/jpeg;base64," + image_base64

    prompt = """
Analyze this image and return ONLY a valid JSON object.
Do not use Markdown code fences.

Use exactly these keys:
{
  "description": "Short description of the image",
  "objects": ["Main object 1", "Main object 2"],
  "colors": ["Dominant color 1", "Dominant color 2"],
  "summary": "Short overall summary"
}

Describe only what is visible in the image.
Use clear, simple English.
"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
        )

        result = response.choices[0].message.content

        if not result:
            raise ValueError("The AI returned an empty response.")

        # Parse the model's JSON response.
        result = result.strip()

        if result.startswith("```"):
            result = result.split("\n", 1)[-1]
            if result.endswith("```"):
                result = result[:-3].strip()

        data = json.loads(result)

        # Validate the fields expected by the frontend.
        for key in ("description", "objects", "colors", "summary"):
            if key not in data:
                raise ValueError(f"Missing response field: {key}")

        return data

    except Exception as exc:
        # Details are logged in the backend terminal.
        print("AI analysis error:", repr(exc))

        raise HTTPException(
            status_code=502,
            detail="AI analysis failed. Check model availability, "
                   "API credits, and the backend terminal.",
        )
