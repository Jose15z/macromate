import { useState } from "react";
import { useT } from "../i18n";
import Icon from "./Icon";

function EntryRow({ entry, onUpdateGrams, onDelete }) {
  const { t } = useT();
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
      {entry.image_url ? (
        <img src={entry.image_url} alt="" className="entry-thumb" />
      ) : (
        <div className="entry-thumb placeholder" aria-hidden="true">
          <Icon name="utensils" size={15} />
        </div>
      )}
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
                {t("meal.save")}
              </button>
              <button
                className="btn tiny ghost"
                onClick={() => {
                  setEditing(false);
                  setGrams(entry.grams);
                }}
                disabled={busy}
              >
                {t("common.cancel")}
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
            <button
              className="icon-btn"
              title={t("meal.editAmount")}
              onClick={() => setEditing(true)}
            >
              <Icon name="pencil" size={14} />
            </button>
            <button
              className="icon-btn danger"
              title={t("meal.remove")}
              onClick={() => onDelete(entry)}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MealSection({
  meal,
  onAdd,
  onUpdateGrams,
  onDelete,
  onCopyYesterday,
}) {
  const { t } = useT();
  const [copying, setCopying] = useState(false);

  async function copyYesterday() {
    setCopying(true);
    try {
      await onCopyYesterday(meal.meal_type);
    } finally {
      setCopying(false);
    }
  }

  return (
    <section className="meal card">
      <div className="meal-head">
        <h3>{t(`meals.${meal.meal_type}`)}</h3>
        <span className="meal-kcal">
          {meal.entries.length > 0 && `${Math.round(meal.totals.kcal)} kcal`}
        </span>
      </div>

      {meal.entries.length === 0 ? (
        <p className="muted small">{t("meal.noFoods")}</p>
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

      <div className="meal-actions">
        <button className="btn ghost add-food-btn" onClick={() => onAdd(meal.meal_type)}>
          <Icon name="plus" size={14} />
          {t("meal.addFood")}
        </button>
        {meal.entries.length === 0 && onCopyYesterday && (
          <button
            className="btn ghost add-food-btn"
            onClick={copyYesterday}
            disabled={copying}
          >
            <Icon name="copy" size={14} />
            {t("meal.copyYesterday")}
          </button>
        )}
      </div>
    </section>
  );
}
