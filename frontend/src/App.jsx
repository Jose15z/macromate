import { useState } from "react";
import Home from "./pages/Home";
import Product from "./pages/Product";
import Today from "./pages/Today";

export default function App() {
  const [route, setRoute] = useState({ page: "home", barcode: null });

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand" onClick={() => setRoute({ page: "home", barcode: null })}>
          <div className="logoDot" />
          <div>
            <h1>MacroMate</h1>
            <small>Barcode → macros → daily tracking</small>
          </div>
        </div>

        <div className="nav">
          <button className="btn btnGhost" onClick={() => setRoute({ page: "home", barcode: null })}>
            Search
          </button>
          <button className="btn btnPrimary" onClick={() => setRoute({ page: "today", barcode: null })}>
            Today
          </button>
        </div>
      </div>

      {route.page === "home" && (
        <Home onSelect={(barcode) => setRoute({ page: "product", barcode })} />
      )}

      {route.page === "product" && (
        <Product
          barcode={route.barcode}
          onDone={() => setRoute({ page: "today", barcode: null })}
          onBack={() => setRoute({ page: "home", barcode: null })}
        />
      )}

      {route.page === "today" && <Today onBack={() => setRoute({ page: "home", barcode: null })} />}
      <footer
        style={{
          marginTop: 16,
          padding: "14px 12px",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.65)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>
          Built by <b style={{ color: "rgba(255,255,255,0.92)" }}>Jose Manuel Rodriguez Ospina</b>
        </span>

        <span style={{ display: "flex", gap: 10 }}>
          <a
            href="https://github.com/Jose15z"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", color: "rgba(255,255,255,0.75)" }}
          >
            GitHub
          </a>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>•</span>
          <a
            href="https://www.linkedin.com/in/jose-manuel-rodriguez-ospina-918b8a356/"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", color: "rgba(255,255,255,0.75)" }}
          >
            LinkedIn
          </a>
        </span>
      </footer>

    </div>

  );
}
