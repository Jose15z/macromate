"""Pluggable food-recognition-from-photo providers.

The active provider is chosen at request time:
- If GEMINI_API_KEY is set, photos are analyzed with the Google Gemini API
  (free tier available) using structured JSON output.
- Else, if the `anthropic` package is installed and ANTHROPIC_API_KEY is
  set, photos are analyzed with Claude vision (structured output).
- Otherwise a disabled provider is returned, so the API endpoint and the
  frontend flow keep working and another vision service can be dropped in
  later by implementing `recognize()`.
"""

import base64
import os
import re

import requests
from pydantic import BaseModel, Field


class DetectedFood(BaseModel):
    name: str = Field(description="Short name of the food, e.g. 'Grilled chicken breast'")
    estimated_grams: float = Field(description="Estimated portion weight in grams")
    kcal_100g: float = Field(description="Estimated calories per 100 g")
    protein_100g: float = Field(description="Estimated protein grams per 100 g")
    carbs_100g: float = Field(description="Estimated carbohydrate grams per 100 g")
    fat_100g: float = Field(description="Estimated fat grams per 100 g")
    confidence: float = Field(description="Confidence between 0 and 1")


class RecognitionOutput(BaseModel):
    foods: list[DetectedFood] = Field(
        description="Every distinct food or drink visible in the image; empty if none"
    )


class RecognitionResult(BaseModel):
    available: bool
    provider: str
    foods: list[DetectedFood] = []
    message: str = ""


PROMPT = (
    "Identify every distinct food and drink in this photo. For each item, estimate "
    "the visible portion size in grams and typical nutrition values per 100 g "
    "(calories, protein, carbohydrates, fat). Use standard nutrition-database values "
    "for the foods you recognize. If the image contains no food, return an empty list."
)


class DisabledProvider:
    name = "disabled"

    def recognize(self, image_bytes: bytes, media_type: str) -> RecognitionResult:
        return RecognitionResult(
            available=False,
            provider=self.name,
            message=(
                "Photo recognition is not configured. Set GEMINI_API_KEY (or "
                "ANTHROPIC_API_KEY) on the server to enable it, or add the foods manually."
            ),
        )


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Used only if asking Google for its model list fails (name current as of late 2026)
GEMINI_FALLBACK_MODEL = "gemini-3.8-flash"

_gemini_model_cache: str | None = None


def _model_score(name: str):
    """Rank a Gemini model name: stable > preview, full > lite, newest version."""
    if any(x in name for x in ("image", "live", "tts", "audio", "embedding", "veo", "imagen")):
        return None
    m = re.search(r"(\d+)\.(\d+)", name)
    version = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    stable = not any(x in name for x in ("preview", "exp"))
    full = "lite" not in name
    return (stable, full, version, -len(name))


def _pick_gemini_model(api_key: str) -> str:
    """Choose a vision-capable flash model the key can actually use.

    Google retires model names frequently (a hardcoded id 404s within
    months), so ask the API what's available and cache the answer.
    GEMINI_MODEL overrides everything.
    """
    configured = os.environ.get("GEMINI_MODEL")
    if configured:
        return configured

    global _gemini_model_cache
    if _gemini_model_cache:
        return _gemini_model_cache

    try:
        resp = requests.get(
            GEMINI_LIST_URL,
            params={"pageSize": 1000},
            headers={"x-goog-api-key": api_key},
            timeout=15,
        )
        resp.raise_for_status()
        names = [
            m["name"].split("/", 1)[-1]
            for m in resp.json().get("models", [])
            if "generateContent" in m.get("supportedGenerationMethods", [])
        ]
    except (requests.RequestException, ValueError, KeyError):
        return GEMINI_FALLBACK_MODEL

    candidates = [n for n in names if "flash" in n and _model_score(n)]
    if not candidates:
        candidates = [n for n in names if _model_score(n)]
    if not candidates:
        return GEMINI_FALLBACK_MODEL

    _gemini_model_cache = max(candidates, key=_model_score)
    return _gemini_model_cache

