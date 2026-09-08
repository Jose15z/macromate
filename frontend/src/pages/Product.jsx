import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as api from "../api";
import Loading from "../components/Loading";
import MacroCard from "../components/Macrocard";
import { MEAL_LABELS, MEAL_TYPES, logTarget } from "../utils";

export default function Product() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { date, meal: initialMeal } = logTarget(searchParams);

  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState(initialMeal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setProduct(null);
    setError("");
    api
      .fetchProduct(barcode)
      .then((data) => {
        if (!alive) return;
        setProduct(data);
        if (data.serving_size_g) setGrams(Math.round(data.serving_size_g));
      })
      .catch((err) => alive && setError(err.message || "Product not found"));
    return () => {
      alive = false;
    };
  }, [barcode]);

  if (error)
    return (
      <div className="empty card">
        <p>{error}</p>
        <p className="muted small">
          You can still add this food by hand if you know its nutrition values.
        </p>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={() => navigate(-1)}>← Back</button>
          <button
            className="btn primary"
            onClick={() => navigate(`/manual?date=${date}&meal=${meal}&barcode=${encodeURIComponent(barcode)}`)}
          >
            Enter manually
          </button>
        </div>
      </div>
    );

  if (!product) return <Loading label="Looking up product…" />;

  const scale = (Number(grams) || 0) / 100;

  async function handleAdd() {
    if (!Number(grams) || Number(grams) <= 0) return;
    setSaving(true);
    try {
      await api.addEntry({
        date,
        meal_type: meal,
        grams: Number(grams),
        food: {
          name: product.name,
          brand: product.brand,
          barcode: product.barcode,
          image_url: product.image,
          source: "off",
          kcal_100g: product.kcal_100g,
          protein_100g: product.protein_100g,
          carbs_100g: product.carbs_100g,
          fat_100g: product.fat_100g,
          serving_size_g: product.serving_size_g,
        },
      });
      navigate(`/?date=${date}`);
    } catch (err) {
      setError(err.message || "Failed to add entry");
      setSaving(false);
    }
  }

  return (
    <div className="product-page">
      <div className="product-head card">
        {product.image && <img src={product.image} alt="" className="product-img" />}
        <div>
          <h2>{product.name}</h2>
          {product.brand && <p className="muted">{product.brand}</p>}
          <p className="muted small">Barcode {product.barcode}</p>
        </div>
      </div>

      <div className="card form">
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
          Amount (g)
          <input
            type="number"
            min="1"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
          />
        </label>
        {product.serving_size_g && (
          <div className="chip-row">
            {[0.5, 1, 2].map((mult) => (
              <button
                key={mult}
                type="button"
                className="chip"
                onClick={() => setGrams(Math.round(product.serving_size_g * mult))}
              >
                {mult} serving{mult !== 1 ? "s" : ""} (
                {Math.round(product.serving_size_g * mult)} g)
              </button>
            ))}
          </div>
        )}

        <div className="macro-cards">
          <MacroCard label="Calories" value={Math.round(product.kcal_100g * scale)} unit="kcal" />
          <MacroCard label="Protein" value={(product.protein_100g * scale).toFixed(1)} unit="g" />
          <MacroCard label="Carbs" value={(product.carbs_100g * scale).toFixed(1)} unit="g" />
          <MacroCard label="Fat" value={(product.fat_100g * scale).toFixed(1)} unit="g" />
        </div>

        <div className="dialog-actions">
          <button className="btn ghost" onClick={() => navigate(-1)} disabled={saving}>
            ← Back
          </button>
          <button className="btn primary" onClick={handleAdd} disabled={saving}>
            {saving ? "Adding…" : `Add to ${MEAL_LABELS[meal]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
