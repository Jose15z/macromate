import { useEffect, useRef, useState } from "react";

export default function Home({ onSelect }) {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const b = barcode.trim();
    if (!b) return;
    onSelect(b);
  }

  return (
    <div className="card">
      <div className="grid2">
        <div>
          <h2 className="hTitle">Search by barcode</h2>
          <p className="pMuted">
            Paste a barcode from a product label. We’ll fetch macros per 100g and
            calculate totals based on your serving size.
          </p>

          <div className="fieldRow">
            <input
              ref={inputRef}
              className="input"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g., 737628064502"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button className="btn btnPrimary" onClick={submit} disabled={!barcode.trim()}>
              Search
            </button>
          </div>

          <div className="kbdHint">Tip: press <b>Enter</b> to search.</div>

          <div className="divider" />
        </div>

        <div>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Quick samples</h3>
          <p className="pMuted" style={{ marginBottom: 12 }}>
            Try these common demo barcodes:
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            <button className="btn" onClick={() => setBarcode("737628064502")}>
              737628064502
              <div className="macroSub">Energy bar (often available)</div>
            </button>
            <button className="btn" onClick={() => setBarcode("3017620422003")}>
              3017620422003
              <div className="macroSub">Nutella (common in OpenFoodFacts)</div>
            </button>
            <button className="btn" onClick={() => setBarcode("5449000000996")}>
              5449000000996
              <div className="macroSub">Coca-Cola (varies by region)</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
