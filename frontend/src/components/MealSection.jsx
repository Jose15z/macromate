import { useState } from "react";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

function EntryRow({ entry, onUpdateGrams, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState(entry.grams);
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = Number(grams);
    if (!value || value <= 0 || value === entry.grams) {
      setEditing(false);
      setGrams(entry.grams);
      return;
    }
    setBusy(true);
    try {
      await onUpdateGrams(entry, value);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entry-row">
      <div className="entry-main">
        <div className="entry-name">{entry.name}</div>
        <div className="entry-sub">
          {editing ? (
            <span className="entry-edit">
              <input
                type="number"
                min="1"
                value={grams}
                autoFocus
                disabled={busy}
                onChange={(e) => setGrams(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              g{" "}
              <button className="btn tiny" onClick={save} disabled={busy}>
                Save
              </button>
              <button
                className="btn tiny ghost"
                onClick={() => {
                  setEditing(false);
                  setGrams(entry.grams);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </span>
          ) : (
            <>
              {entry.grams} g · P {entry.protein} · C {entry.carbs} · F {entry.fat}
            </>
          )}
        </div>
      </div>
      <div className="entry-side">
        <div className="entry-kcal">{Math.round(entry.kcal)} kcal</div>
        {!editing && (
          <div className="entry-actions">
            <button className="icon-btn" title="Edit amount" onClick={() => setEditing(true)}>
              ✎
            </button>
            <button className="icon-btn danger" title="Remove" onClick={() => onDelete(entry)}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MealSection({ meal, onAdd, onUpdateGrams, onDelete }) {
  return (
    <section className="meal card">
      <div className="meal-head">
        <h3>{MEAL_LABELS[meal.meal_type]}</h3>
        <span className="meal-kcal">
          {meal.entries.length > 0 && `${Math.round(meal.totals.kcal)} kcal`}
        </span>
      </div>

      {meal.entries.length === 0 ? (
        <p className="muted small">No foods logged yet.</p>
      ) : (
        meal.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onUpdateGrams={onUpdateGrams}
            onDelete={onDelete}
          />
        ))
      )}

      <button className="btn ghost add-food-btn" onClick={() => onAdd(meal.meal_type)}>
        + Add food
      </button>
    </section>
  );
}
