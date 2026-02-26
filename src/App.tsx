import { Link, Route, Routes } from "react-router-dom";
import Notes from "./pages/Notes";
import NotePage from "./pages/Note";
import MapPage from "./pages/Map";

export default function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Murphy Notes (MVP)</h2>
        <nav style={{ display: "flex", gap: 10 }}>
          <Link to="/">Notes</Link>
          <Link to="/map">Map</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Notes />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </div>
  );
}
