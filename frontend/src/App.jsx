import { useState } from "react";
import Home from "./pages/Home";
import Product from "./pages/Product";
import Today from "./pages/Today";

export default function App() {
  const [route, setRoute] = useState({ page: "home", barcode: null });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, cursor: "pointer" }} onClick={() => setRoute({ page: "home" })}>
          MacroMate
        </h2>
        <button onClick={() => setRoute({ page: "today" })}>Today</button>
      </header>

      {route.page === "home" && <Home onSelect={(barcode) => setRoute({ page: "product", barcode })} />}
      {route.page === "product" && <Product barcode={route.barcode} onDone={() => setRoute({ page: "today" })} />}
      {route.page === "today" && <Today />}
    </div>
  );
}
