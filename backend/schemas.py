from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

MealType = Literal["breakfast", "lunch", "dinner", "snack"]
FoodSource = Literal["off", "manual", "ai"]


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=80)
    kcal_goal: Optional[float] = Field(default=None, gt=0, le=20000)
    protein_goal: Optional[float] = Field(default=None, gt=0, le=2000)
    carbs_goal: Optional[float] = Field(default=None, gt=0, le=2000)
    fat_goal: Optional[float] = Field(default=None, gt=0, le=2000)


# ---------- Foods ----------

class FoodCreate(BaseModel):
    """Create a reusable food. Macros are interpreted according to `basis`:
    per_100g (default) or per_serving (requires serving_size_g)."""

    name: str = Field(min_length=1, max_length=200)
    brand: str = Field(default="", max_length=200)
    barcode: Optional[str] = Field(default=None, max_length=64)
    image_url: str = Field(default="", max_length=1000)
    basis: Literal["per_100g", "per_serving"] = "per_100g"
    serving_size_g: Optional[float] = Field(default=None, gt=0, le=5000)
    kcal: float = Field(ge=0, le=10000)
    protein: float = Field(ge=0, le=1000)
    carbs: float = Field(ge=0, le=1000)
    fat: float = Field(ge=0, le=1000)

    @model_validator(mode="after")
    def check_serving(self):
        if self.basis == "per_serving" and not self.serving_size_g:
            raise ValueError("serving_size_g is required when basis is per_serving")
        return self

    def per_100g(self) -> dict:
        if self.basis == "per_100g":
            factor = 1.0
        else:
            factor = 100.0 / self.serving_size_g
        return {
            "kcal_100g": self.kcal * factor,
            "protein_100g": self.protein * factor,
            "carbs_100g": self.carbs * factor,
            "fat_100g": self.fat * factor,
        }


class FoodUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    brand: Optional[str] = Field(default=None, max_length=200)
    serving_size_g: Optional[float] = Field(default=None, gt=0, le=5000)
    kcal_100g: Optional[float] = Field(default=None, ge=0, le=10000)
    protein_100g: Optional[float] = Field(default=None, ge=0, le=1000)
    carbs_100g: Optional[float] = Field(default=None, ge=0, le=1000)
    fat_100g: Optional[float] = Field(default=None, ge=0, le=1000)
    is_saved: Optional[bool] = None


class InlineFood(BaseModel):
    """Food definition embedded in a diary-entry request (macros per 100 g)."""

    name: str = Field(min_length=1, max_length=200)
    brand: str = Field(default="", max_length=200)
    barcode: Optional[str] = Field(default=None, max_length=64)
    image_url: str = Field(default="", max_length=1000)
    source: FoodSource = "manual"
    kcal_100g: float = Field(ge=0, le=10000)
    protein_100g: float = Field(ge=0, le=1000)
    carbs_100g: float = Field(ge=0, le=1000)
    fat_100g: float = Field(ge=0, le=1000)
    serving_size_g: Optional[float] = Field(default=None, gt=0, le=5000)
    is_saved: Optional[bool] = None  # default depends on source


# ---------- Diary ----------

class EntryCreate(BaseModel):
    date: str = Field(pattern=DATE_PATTERN)
    meal_type: MealType
    grams: float = Field(gt=0, le=5000)
    food_id: Optional[int] = None
    food: Optional[InlineFood] = None

    @model_validator(mode="after")
    def check_food(self):
        if (self.food_id is None) == (self.food is None):
            raise ValueError("Provide exactly one of food_id or food")
        return self


class EntryUpdate(BaseModel):
    grams: Optional[float] = Field(default=None, gt=0, le=5000)
    meal_type: Optional[MealType] = None
    date: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
