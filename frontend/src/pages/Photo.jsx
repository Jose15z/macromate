import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import Loading from "../components/Loading";
import { MEAL_LABELS, MEAL_TYPES, logTarget } from "../utils";

function itemMacros(item) {
  const scale = (Number(item.estimated_grams) || 0) / 100;
  return {
    kcal: (Number(item.kcal_100g) || 0) * scale,
    protein: (Number(item.protein_100g) || 0) * scale,
    carbs: (Number(item.carbs_100g) || 0) * scale,
    fat: (Number(item.fat_100g) || 0) * scale,
  };
}

export default function Photo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { date, meal: initialMeal } = logTarget(searchParams);

  const fileInputRef = useRef(null);
  const [meal, setMeal] = useState(initialMeal);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setItems([]);
    setError("");
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError("");
    try {
      const data = await api.recognizePhoto(file);
      setResult(data);
      setItems(
        (data.foods || []).map((f, i) => ({ ...f, _key: i, included: true }))
      );
    } catch (err) {
      setError(err.message || "Could not analyze the photo");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(key, field, value) {
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, [field]: value } : it))
    );
  }

  const included = items.filter((it) => it.included);
  const totals = included.reduce(
    (acc, it) => {
      const m = itemMacros(it);
      return {
        kcal: acc.kcal + m.kcal,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function confirm() {
    if (included.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (const item of included) {
        await api.addEntry({
          date,
          meal_type: meal,
          grams: Number(item.estimated_grams) || 100,
          food: {
            name: item.name || "Detected food",
            source: "ai",
            kcal_100g: Number(item.kcal_100g) || 0,
            protein_100g: Number(item.protein_100g) || 0,
            carbs_100g: Number(item.carbs_100g) || 0,
            fat_100g: Number(item.fat_100g) || 0,
          },
        });
      }
      navigate(`/?date=${date}`);
    } catch (err) {
      setError(err.message || "Could not save the entries");
      setSaving(false);
    }
  }

  return (
    <div className="photo-page">
      <h2>Photo of your meal</h2>
      <p className="muted small">
        Take a picture and let AI estimate what's on the plate. You review and
        adjust everything before it is saved.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        hidden
        onChange={pickFile}
      />

      {!previewUrl && (
        <button className="btn primary big" onClick={() => fileInputRef.current.click()}>
          📸 Take / choose photo
        </button>
      )}

      {previewUrl && (
        <div className="photo-preview card">
          <img src={previewUrl} alt="Selected meal" />
          <div className="dialog-actions">
            <button className="btn ghost" onClick={() => fileInputRef.current.click()} disabled={analyzing}>
              Change photo
            </button>
            {!result && (
              <button className="btn primary" onClick={analyze} disabled={analyzing}>
                {analyzing ? "Analyzing…" : "Analyze photo"}
              </button>
            )}
          </div>
        </div>
      )}

      {analyzing && <Loading label="Identifying foods in your photo…" />}
      {error && <div className="error card">{error}</div>}

      {result && !result.available && (
        <div className="empty card">
          <p>{result.message}</p>
          <button
            className="btn primary"
            onClick={() => navigate(`/manual?date=${date}&meal=${meal}`)}
          >
            Enter food manually
          </button>
        </div>
      )}

      {result && result.available && items.length === 0 && (
        <div className="empty card">
          <p>{result.message || "No foods were detected in this photo."}</p>
          <button
            className="btn primary"
            onClick={() => navigate(`/manual?date=${date}&meal=${meal}`)}
          >
            Enter food manually
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="card form">
          <h3>Detected foods</h3>
          <p className="muted small">
            Adjust names, portions and nutrition before saving. Uncheck anything
            that's wrong.
          </p>

          {items.map((item) => {
            const m = itemMacros(item);
            return (
              <div key={item._key} className={`detected-item${item.included ? "" : " excluded"}`}>
                <div className="detected-head">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={(e) => updateItem(item._key, "included", e.target.checked)}
                    />
                  </label>
                  <input
                    className="detected-name"
                    value={item.name}
                    onChange={(e) => updateItem(item._key, "name", e.target.value)}
                  />
                  <span className="muted small">
                    {Math.round(item.confidence * 100)}%
                  </span>
                </div>
                <div className="detected-fields">
                  <label>
                    Portion (g)
                    <input
                      type="number" min="1"
                      value={item.estimated_grams}
                      onChange={(e) => updateItem(item._key, "estimated_grams", e.target.value)}
                    />
                  </label>
                  <label>
                    kcal/100g
                    <input
                      type="number" min="0" step="any"
                      value={item.kcal_100g}
                      onChange={(e) => updateItem(item._key, "kcal_100g", e.target.value)}
                    />
                  </label>
                  <label>
                    P/100g
                    <input
                      type="number" min="0" step="any"
                      value={item.protein_100g}
                      onChange={(e) => updateItem(item._key, "protein_100g", e.target.value)}
                    />
                  </label>
                  <label>
                    C/100g
                    <input
                      type="number" min="0" step="any"
                      value={item.carbs_100g}
                      onChange={(e) => updateItem(item._key, "carbs_100g", e.target.value)}
                    />
                  </label>
                  <label>
                    F/100g
                    <input
                      type="number" min="0" step="any"
                      value={item.fat_100g}
                      onChange={(e) => updateItem(item._key, "fat_100g", e.target.value)}
                    />
                  </label>
                </div>
                <div className="muted small">
                  → {Math.round(m.kcal)} kcal · P {m.protein.toFixed(1)} · C{" "}
                  {m.carbs.toFixed(1)} · F {m.fat.toFixed(1)}
                </div>
              </div>
            );
          })}

          <label>
            Add to meal
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

          <div className="macro-preview">
            <span>{Math.round(totals.kcal)} kcal</span>
            <span>P {totals.protein.toFixed(1)} g</span>
            <span>C {totals.carbs.toFixed(1)} g</span>
            <span>F {totals.fat.toFixed(1)} g</span>
          </div>

          <div className="dialog-actions">
            <button className="btn ghost" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </button>
            <button className="btn primary" onClick={confirm} disabled={saving || included.length === 0}>
              {saving ? "Saving…" : `Add ${included.length} item${included.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
