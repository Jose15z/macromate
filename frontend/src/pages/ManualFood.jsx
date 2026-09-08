import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import { MEAL_LABELS, MEAL_TYPES, logTarget } from "../utils";

export default function ManualFood() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { date, meal: initialMeal } = logTarget(searchParams);
  const prefillBarcode = searchParams.get("barcode") || "";

  const [meal, setMeal] = useState(initialMeal);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [basis, setBasis] = useState("per_serving");
  const [servingSize, setServingSize] = useState(100);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [logNow, setLogNow] = useState(true);
  const [grams, setGrams] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = {
      name: name.trim(),
      brand: brand.trim(),
      barcode: prefillBarcode || null,
      basis,
      serving_size_g: Number(servingSize) || null,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    };
    if (basis === "per_serving" && !payload.serving_size_g) {
      setError("Enter the serving size in grams");
      return;
    }

    setBusy(true);
    try {
      const food = await api.createFood(payload);
      if (logNow) {
        const amount = Number(grams) || payload.serving_size_g || 100;
        await api.addEntry({
          date,
          meal_type: meal,
          grams: amount,
          food_id: food.id,
        });
        navigate(`/?date=${date}`);
      } else {
        navigate(`/add?date=${date}&meal=${meal}`);
      }
    } catch (err) {
      setError(err.message || "Could not save the food");
      setBusy(false);
    }
  }

  return (
    <div className="manual-page">
      <h2>New food</h2>
      <p className="muted small">
        Create a food once — it stays in your library for quick logging later.
      </p>

      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="e.g. Overnight oats" />
        </label>
        <label>
          Brand <span className="muted small">(optional)</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={200} />
        </label>
        {prefillBarcode && (
          <p className="muted small">Will be linked to barcode {prefillBarcode}.</p>
        )}

        <label>
          Nutrition values are
          <div className="chip-row">
            <button
              type="button"
              className={`chip${basis === "per_serving" ? " active" : ""}`}
              onClick={() => setBasis("per_serving")}
            >
              Per serving
            </button>
            <button
              type="button"
              className={`chip${basis === "per_100g" ? " active" : ""}`}
              onClick={() => setBasis("per_100g")}
            >
              Per 100 g
            </button>
          </div>
        </label>

        <label>
          Serving size (g){basis === "per_100g" && <span className="muted small"> (optional)</span>}
          <input
            type="number"
            min="1"
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            required={basis === "per_serving"}
          />
        </label>

        <div className="grid-2">
          <label>
            Calories (kcal)
            <input type="number" min="0" step="any" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
          </label>
          <label>
            Protein (g)
            <input type="number" min="0" step="any" value={protein} onChange={(e) => setProtein(e.target.value)} required />
          </label>
          <label>
            Carbs (g)
            <input type="number" min="0" step="any" value={carbs} onChange={(e) => setCarbs(e.target.value)} required />
          </label>
          <label>
            Fat (g)
            <input type="number" min="0" step="any" value={fat} onChange={(e) => setFat(e.target.value)} required />
          </label>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={logNow} onChange={(e) => setLogNow(e.target.checked)} />
          Also log it now
        </label>

        {logNow && (
          <>
            <label>
              Meal
              <div className="chip-row">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`chip${m === meal ? " active" : ""}`}
                    onClick={() => setMeal(m)}
                  >
                    {MEAL_LABELS[m]}
                  </button>
                ))}
              </div>
            </label>
            <label>
              Amount to log (g)
              <input
                type="number"
                min="1"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder={`default: ${servingSize || 100} g`}
              />
            </label>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)} disabled={busy}>
            ← Back
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : logNow ? "Save & log" : "Save food"}
          </button>
        </div>
      </form>
    </div>
  );
}
