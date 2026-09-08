export default function MacroProgress({ label, consumed, goal, unit, color = "var(--accent)" }) {
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  const over = goal > 0 && consumed > goal;
  return (
    <div className="macro-progress">
      <div className="macro-progress-head">
        <span className="macro-progress-label">
          <span className="macro-dot" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="macro-progress-values">
          <strong>{Math.round(consumed).toLocaleString()}</strong> /{" "}
          {Math.round(goal).toLocaleString()} {unit}
        </span>
      </div>
      <div className="bar">
        <div
          className={`bar-fill${over ? " over" : ""}`}
          style={{ width: `${pct}%`, background: over ? undefined : color }}
        />
      </div>
    </div>
  );
}
