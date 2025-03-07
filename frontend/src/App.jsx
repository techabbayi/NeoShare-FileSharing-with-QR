import { BrowserRouter as Router, Route, Routes, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Send from "./pages/Send";
import Receive from "./pages/Receive";
import "./App.css";

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const location = useLocation();
  const showTitle = location.pathname !== "/";
  return (
    <div className="app-container">
      {showTitle && (
        <header className="title-bar">
          <h1>QRSend</h1>
        </header>
      )}

      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/send" element={<Send />} />
          <Route path="/receive/:code?" element={<Receive />} />
        </Routes>
      </div>

      <nav className="navbar">
        <Link to="/" className="nav-item">🏠 Home</Link>
        <Link to="/send" className="nav-item">📤 Send</Link>
        <Link to="/receive" className="nav-item">📥 Receive</Link>
      </nav>
    </div>
  );
}

export default App;
