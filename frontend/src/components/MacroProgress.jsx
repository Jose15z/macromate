export default function MacroProgress({ label, consumed, goal, unit }) {
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  const over = goal > 0 && consumed > goal;
  return (
    <div className="macro-progress">
      <div className="macro-progress-head">
        <span className="macro-progress-label">{label}</span>
        <span className="macro-progress-values">
          {Math.round(consumed).toLocaleString()} /{" "}
          {Math.round(goal).toLocaleString()} {unit}
        </span>
      </div>
      <div className="bar">
        <div
          className={`bar-fill${over ? " over" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
