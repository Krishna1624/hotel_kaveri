import React, { useState, useEffect } from "react";
import "../index.css";
import {
  TrendingUp, Calendar, RefreshCw, BarChart3, LineChart as LineIcon,
  Percent, DollarSign, Briefcase, ChevronRight, Award
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import { apiFetch, DEFAULT_PROPERTIES } from "../api";
export default function AnalyticsDashboard({ user, triggerToast }) {
  const [properties, setProperties] = useState(DEFAULT_PROPERTIES);
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [from_, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [occupancyData, setOccupancyData] = useState([]);
  const [adrData, setAdrData] = useState([]);
  const [revparData, setRevparData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    setFrom(sixMonthsAgo.toISOString().split("T")[0]);
    setTo(today.toISOString().split("T")[0]);
  }, []);
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await apiFetch("/properties");
        if (res.ok) {
          const data = await res.json();
          if (data.items?.length > 0) {
            setProperties(data.items);
          }
        }
      } catch (err) {
        console.warn("Could not fetch properties list, using default list", err);
      }
    }
    loadProperties();
  }, []);
  const loadReportData = async () => {
    if (!from_ || !to) return;
    if (new Date(to) <= new Date(from_)) {
      triggerToast("Ending date must be after starting date.", "error");
      return;
    }
    setLoading(true);
    try {
      const propParam = selectedProperty !== "all" ? `&property_id=${selectedProperty}` : "";
      const occRes = await apiFetch(`/reports/occupancy?from=${from_}&to=${to}${propParam}`);
      const occ = occRes.ok ? await occRes.json() : [];
      setOccupancyData(occ);
      const adrRes = await apiFetch(`/reports/adr?from=${from_}&to=${to}${propParam}`);
      const adrVal = adrRes.ok ? await adrRes.json() : [];
      setAdrData(adrVal);
      const revparRes = await apiFetch(`/reports/revpar?from=${from_}&to=${to}${propParam}`);
      const revparVal = revparRes.ok ? await revparRes.json() : [];
      setRevparData(revparVal);
      if (user?.role === "owner") {
        const revRes = await apiFetch(`/reports/revenue?from=${from_}&to=${to}`);
        const revVal = revRes.ok ? await revRes.json() : [];
        setRevenueData(revVal);
      }
    } catch (err) {
      triggerToast("Cannot reach backend server. Please verify FastAPI is running on port 8000.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadReportData();
  }, [from_, to, selectedProperty]);
  const pivotData = (rows, valueKey, isNumeric = true) => {
    const months = {};
    rows.forEach(r => {
      const m = r.month;
      const propName = r.property_name || `Property ${r.property_id}`;
      if (selectedProperty !== "all" && r.property_id.toString() !== selectedProperty.toString()) {
        return;
      }
      if (!months[m]) {
        months[m] = { name: m };
      }
      months[m][propName] = isNumeric ? parseFloat(r[valueKey]) : r[valueKey];
    });
    return Object.values(months).sort((a, b) => a.name.localeCompare(b.name));
  };
  const pivotedOccupancy = pivotData(occupancyData, "occupancy_pct");
  const pivotedRevenue = user?.role === "owner" ? pivotData(revenueData, "revenue") : [];
  const pivotedAdr = pivotData(adrData, "value");
  const pivotedRevpar = pivotData(revparData, "value");
  const totalNightsAvailable = occupancyData.reduce((sum, r) => sum + r.room_nights_available, 0);
  const totalNightsSold = occupancyData.reduce((sum, r) => sum + r.room_nights_sold, 0);
  const avgOccupancy = totalNightsAvailable > 0 ? (totalNightsSold * 100) / totalNightsAvailable : 0;
  const avgADR = adrData.length > 0
    ? adrData.reduce((sum, r) => sum + parseFloat(r.value), 0) / adrData.length
    : 0;
  const avgRevPAR = revparData.length > 0
    ? revparData.reduce((sum, r) => sum + parseFloat(r.value), 0) / revparData.length
    : 0;
  const totalRevenue = revenueData.reduce((sum, r) => sum + parseFloat(r.revenue), 0);
  const activeProperties = Array.from(new Set(occupancyData.map(r => r.property_name || `Property ${r.property_id}`)));
  const colors = ["#d97706", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
  return (
    <div className="analytics-dashboard">
      <div className="glass-panel" style={{ padding: "1.5rem 2rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <h2 className="font-serif" style={{ fontSize: "1.8rem" }}>Management Analytics Hub</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Real-time business performance analytics • Access Level: <strong>{user?.role}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {user?.role === "owner" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Scope</span>
              <select
                className="form-control form-select"
                style={{ width: "180px", padding: "6px 12px", fontSize: "0.85rem" }}
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}>
                <option value="all">All Properties</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>From</span>
            <input
              type="date"
              className="form-control"
              style={{ width: "140px", padding: "6px 12px", fontSize: "0.85rem" }}
              value={from_}
              onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>To</span>
            <input
              type="date"
              className="form-control"
              style={{ width: "140px", padding: "6px 12px", fontSize: "0.85rem" }}
              value={to}
              onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            onClick={loadReportData}
            className="btn btn-secondary"
            style={{ padding: "8px 12px", marginTop: "18px" }}
            title="Refresh Data">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      <div className="grid-4" style={{ marginBottom: "2rem" }}>
        <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "rgba(217, 119, 6, 0.1)", borderRadius: "10px", color: "var(--primary)" }}>
            <Percent size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Occupancy Rate</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "2px" }}>{avgOccupancy.toFixed(2)}%</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{totalNightsSold} / {totalNightsAvailable} Nights</div>
          </div>
        </div>
        {user?.role === "owner" ? (
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{ padding: "0.75rem", background: "rgba(16, 185, 129, 0.1)", borderRadius: "10px", color: "var(--success)" }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Revenue</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "2px" }}>₹{totalRevenue.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--success)" }}>From bookings stay</div>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{ padding: "0.75rem", background: "rgba(59, 130, 246, 0.1)", borderRadius: "10px", color: "var(--secondary)" }}>
              <Briefcase size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Nights Sold</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "2px" }}>{totalNightsSold} Nights</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Within selected range</div>
            </div>
          </div>
        )}
        <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "rgba(139, 92, 246, 0.1)", borderRadius: "10px", color: "#8b5cf6" }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Average Daily Rate</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "2px" }}>₹{avgADR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ADR in stay dates</div>
          </div>
        </div>
        <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "rgba(59, 130, 246, 0.1)", borderRadius: "10px", color: "#3b82f6" }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>RevPAR</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "2px" }}>₹{avgRevPAR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Per available room</div>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="glass-panel" style={{ padding: "8rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
          <RefreshCw size={36} className="animate-spin" style={{ animation: "spin 2s linear infinite", marginBottom: "1rem" }} />
          <h3>Compiling Analytics reports...</h3>
          <p style={{ marginTop: "0.5rem" }}>Processing database rates and cross-referencing overlap nights.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div className="glass-panel" style={{ padding: "2rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Percent size={20} color="var(--primary)" />
              Monthly Occupancy Trends (%)
            </h3>
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={pivotedOccupancy} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" unit="%" />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "#fff" }} />
                  <Legend />
                  {activeProperties.map((prop, idx) => (
                    <Bar key={prop} dataKey={prop} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {user?.role === "owner" && (
            <div className="glass-panel" style={{ padding: "2rem" }}>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BarChart3 size={20} color="var(--success)" />
                Monthly Revenue Performance (₹)
              </h3>
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={pivotedRevenue} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "#fff" }} formatter={(value) => `₹${value.toLocaleString()}`} />
                    <Legend />
                    {activeProperties.map((prop, idx) => (
                      <Bar key={prop} dataKey={prop} fill={colors[(idx + 1) % colors.length]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="grid-2">
            <div className="glass-panel" style={{ padding: "2.0rem" }}>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <LineIcon size={18} color="#8b5cf6" />
                Average Daily Rate (ADR)
              </h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={pivotedAdr} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px" }} formatter={(val) => `₹${val.toFixed(2)}`} />
                    <Legend />
                    {activeProperties.map((prop, idx) => (
                      <Line key={prop} type="monotone" dataKey={prop} stroke={colors[idx % colors.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: "2.0rem" }}>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <LineIcon size={18} color="#3b82f6" />
                Revenue Per Available Room (RevPAR)
              </h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={pivotedRevpar} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px" }} formatter={(val) => `₹${val.toFixed(2)}`} />
                    <Legend />
                    {activeProperties.map((prop, idx) => (
                      <Line key={prop} type="monotone" dataKey={prop} stroke={colors[idx % colors.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}