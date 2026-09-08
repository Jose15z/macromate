import { Suspense, lazy } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Loading from "./components/Loading";
import AddFood from "./pages/AddFood";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import Login from "./pages/Login";
import ManualFood from "./pages/ManualFood";
import Photo from "./pages/Photo";
import Product from "./pages/Product";
import Register from "./pages/Register";

// the barcode-scanning library is heavy — load it only when scanning
const Scan = lazy(() => import("./pages/Scan"));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Loading your account…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Header() {
  const { user } = useAuth();
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        Macro<span>Mate</span>
      </Link>
      {user && (
        <nav className="header-nav">
          <Link to="/" title="Today">Diary</Link>
          <Link to="/goals" title="Profile & goals">Goals</Link>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/add" element={<RequireAuth><AddFood /></RequireAuth>} />
            <Route
              path="/scan"
              element={
                <RequireAuth>
                  <Suspense fallback={<Loading label="Opening scanner…" />}>
                    <Scan />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route path="/product/:barcode" element={<RequireAuth><Product /></RequireAuth>} />
            <Route path="/manual" element={<RequireAuth><ManualFood /></RequireAuth>} />
            <Route path="/photo" element={<RequireAuth><Photo /></RequireAuth>} />
            <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