# Gemini structured-output schema (OpenAPI-style subset) mirroring RecognitionOutput
GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "foods": {
            "type": "ARRAY",
            "description": "Every distinct food or drink visible in the image; empty if none",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING", "description": "Short name, e.g. 'Grilled chicken breast'"},
                    "estimated_grams": {"type": "NUMBER", "description": "Estimated portion weight in grams"},
                    "kcal_100g": {"type": "NUMBER", "description": "Calories per 100 g"},
                    "protein_100g": {"type": "NUMBER", "description": "Protein grams per 100 g"},
                    "carbs_100g": {"type": "NUMBER", "description": "Carbohydrate grams per 100 g"},
                    "fat_100g": {"type": "NUMBER", "description": "Fat grams per 100 g"},
                    "confidence": {"type": "NUMBER", "description": "Confidence between 0 and 1"},
                },
                "required": [
                    "name", "estimated_grams", "kcal_100g",
                    "protein_100g", "carbs_100g", "fat_100g", "confidence",
                ],
            },
        }
    },
    "required": ["foods"],
}


class GeminiProvider:
    name = "gemini"

    def _call(self, api_key: str, model: str, body: dict):
        return requests.post(
            GEMINI_URL.format(model=model),
            json=body,
            # key goes in a header, never in the URL
            headers={"x-goog-api-key": api_key},
            timeout=60,
        )

    def recognize(self, image_bytes: bytes, media_type: str) -> RecognitionResult:
        global _gemini_model_cache
        api_key = os.environ["GEMINI_API_KEY"]
        model = _pick_gemini_model(api_key)
        body = {
            "contents": [
                {
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": media_type,
                                "data": base64.standard_b64encode(image_bytes).decode(),
                            }
                        },
                        {"text": PROMPT},
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_SCHEMA,
            },
        }

        try:
            resp = self._call(api_key, model, body)
            if resp.status_code == 404 and not os.environ.get("GEMINI_MODEL"):
                # Google retired the cached model name — re-discover and retry once
                _gemini_model_cache = None
                model = _pick_gemini_model(api_key)
                resp = self._call(api_key, model, body)
        except requests.RequestException:
            return RecognitionResult(
                available=True,
                provider=self.name,
                message="Could not reach the recognition service. Try again in a moment.",
            )

        if resp.status_code != 200:
            try:
                detail = resp.json()["error"]["message"][:200]
            except (ValueError, KeyError, TypeError):
                detail = ""
            return RecognitionResult(
                available=True,
                provider=self.name,
                message=(
                    f"Recognition service error (HTTP {resp.status_code}, model {model}). "
                    + (detail or "Check the GEMINI_API_KEY configured on the server.")
                ),
            )

        try:
            data = resp.json()
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
            output = RecognitionOutput.model_validate_json(text)
        except (KeyError, IndexError, ValueError):
            # blocked/empty candidates or malformed JSON
            return RecognitionResult(
                available=True,
                provider=self.name,
                message="The image could not be analyzed. Try another photo or add foods manually.",
            )

        return RecognitionResult(available=True, provider=self.name, foods=output.foods)


class ClaudeProvider:
    name = "claude"

    def recognize(self, image_bytes: bytes, media_type: str) -> RecognitionResult:
        import anthropic

        client = anthropic.Anthropic()
        image_b64 = base64.standard_b64encode(image_bytes).decode()

        try:
            response = client.messages.parse(
                model="claude-opus-5",
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_b64,
                                },
                            },
                            {"type": "text", "text": PROMPT},
                        ],
                    }
                ],
                output_format=RecognitionOutput,
            )
        except anthropic.APIError as e:
            return RecognitionResult(
                available=True,
                provider=self.name,
                message=f"Recognition service error: {e.__class__.__name__}",
            )

        if response.stop_reason == "refusal" or response.parsed_output is None:
            return RecognitionResult(
                available=True,
                provider=self.name,
                message="The image could not be analyzed. Try another photo or add foods manually.",
            )

        return RecognitionResult(
            available=True,
            provider=self.name,
            foods=response.parsed_output.foods,
        )


def get_provider():
    if os.environ.get("GEMINI_API_KEY"):
        return GeminiProvider()
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            import anthropic  # noqa: F401
            return ClaudeProvider()
        except ImportError:
            pass
    return DisabledProvider()
