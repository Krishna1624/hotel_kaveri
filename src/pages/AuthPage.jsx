import React, { useState } from "react";
import "../index.css";
import { LogIn, UserPlus, Key, Mail, User, Phone } from "lucide-react";
import { apiFetch, parseJwt, resolveUrl } from "../api";
export default function AuthPage({ triggerToast, onLoginSuccess, onNavigate }) {
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      triggerToast("Please fill in all fields.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(resolveUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const tokens = await res.json();
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        const profileRes = await apiFetch("/auth/me");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          triggerToast(`Welcome back, ${profile.full_name}!`, "success");
          onLoginSuccess(profile);
          const pending = sessionStorage.getItem("pending_booking");
          if (pending) {
            triggerToast("You have a pending booking. Redirecting to complete it...", "info");
            onNavigate("home");
          } else {
            onNavigate("home");
          }
        } else {
          triggerToast("Failed to retrieve user profile.", "error");
        }
      } else {
        const errData = await res.json();
        triggerToast(errData.error?.message || "Invalid credentials.", "error");
      }
    } catch (err) {
      triggerToast("Error attempting login.", "error");
    } finally {
      setLoading(false);
    }
  };
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      triggerToast("Please fill in all required fields.", "error");
      return;
    }
    if (password.length < 10) {
      triggerToast("Password must be at least 10 characters.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(resolveUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          phone: phone || null,
        }),
      });
      if (res.ok) {
        triggerToast("Registration successful! Please login with your new credentials.", "success");
        setActiveTab("login");
        setPassword("");
      } else {
        const errData = await res.json();
        triggerToast(errData.error?.message || "Registration failed.", "error");
      }
    } catch (err) {
      triggerToast("Error during registration.", "error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ maxWidth: "450px", margin: "4rem auto", padding: "0 1rem" }}>
      <div className="glass-panel" style={{ padding: "2.5rem 2rem", overflow: "hidden" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 className="font-serif" style={{ fontSize: "2rem", color: "var(--primary)" }}>Kaveri Stays</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>Portal Access Control</p>
        </div>
        <div style={{
          display: "flex",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "4px",
          marginBottom: "2rem"
        }}>
          <button
            type="button"
            className="btn"
            onClick={() => { setActiveTab("login"); triggerToast(null); }}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "6px",
              background: activeTab === "login" ? "var(--primary)" : "transparent",
              color: activeTab === "login" ? "#fff" : "var(--text-muted)",
              boxShadow: activeTab === "login" ? "0 2px 8px rgba(217,119,6,0.3)" : "none"
            }}>
            Sign In
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => { setActiveTab("register"); triggerToast(null); }}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "6px",
              background: activeTab === "register" ? "var(--primary)" : "transparent",
              color: activeTab === "register" ? "#fff" : "var(--text-muted)",
              boxShadow: activeTab === "register" ? "0 2px 8px rgba(217,119,6,0.3)" : "none"
            }}>
            Register
          </button>
        </div>
        {activeTab === "login" && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">
                <Mail size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="guest@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Key size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }}>
              {loading ? "Authenticating..." : (
                <>
                  <LogIn size={18} />
                  Access Dashboard
                </>
              )}
            </button>
          </form>
        )}
        {activeTab === "register" && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">
                <User size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Full Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Mail size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Phone size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Key size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Password (Min 10 characters)
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }}>
              {loading ? "Creating Account..." : (
                <>
                  <UserPlus size={18} />
                  Register Guest
                </>
              )}
            </button>
          </form>
        )}
        <div style={{
          marginTop: "2rem",
          padding: "1rem",
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed var(--border)",
          borderRadius: "8px",
          fontSize: "0.8rem",
          color: "var(--text-muted)"
        }}>
          <strong>Staff/Manager Logins:</strong> Use credentials configured in `.env` and seeded via `seed_auth.py` (e.g. owner@example.com, manager@example.com, or reception@example.com). Self-registration is for Guests only.
        </div>
      </div>
    </div>
  );
}
