"""Pluggable food-recognition-from-photo providers.

The active provider is chosen at request time:
- If the `anthropic` package is installed and ANTHROPIC_API_KEY is set,
  photos are analyzed with Claude vision (structured output).
- Otherwise a disabled provider is returned, so the API endpoint and the
  frontend flow keep working and a different vision service can be dropped
  in later by implementing `recognize()`.
"""

import base64
import os

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
                "Photo recognition is not configured. Set ANTHROPIC_API_KEY on the "
                "server (and `pip install anthropic`) to enable it, or add the foods manually."
            ),
        )


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
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            import anthropic  # noqa: F401
            return ClaudeProvider()
        except ImportError:
            pass
    return DisabledProvider()
