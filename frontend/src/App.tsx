import { Link, Route, Routes, useLocation } from "react-router-dom";
import TemplatesPage from "./pages/TemplatesPage";
import RulesPage from "./pages/RulesPage";

const App = () => {
    const location = useLocation();

    return (
        <div className="app-container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <header style={{ backgroundColor: "#151b26", color: "#fff", padding: "12px 32px" }}>
                <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: "18px" }}>AppTrust BOYR Manager</span>
                    <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
                        <Link
                            to="/templates"
                            style={{
                                color: location.pathname.startsWith("/templates") ? "#38bdf8" : "#d0d7de"
                            }}
                        >
                            Templates
                        </Link>
                        <Link
                            to="/rules"
                            style={{
                                color: location.pathname.startsWith("/rules") ? "#38bdf8" : "#d0d7de"
                            }}
                        >
                            Rules
                        </Link>
                    </div>
                </nav>
            </header>
            <main style={{ flex: 1, padding: "24px 32px" }}>
                <Routes>
                    <Route path="/templates" element={<TemplatesPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="*" element={<TemplatesPage />} />
                </Routes>
            </main>
        </div>
    );
};

export default App;
