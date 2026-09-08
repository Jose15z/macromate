import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api";
import FoodListItem from "../components/FoodListItem";
import Loading from "../components/Loading";
import { MEAL_LABELS, MEAL_TYPES, logTarget } from "../utils";

const TABS = [
  { key: "recent", label: "Recent" },
  { key: "saved", label: "Saved" },
  { key: "frequent", label: "Frequent" },
  { key: "scanned", label: "Scanned" },
];

function QuantityDialog({ food, onConfirm, onCancel }) {
  const [grams, setGrams] = useState(food.serving_size_g || 100);
  const [busy, setBusy] = useState(false);
  const scale = (Number(grams) || 0) / 100;

  async function confirm() {
    if (!Number(grams) || Number(grams) <= 0) return;
    setBusy(true);
    try {
      await onConfirm(food, Number(grams));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog card" onClick={(e) => e.stopPropagation()}>
        <h3>{food.name}</h3>
        {food.brand && <p className="muted small">{food.brand}</p>}
        <label>
          Amount (g)
          <input
            type="number"
            min="1"
            value={grams}
            autoFocus
            onChange={(e) => setGrams(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
          />
        </label>
        {food.serving_size_g && (
          <div className="chip-row">
            {[0.5, 1, 2].map((mult) => (
              <button
                key={mult}
                className="chip"
                onClick={() => setGrams(Math.round(food.serving_size_g * mult))}
              >
                {mult} serving{mult !== 1 ? "s" : ""} ({Math.round(food.serving_size_g * mult)} g)
              </button>
            ))}
          </div>
        )}
        <div className="macro-preview">
          <span>{Math.round(food.kcal_100g * scale)} kcal</span>
          <span>P {(food.protein_100g * scale).toFixed(1)} g</span>
          <span>C {(food.carbs_100g * scale).toFixed(1)} g</span>
          <span>F {(food.fat_100g * scale).toFixed(1)} g</span>
        </div>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirm} disabled={busy}>
            {busy ? "Adding…" : "Add to diary"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AddFood() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { date, meal } = logTarget(searchParams);

  const [tab, setTab] = useState("recent");
  const [search, setSearch] = useState("");
  const [foods, setFoods] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    setFoods(null);
    setError("");
    const t = setTimeout(() => {
      api
        .listFoods(tab, search.trim())
        .then((data) => alive && setFoods(data.foods))
        .catch((err) => alive && setError(err.message || "Could not load foods"));
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [tab, search]);

  function setMeal(newMeal) {
    setSearchParams({ date, meal: newMeal });
  }

  async function handleConfirm(food, grams) {
    await api.addEntry({ date, meal_type: meal, grams, food_id: food.id });
    navigate(`/?date=${date}`);
  }

  async function handleDeleteFood(food) {
    if (!window.confirm(`Remove "${food.name}" from your library?`)) return;
    await api.deleteFood(food.id);
    setFoods((prev) => prev.filter((f) => f.id !== food.id));
  }

  const query = `date=${date}&meal=${meal}`;

  return (
    <div className="add-food">
      <h2>Add food</h2>

      <div className="meal-select chip-row">
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            className={`chip${m === meal ? " active" : ""}`}
            onClick={() => setMeal(m)}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="quick-actions">
        <button className="btn" onClick={() => navigate(`/scan?${query}`)}>
          📷 Scan barcode
        </button>
        <button className="btn" onClick={() => navigate(`/photo?${query}`)}>
          🍛 Photo of meal
        </button>
        <button className="btn" onClick={() => navigate(`/manual?${query}`)}>
          ✏️ Manual entry
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Search your foods…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error card">{error}</div>}
      {!foods && !error && <Loading label="Loading foods…" />}
      {foods && foods.length === 0 && (
        <div className="empty card">
          <p>Nothing here yet.</p>
          <p className="muted small">
            Foods you {tab === "scanned" ? "scan" : "log or save"} will show up
            here for quick re-use.
          </p>
        </div>
      )}
      {foods && foods.length > 0 && (
        <div className="food-list card">
          {foods.map((food) => (
            <FoodListItem
              key={food.id}
              food={food}
              onSelect={setSelected}
              onDelete={tab === "saved" ? handleDeleteFood : undefined}
            />
          ))}
        </div>
      )}

      {selected && (
        <QuantityDialog
          food={selected}
          onConfirm={handleConfirm}
          onCancel={() => setSelected(null)}
        />
      )}
    </div>
  );
}
