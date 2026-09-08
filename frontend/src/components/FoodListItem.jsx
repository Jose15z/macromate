export default function FoodListItem({ food, onSelect, onDelete }) {
  return (
    <div className="food-item" onClick={() => onSelect(food)}>
      {food.image_url ? (
        <img src={food.image_url} alt="" className="food-thumb" />
      ) : (
        <div className="food-thumb placeholder">🍽</div>
      )}
      <div className="food-item-main">
        <div className="food-item-name">
          {food.name}
          {food.brand && <span className="muted"> · {food.brand}</span>}
        </div>
        <div className="food-item-sub">
          {Math.round(food.kcal_100g)} kcal · P {food.protein_100g.toFixed(1)} · C{" "}
          {food.carbs_100g.toFixed(1)} · F {food.fat_100g.toFixed(1)} (per 100 g)
        </div>
      </div>
      {onDelete && (
        <button
          className="icon-btn danger"
          title="Remove from library"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(food);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
