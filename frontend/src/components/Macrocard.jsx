export default function MacroCard({ label, value, unit = "" }) {
  return (
    <div className="macro-card">
      <div className="macro-card-value">
        {value}
        {unit && <span className="macro-card-unit">{unit}</span>}
      </div>
      <div className="macro-card-label">{label}</div>
    </div>
  );
}
