import React, { useState, useEffect } from "react";
import "./index.css";
import {
  Home, LogIn, LogOut, User, BarChart2, ShieldAlert,
  Calendar, Menu, X, CheckSquare, Bell
} from "lucide-react";
import { apiFetch, parseJwt } from "./api";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import GuestDashboard from "./pages/GuestDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("home");
  const [checkingSession, setCheckingSession] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const triggerToast = (message, type = "success") => {
    if (!message) return;
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };
  const removeToast = (id) => { setToasts((prev) => prev.filter((t) => t.id !== id)); };
  useEffect(() => {
    async function initSession() {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const res = await apiFetch("/auth/me");
          if (res.ok) {
            const profile = await res.json();
            setUser(profile);
            if (profile.role === "guest") {
              setCurrentPage("guest");
            } else if (profile.role === "staff") {
              setCurrentPage("staff");
            } else if (profile.role === "manager" || profile.role === "owner") {
              setCurrentPage("analytics");
            }
          } else {
            handleLogout(false);
          }
        } catch (err) {
          console.error("Session init failed", err);
          handleLogout(false);
        }
      }
      setCheckingSession(false);
    }
    initSession();
  }, []);
  const handleLoginSuccess = (userData) => { setUser(userData); };
  const handleLogout = async (notify = true) => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (e) {
        console.error("Logout request failed", e);
      }
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setCurrentPage("home");
    if (notify) {
      triggerToast("Logged out successfully.", "info");
    }
  };
  const navigateTo = (page) => {
    setMobileMenuOpen(false);
    const protectedPages = ["guest", "staff", "analytics"];
    if (protectedPages.includes(page) && !user) {
      triggerToast("Authorization required. Please log in first.", "error");
      setCurrentPage("auth");
      return;
    }
    setCurrentPage(page);
  };
  if (checkingSession) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "var(--bg-main)",
        color: "var(--text-muted)"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid var(--border)",
          borderTopColor: "var(--primary)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          marginBottom: "1rem"
        }} />
        <p>Loading Kaveri Stays portal...</p>
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }
  return (
    <div className="app-container">
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
            <Bell size={18} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      <header className="glass-panel" style={{
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "1rem 1.5rem"
      }}>
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div
            onClick={() => navigateTo("home")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <span className="font-serif" style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#fff", letterSpacing: "1px" }}>
              Kaveri <span style={{ color: "var(--primary)" }}>Stays</span>
            </span>
          </div>
          <nav className="desktop-nav" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button
              onClick={() => navigateTo("home")}
              className="btn btn-secondary"
              style={{
                background: currentPage === "home" ? "rgba(255,255,255,0.06)" : "transparent",
                borderColor: currentPage === "home" ? "var(--primary)" : "transparent"
              }}>
              <Home size={16} /> Home
            </button>
            {user ? (
              <>
                {user.role === "guest" && (
                  <button
                    onClick={() => navigateTo("guest")}
                    className="btn btn-secondary"
                    style={{
                      background: currentPage === "guest" ? "rgba(255,255,255,0.06)" : "transparent",
                      borderColor: currentPage === "guest" ? "var(--primary)" : "transparent"
                    }}>
                    <Calendar size={16} /> My Bookings
                  </button>
                )}
                {(user.role === "staff" || user.role === "manager" || user.role === "owner") && (
                  <button
                    onClick={() => navigateTo("staff")}
                    className="btn btn-secondary"
                    style={{
                      background: currentPage === "staff" ? "rgba(255,255,255,0.06)" : "transparent",
                      borderColor: currentPage === "staff" ? "var(--primary)" : "transparent"
                    }}>
                    <CheckSquare size={16} /> Desk Ops
                  </button>
                )}
                {(user.role === "manager" || user.role === "owner") && (
                  <button
                    onClick={() => navigateTo("analytics")}
                    className="btn btn-secondary"
                    style={{
                      background: currentPage === "analytics" ? "rgba(255,255,255,0.06)" : "transparent",
                      borderColor: currentPage === "analytics" ? "var(--primary)" : "transparent"
                    }}>
                    <BarChart2 size={16} /> Analytics
                  </button>
                )}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginLeft: "1rem",
                  padding: "0.5rem 1rem",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                  borderRadius: "20px"
                }}>
                  <User size={14} style={{ color: "var(--primary)" }} />
                  <span style={{ fontSize: "0.85rem", color: "var(--text-main)", fontWeight: "500" }}>
                    {user.full_name}
                  </span>
                  <span style={{
                    fontSize: "0.7rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(217, 119, 6, 0.15)",
                    color: "var(--primary)",
                    textTransform: "uppercase",
                    fontWeight: "600"
                  }}>
                    {user.role}
                  </span>
                </div>
                <button onClick={() => handleLogout(true)} className="btn btn-secondary" style={{ marginLeft: "0.5rem" }} title="Logout">
                  <LogOut size={16} style={{ color: "var(--danger)" }} />
                </button>
              </>
            ) : (
              <button onClick={() => navigateTo("auth")} className="btn btn-primary" style={{ marginLeft: "1rem" }}>
                <LogIn size={16} /> Access Portal
              </button>
            )}
          </nav>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: "none", cursor: "pointer" }}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      {mobileMenuOpen && (
        <div className="glass-panel" style={{
          position: "fixed",
          top: "4.5rem",
          left: 0,
          right: 0,
          background: "var(--bg-surface)",
          zIndex: 99,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none"
        }}>
          <button onClick={() => navigateTo("home")} className="btn btn-secondary" style={{ width: "100%" }}>
            <Home size={16} /> Home
          </button>
          {user ? (
            <>
              {user.role === "guest" && (
                <button onClick={() => navigateTo("guest")} className="btn btn-secondary" style={{ width: "100%" }}>
                  <Calendar size={16} /> My Bookings
                </button>
              )}
              {(user.role === "staff" || user.role === "manager" || user.role === "owner") && (
                <button onClick={() => navigateTo("staff")} className="btn btn-secondary" style={{ width: "100%" }}>
                  <CheckSquare size={16} /> Desk Ops
                </button>
              )}
              {(user.role === "manager" || user.role === "owner") && (
                <button onClick={() => navigateTo("analytics")} className="btn btn-secondary" style={{ width: "100%" }}>
                  <BarChart2 size={16} /> Analytics
                </button>
              )}
              <div style={{ textAlign: "center", padding: "0.5rem 0", color: "var(--text-muted)", fontSize: "0.9rem", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                Logged in as <strong>{user.full_name}</strong> ({user.role})
              </div>
              <button onClick={() => handleLogout(true)} className="btn btn-danger" style={{ width: "100%" }}>
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <button onClick={() => navigateTo("auth")} className="btn btn-primary" style={{ width: "100%" }}>
              <LogIn size={16} /> Access Portal
            </button>
          )}
        </div>
      )}
      <main className="main-content">
        {currentPage === "home" && (
          <LandingPage
            user={user}
            triggerToast={triggerToast}
            onNavigate={navigateTo} />
        )}
        {currentPage === "auth" && (
          <AuthPage
            triggerToast={triggerToast}
            onLoginSuccess={handleLoginSuccess}
            onNavigate={navigateTo} />
        )}
        {currentPage === "guest" && (
          <GuestDashboard
            user={user}
            triggerToast={triggerToast} />
        )}
        {currentPage === "staff" && (
          <StaffDashboard
            user={user}
            triggerToast={triggerToast} />
        )}
        {currentPage === "analytics" && (
          <AnalyticsDashboard
            user={user}
            triggerToast={triggerToast}
          />
        )}
      </main>
      <footer style={{
        marginTop: "5rem",
        padding: "2rem 1.5rem",
        borderTop: "1px solid var(--border)",
        textAlign: "center",
        fontSize: "0.85rem",
        color: "var(--text-muted)",
        background: "rgba(17, 24, 39, 0.4)"
      }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <p>© {new Date().getFullYear()} Kaveri Stays & Resorts Ltd. All rights reserved.</p>
          <p style={{ marginTop: "0.25rem", opacity: 0.7 }}>Powered by FastAPI backend and React frontend</p>
        </div>
      </footer>
      <style dangerouslySetInnerHTML={{
        __html: `
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}} />
    </div>
  );
}