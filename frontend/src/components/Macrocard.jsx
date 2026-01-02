import { useState } from "react";

export default function Home({ onSelect }) {
  const [barcode, setBarcode] = useState("");

  return (
    <div>
      <h3>Search by barcode</h3>
      <p>Type a barcode (e.g., from a product label) and fetch macros.</p>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Barcode..."
          style={{ flex: 1, padding: 10 }}
        />
        <button disabled={!barcode.trim()} onClick={() => onSelect(barcode.trim())}>
          Search
        </button>
      </div>
    </div>
  );
}
