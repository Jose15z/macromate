import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import FoodListItem from "../components/FoodListItem";
import Icon from "../components/Icon";
import Loading from "../components/Loading";
import { useT } from "../i18n";

function RecipeBuilder({ onSaved, onCancel }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      api
        .listFoods("saved", search.trim())
        .then((data) => alive && setResults(data.foods))
        .catch(() => alive && setResults([]));
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);

  function addItem(food) {
    if (items.some((i) => i.food.id === food.id)) return;
    setItems((prev) => [
      ...prev,
      { food, grams: Math.round(food.serving_size_g || 100) },
    ]);
  }

  function setGrams(foodId, grams) {
    setItems((prev) =>
      prev.map((i) => (i.food.id === foodId ? { ...i, grams } : i))
    );
  }

  function removeItem(foodId) {
    setItems((prev) => prev.filter((i) => i.food.id !== foodId));
  }

  const totals = items.reduce(
    (acc, i) => {
      const s = (Number(i.grams) || 0) / 100;
      return {
        kcal: acc.kcal + i.food.kcal_100g * s,
        protein: acc.protein + i.food.protein_100g * s,
        carbs: acc.carbs + i.food.carbs_100g * s,
        fat: acc.fat + i.food.fat_100g * s,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function save() {
    setError("");
    const valid = items.filter((i) => Number(i.grams) > 0);
    if (!name.trim() || valid.length === 0) {
      setError(t("recipes.needItems"));
      return;
    }
    setBusy(true);
    try {
      await api.createRecipe(
        name.trim(),
        valid.map((i) => ({ food_id: i.food.id, grams: Number(i.grams) }))
      );
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card form">
      <label>
        {t("recipes.name")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("recipes.namePlaceholder")}
          maxLength={200}
        />
      </label>

      {items.length > 0 && (
        <div className="recipe-items">
          {items.map((i) => (
            <div key={i.food.id} className="recipe-item">
              <span className="recipe-item-name">{i.food.name}</span>
              <input
                type="number"
                min="1"
                value={i.grams}
                onChange={(e) => setGrams(i.food.id, e.target.value)}
              />
              <span className="muted small">g</span>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => removeItem(i.food.id)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <div className="macro-preview">
            <span>{Math.round(totals.kcal)} kcal</span>
            <span>P {totals.protein.toFixed(1)} g</span>
            <span>C {totals.carbs.toFixed(1)} g</span>
            <span>F {totals.fat.toFixed(1)} g</span>
          </div>
        </div>
      )}

      <label>
        {t("recipes.addIngredients")}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("add.search")}
        />
      </label>
      <div className="food-list">
        {results
          .filter((f) => !items.some((i) => i.food.id === f.id))
          .slice(0, 6)
          .map((food) => (
            <FoodListItem key={food.id} food={food} onSelect={addItem} />
          ))}
      </div>

      {error && <div className="error">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn primary" onClick={save} disabled={busy}>
          {busy ? t("common.saving") : t("recipes.save")}
        </button>
      </div>
    </div>
  );
}

export default function Recipes() {
  const { t } = useT();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState(null);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState(false);

  function load() {
    setError("");
    api
      .listRecipes()
      .then((data) => setRecipes(data.recipes))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleDelete(recipe) {
    if (!window.confirm(t("recipes.deleteConfirm", { name: recipe.name }))) return;
    await api.deleteRecipe(recipe.id);
    load();
  }

  return (
    <div className="recipes-page">
      <h2>{t("recipes.title")}</h2>
      <p className="muted small">{t("recipes.intro")}</p>

      {!building && (
        <button className="btn primary" onClick={() => setBuilding(true)}>
          <Icon name="plus" size={14} />
          {t("recipes.new")}
        </button>
      )}

      {building && (
        <RecipeBuilder
          onSaved={() => {
            setBuilding(false);
            load();
          }}
          onCancel={() => setBuilding(false)}
        />
      )}

      {error && <div className="error card">{error}</div>}
      {!recipes && !error && <Loading />}
      {recipes && recipes.length === 0 && !building && (
        <div className="empty card">
          <p>{t("recipes.empty")}</p>
        </div>
      )}
      {recipes && recipes.length > 0 && (
        <div className="food-list card">
          {recipes.map((r) => (
            <div key={r.id} className="food-item" style={{ cursor: "default" }}>
              <div className="food-item-main">
                <div className="food-item-name">{r.name}</div>
                <div className="food-item-sub num">
                  {t("recipes.items", { n: r.items.length })} ·{" "}
                  {Math.round(r.totals.kcal)} kcal · P {r.totals.protein} · C{" "}
                  {r.totals.carbs} · F {r.totals.fat} {t("recipes.perRecipe")}
                </div>
              </div>
              <button className="icon-btn danger" onClick={() => handleDelete(r)}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn ghost" onClick={() => navigate(-1)}>
        {t("common.back")}
      </button>
    </div>
  );
}
