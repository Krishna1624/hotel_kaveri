import React, { useState, useEffect } from "react";
import "../index.css";
import {
  Users, Calendar, CheckSquare, Search, ChevronRight,
  MapPin, Clock, Plus, HelpCircle, DollarSign, Filter
} from "lucide-react";
import { apiFetch } from "../api";
export default function StaffDashboard({ user, triggerToast }) {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchGuestEmail, setSearchGuestEmail] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingPayments, setBookingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [deskPayAmount, setDeskPayAmount] = useState("");
  const [deskPayMethod, setDeskPayMethod] = useState("cash");
  const [deskPayRef, setDeskPayRef] = useState("");
  const [submittingDeskPay, setSubmittingDeskPay] = useState(false);
  const [guestLookupEmail, setGuestLookupEmail] = useState("");
  const [guestLookupResult, setGuestLookupResult] = useState(null);
  const [loadingGuest, setLoadingGuest] = useState(false);
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await apiFetch("/properties");
        if (res.ok) {
          const data = await res.json();
          setProperties(data.items || []);
          if (user?.role === "owner") {
            if (data.items?.length > 0) {
              setSelectedProperty(data.items[0].id.toString());
            }
          } else {
            setSelectedProperty(user?.property_id?.toString() || "");
          }
        }
      } catch (err) {
        triggerToast("Failed to fetch properties list.", "error");
      }
    } loadProperties();
  }, [user]);
  const loadBookings = async () => {
    if (!selectedProperty) return;
    setLoading(true);
    try {
      let url = `/bookings?property_id=${selectedProperty}&limit=100`;
      if (searchStatus !== "all") {
        url += `&status=${searchStatus}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.items || []);
      } else {
        triggerToast("Failed to load property bookings.", "error");
      }
    } catch (err) {
      triggerToast("Error connecting to bookings service.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadBookings();
  }, [selectedProperty, searchStatus]);
  const loadBookingPayments = async (bookingId) => {
    setLoadingPayments(true);
    try {
      const res = await apiFetch(`/bookings/${bookingId}/payments`);
      if (res.ok) {
        const data = await res.json();
        setBookingPayments(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayments(false);
    }
  };
  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    loadBookingPayments(booking.id);
    setDeskPayAmount("");
    setDeskPayRef("");
  };
  const handleTransition = async (action) => {
    if (!selectedBooking) return;
    if (!window.confirm(`Are you sure you want to transition booking #${selectedBooking.id} to ${action}?`)) return;
    try {
      const res = await apiFetch(`/bookings/${selectedBooking.id}/${action}`, {
        method: "POST"
      });
      if (res.ok) {
        const updated = await res.json();
        triggerToast(`Booking status updated to ${updated.status}`, "success");
        setSelectedBooking(updated);
        loadBookings();
      } else {
        const errData = await res.json();
        triggerToast(errData.error?.message || "Action failed.", "error");
      }
    } catch (err) {
      triggerToast("Error processing booking transition.", "error");
    }
  };
  const submitDeskPayment = async (e) => {
    e.preventDefault();
    if (!deskPayAmount || parseFloat(deskPayAmount) <= 0) {
      triggerToast("Please enter a positive transaction amount.", "error");
      return;
    }
    const maxInstallment = parseFloat(selectedBooking.balance);
    if (parseFloat(deskPayAmount) > maxInstallment) {
      triggerToast(`Payment exceeds outstanding balance of ₹${maxInstallment.toLocaleString("en-IN")}`, "error");
      return;
    }
    setSubmittingDeskPay(true);
    try {
      const idempotencyKey = `deskpay-${selectedBooking.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const res = await apiFetch(`/bookings/${selectedBooking.id}/payments`, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          amount: parseFloat(deskPayAmount),
          method: deskPayMethod,
          reference: deskPayRef || "Desk payment"
        })
      });
      if (res.ok) {
        triggerToast("Payment registered successfully!", "success");
        setDeskPayAmount("");
        setDeskPayRef("");
        loadBookingPayments(selectedBooking.id);
        const bRes = await apiFetch(`/bookings/${selectedBooking.id}`);
        if (bRes.ok) {
          const fresh = await bRes.json();
          setSelectedBooking(fresh);
        }
        loadBookings();
      } else {
        const errData = await res.json();
        triggerToast(errData.error?.message || "Payment registration failed.", "error");
      }
    } catch (err) {
      triggerToast("Error registering payment.", "error");
    } finally {
      setSubmittingDeskPay(false);
    }
  };
  const handleGuestLookup = async (e) => {
    e.preventDefault();
    if (!guestLookupEmail) return;
    setLoadingGuest(true);
    setGuestLookupResult(null);
    try {
      const res = await apiFetch(`/guests?email=${encodeURIComponent(guestLookupEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length > 0) {
          setGuestLookupResult(data.items[0]);
        } else {
          triggerToast("No guest profile found matching that email.", "info");
        }
      } else {
        triggerToast("Error fetching guest details.", "error");
      }
    } catch (err) {
      triggerToast("Error searching guest database.", "error");
    } finally {
      setLoadingGuest(false);
    }
  };
  const getPropertyName = (id) => {
    const prop = properties.find(p => p.id.toString() === id?.toString());
    return prop ? prop.name : "Kaveri Stays Resort";
  };
  return (
    <div className="staff-dashboard">
      <div className="glass-panel" style={{ padding: "1.5rem 2rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 className="font-serif" style={{ fontSize: "1.8rem" }}>Operations Control Center</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Logged in: <strong>{user?.email}</strong> ({user?.role}) at <strong>{getPropertyName(selectedProperty)}</strong>
          </p>
        </div>
        {user?.role === "owner" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Scope:</span>
            <select
              className="form-control form-select"
              style={{ width: "220px", background: "rgba(255,255,255,0.05)" }}
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: "1.2fr 1.8fr", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Users size={18} />
              Guest Database Search
            </h3>
            <form onSubmit={handleGuestLookup} style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="email"
                className="form-control"
                placeholder="search-guest@email.com"
                value={guestLookupEmail}
                onChange={(e) => setGuestLookupEmail(e.target.value)}
                required />
              <button type="submit" disabled={loadingGuest} className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>
                <Search size={16} />
              </button>
            </form>
            {guestLookupResult && (
              <div className="glass-card" style={{ marginTop: "1rem", background: "rgba(255,255,255,0.01)", padding: "1rem" }}>
                <div style={{ fontWeight: "600", fontSize: "1rem", color: "var(--primary)" }}>{guestLookupResult.full_name}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}><strong>Email:</strong> {guestLookupResult.email}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}><strong>Phone:</strong> {guestLookupResult.phone || "—"}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}><strong>Loyalty stays count:</strong> {guestLookupResult.stay_count} stay(s)</div>
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%", marginTop: "0.75rem", padding: "4px 8px", fontSize: "0.8rem" }}
                  onClick={() => setGuestLookupResult(null)}
                >
                  Clear Results
                </button>
              </div>
            )}
          </div>
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem" }}>Operations List</h3>
              <select
                className="form-control form-select"
                style={{ width: "130px", padding: "4px 8px", fontSize: "0.8rem" }}
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value)}>
                <option value="all">All States</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)" }}>Fetching bookings...</div>
            ) : bookings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No active bookings matching criteria.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "50vh", overflowY: "auto" }}>
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleBookingClick(b)}
                    className="glass-card"
                    style={{
                      padding: "1rem",
                      cursor: "pointer",
                      borderLeft: selectedBooking?.id === b.id ? "3px solid var(--primary)" : "1px solid var(--border)",
                      background: selectedBooking?.id === b.id ? "rgba(217, 119, 6, 0.04)" : "rgba(31, 41, 55, 0.2)"
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>B-{b.id} • Room {b.room_number}</span>
                      <span className={`badge badge-${b.status}`} style={{ fontSize: "0.65rem" }}>{b.status}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginTop: "4px" }}>
                      Guest: <strong>{b.guest_name}</strong>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {b.check_in} to {b.check_out} ({b.nights} night{b.nights > 1 ? "s" : ""})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          {selectedBooking ? (
            <div className="glass-panel" style={{ padding: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <span className={`badge badge-${selectedBooking.status}`} style={{ marginBottom: "0.5rem" }}>{selectedBooking.status}</span>
                  <h3 className="font-serif" style={{ fontSize: "1.5rem" }}>Operational Action Card</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Reservation Code: B-{selectedBooking.id}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setSelectedBooking(null)}>Deselect</button>
              </div>
              <div className="grid-2" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>GUEST INFORMATION</div>
                  <div style={{ fontWeight: "600", fontSize: "1.1rem", marginTop: "4px" }}>{selectedBooking.guest_name}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Guest ID: #{selectedBooking.guest_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ROOM ASSIGNMENT</div>
                  <div style={{ fontWeight: "600", fontSize: "1.1rem", marginTop: "4px" }}>Room {selectedBooking.room_number}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{selectedBooking.nights} Night stay • {selectedBooking.guests} Guest(s)</div>
                </div>
              </div>
              <div style={{ marginBottom: "2rem" }}>
                <h4 style={{ fontSize: "1.05rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
                  <Clock size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                  Workflow Desk Actions
                </h4>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {selectedBooking.status === "confirmed" && (
                    <>
                      <button
                        onClick={() => handleTransition("check-in")}
                        className="btn btn-primary"
                        style={{ flex: 1, minWidth: "140px" }}>
                        Check-In Guest
                      </button>
                      <button
                        onClick={() => handleTransition("no-show")}
                        className="btn btn-secondary"
                        style={{ flex: 1, minWidth: "140px" }}>
                        Mark No-Show
                      </button>
                    </>
                  )}
                  {selectedBooking.status === "checked_in" && (
                    <button
                      onClick={() => handleTransition("check-out")}
                      className="btn btn-primary"
                      style={{ flex: 1, background: "var(--success)", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
                      Process Check-Out
                    </button>
                  )}
                  {(selectedBooking.status === "confirmed" || selectedBooking.status === "checked_in") && (
                    <button
                      onClick={() => handleTransition("cancel")}
                      className="btn btn-danger"
                      style={{ flex: 1, minWidth: "140px" }}>
                      Force Cancel
                    </button>
                  )}
                  {(selectedBooking.status === "checked_out" || selectedBooking.status === "cancelled" || selectedBooking.status === "no_show") && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
                      This reservation is in a terminal state ({selectedBooking.status}) and cannot undergo further desk state transitions.
                    </div>
                  )}
                </div>
              </div>
              {parseFloat(selectedBooking.balance) > 0 && (
                <div style={{ background: "rgba(217, 119, 6, 0.02)", border: "1px solid rgba(217, 119, 6, 0.15)", padding: "1.25rem", borderRadius: "10px", marginBottom: "2rem" }}>
                  <h4 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Plus size={16} /> Register Desk Payment
                  </h4>
                  <form onSubmit={submitDeskPayment} className="grid-3" style={{ gridTemplateColumns: "1.2fr 1.2fr 1fr", alignItems: "end" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="Amount"
                        value={deskPayAmount}
                        onChange={(e) => setDeskPayAmount(e.target.value)}
                        max={selectedBooking.balance}
                        min="1"
                        required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Method</label>
                      <select
                        className="form-control form-select"
                        value={deskPayMethod}
                        onChange={(e) => setDeskPayMethod(e.target.value)}>
                        <option value="cash">Cash Received</option>
                        <option value="card">Terminal Card</option>
                        <option value="upi">UPI/QR Scan</option>
                      </select>
                    </div>
                    <button type="submit" disabled={submittingDeskPay} className="btn btn-primary" style={{ width: "100%" }}>
                      {submittingDeskPay ? "Saving..." : "Add"}
                    </button>
                    <div className="form-group" style={{ gridColumn: "1 / -1", marginTop: "0.75rem", marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Receipt Reference / Note</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Receipt ID or reference number"
                        value={deskPayRef}
                        onChange={(e) => setDeskPayRef(e.target.value)} />
                    </div>
                  </form>
                </div>
              )}
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "6px" }}>
                  <span>Total Amount: <strong>₹{parseFloat(selectedBooking.total_amount).toLocaleString("en-IN")}</strong></span>
                  <span>Paid: <strong style={{ color: "var(--success)" }}>₹{parseFloat(selectedBooking.total_paid).toLocaleString("en-IN")}</strong></span>
                  <span>Outstanding: <strong style={{ color: parseFloat(selectedBooking.balance) > 0 ? "var(--warning)" : "var(--success)" }}>₹{parseFloat(selectedBooking.balance).toLocaleString("en-IN")}</strong></span>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Transactions Ledger</h4>
                {loadingPayments ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading transactions...</div>
                ) : bookingPayments.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    No payment logs found for this reservation.
                  </div>
                ) : (
                  <div className="table-container" style={{ marginBottom: 0 }}>
                    <table className="custom-table" style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Time</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Ref Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookingPayments.map((p) => (
                          <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{new Date(p.paid_at).toLocaleDateString()}</td>
                            <td style={{ color: "var(--success)", fontWeight: "600" }}>₹{parseFloat(p.amount).toLocaleString("en-IN")}</td>
                            <td style={{ textTransform: "capitalize" }}>{p.method}</td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{p.reference || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <CheckSquare size={48} style={{ marginBottom: "1rem", opacity: 0.3 }} />
              <h3>Select a booking stay</h3>
              <p>Click on any guest stay from the sidebar list to check-in/out guests, register physical counter payments, or manage status overrides.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}