import React, { useState, useEffect } from "react";
import "../index.css";
import { Calendar, CreditCard, XCircle, Award, Star, ListFilter, ClipboardCheck, ArrowUpRight, DollarSign } from "lucide-react";
import { apiFetch } from "../api";
export default function GuestDashboard({ user, triggerToast }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeBooking, setActiveBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("card");
  const [payRef, setPayRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedBookings, setReviewedBookings] = useState({});

  const loadPayments = async (bookingId) => {
    setLoadingPayments(true);
    try {
      const res = await apiFetch(`/bookings/${bookingId}/payments`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Failed to load payment history.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server to load payments.", "error");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleBookingSelect = (booking) => {
    setActiveBooking(booking);
    loadPayments(booking.id);
    setPayAmount("");
    setPayRef("");
    setRating(5);
    setComment("");
  };

  const loadBookings = async (autoSelect = true) => {
    setLoading(true);
    try {
      let url = "/bookings?limit=100";
      if (filterStatus !== "all") {
        url += `&status=${filterStatus}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setBookings(items);
        if (autoSelect && items.length > 0 && !activeBooking) {
          handleBookingSelect(items[0]);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Failed to load your bookings.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server. Please verify FastAPI is running on port 8000.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings(true);
  }, [filterStatus]);
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await apiFetch(`/bookings/${bookingId}/cancel`, {
        method: "POST"
      });
      if (res.ok) {
        triggerToast("Booking cancelled successfully.", "success");
        const updated = await res.json();
        setActiveBooking(updated);
        loadBookings();
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Cancellation failed.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server to cancel booking.", "error");
    }
  };
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      triggerToast("Please enter a valid positive amount.", "error");
      return;
    }
    const maxInstallment = parseFloat(activeBooking.balance);
    if (parseFloat(payAmount) > maxInstallment) {
      triggerToast(`Payment exceeds booking balance of ₹${maxInstallment.toLocaleString("en-IN")}`, "error");
      return;
    }
    setSubmittingPayment(true);
    try {
      const idempotencyKey = `pay-${activeBooking.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const res = await apiFetch(`/bookings/${activeBooking.id}/payments`, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          method: payMethod,
          reference: payRef || null
        })
      });
      if (res.ok) {
        triggerToast("Payment processed successfully!", "success");
        setPayAmount("");
        setPayRef("");
        loadPayments(activeBooking.id);
        const bRes = await apiFetch(`/bookings/${activeBooking.id}`);
        if (bRes.ok) {
          const fresh = await bRes.json();
          setActiveBooking(fresh);
        }
        loadBookings();
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Payment processing failed.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server to report payment.", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };
  const handleAddReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await apiFetch(`/bookings/${activeBooking.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          rating: parseInt(rating),
          comment: comment || null
        })
      });
      if (res.ok) {
        triggerToast("Review submitted successfully! Thank you for your feedback.", "success");
        setComment("");
        setReviewedBookings(prev => ({ ...prev, [activeBooking.id]: true }));
        const bRes = await apiFetch(`/bookings/${activeBooking.id}`);
        if (bRes.ok) {
          const freshBooking = await bRes.json();
          setActiveBooking(freshBooking);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Failed to submit review.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server to submit review.", "error");
    } finally {
      setSubmittingReview(false);
    }
  };
  return (
    <div className="guest-dashboard">
      <div className="glass-panel" style={{ padding: "1.5rem 2rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 className="font-serif" style={{ fontSize: "1.8rem" }}>My Guest Portal</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Welcome back, <strong>{user?.full_name}</strong> ({user?.email})
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.75rem", borderRadius: "9999px", color: "var(--primary)" }}>
            Role: {user?.role}
          </span>
        </div>
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: "1fr 2fr", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ListFilter size={18} aria-hidden="true" />
              Filter Stays
            </h3>
            <label htmlFor="filter-status-guest" className="form-label">Status</label>
            <select
              id="filter-status-guest"
              name="filterStatus"
              aria-label="Filter bookings by status"
              className="form-control form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Bookings</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
          <div className="glass-panel" style={{ padding: "1.25rem", maxHeight: "60vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Stay History</h3>
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)" }}>Loading stays...</div>
            ) : bookings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No bookings found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleBookingSelect(b)}
                    className="glass-card"
                    style={{
                      padding: "1rem",
                      cursor: "pointer",
                      borderLeft: activeBooking?.id === b.id ? "3px solid var(--primary)" : "1px solid var(--border)",
                      background: activeBooking?.id === b.id ? "rgba(217, 119, 6, 0.04)" : "rgba(31, 41, 55, 0.2)"
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>Booking #{b.id}</span>
                      <span className={`badge badge-${b.status}`}>{b.status}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Room {b.room_number} • {b.nights} night{b.nights > 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {b.check_in} to {b.check_out}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", borderTop: "1px dashed var(--border)", paddingTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Balance:</span>
                      <span style={{ fontWeight: "600", fontSize: "0.9rem", color: parseFloat(b.balance) > 0 ? "var(--warning)" : "var(--success)" }}>
                        ₹{parseFloat(b.balance).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>))}
              </div>)}
          </div>
        </div>
        {activeBooking ? (
          <div className="glass-panel" style={{ padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <h3 className="font-serif" style={{ fontSize: "1.75rem" }}>Reservation Details #{activeBooking.id}</h3>
                  <span className={`badge badge-${activeBooking.status}`}>{activeBooking.status}</span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                  Booked on {new Date(activeBooking.created_at).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {activeBooking.status === "confirmed" && (
                  <button onClick={() => handleCancelBooking(activeBooking.id)} className="btn btn-danger" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}>
                    <XCircle size={16} aria-hidden="true" /> Cancel Booking
                  </button>
                )}
              </div>
            </div>
            <div className="grid-2" style={{ marginBottom: "2rem", gap: "1.5rem" }}>
              <div className="glass-card">
                <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Calendar size={16} aria-hidden="true" /> Stay Itinerary
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem" }}>
                  <p><strong>Room Number:</strong> {activeBooking.room_number}</p>
                  <p><strong>Check-In:</strong> {activeBooking.check_in}</p>
                  <p><strong>Check-Out:</strong> {activeBooking.check_out}</p>
                  <p><strong>Duration:</strong> {activeBooking.nights} Night{activeBooking.nights > 1 ? "s" : ""}</p>
                  <p><strong>Guests:</strong> {activeBooking.guests_count}</p>
                </div>
              </div>
              <div className="glass-card">
                <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CreditCard size={16} aria-hidden="true" /> Financial Summary
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Room Total Charge:</span>
                    <span style={{ fontWeight: "600" }}>₹{parseFloat(activeBooking.total_rate).toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total Payments Deposited:</span>
                    <span style={{ color: "var(--success)", fontWeight: "600" }}>- ₹{parseFloat(activeBooking.total_paid).toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: "0.75rem", fontSize: "1.1rem" }}>
                    <span><strong>Outstanding Balance:</strong></span>
                    <span style={{ color: parseFloat(activeBooking.balance) > 0 ? "var(--warning)" : "var(--success)", fontWeight: "bold" }}>
                      ₹{parseFloat(activeBooking.balance).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {parseFloat(activeBooking.balance) > 0 && activeBooking.status !== "cancelled" && activeBooking.status !== "no_show" && (
              <div style={{ background: "rgba(217, 119, 6, 0.02)", border: "1px solid rgba(217, 119, 6, 0.2)", padding: "1.5rem", borderRadius: "12px", marginBottom: "2rem" }}>
                <h4 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CreditCard size={18} aria-hidden="true" />
                  Submit Installment Payment
                </h4>
                <form onSubmit={handleAddPayment} className="grid-3" style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr", alignItems: "end" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="guest-pay-amount" className="form-label">Payment Amount (₹)</label>
                    <input
                      id="guest-pay-amount"
                      name="payAmount"
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="Amount"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      max={activeBooking.balance}
                      min="1"
                      required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="guest-pay-method" className="form-label">Method</label>
                    <select
                      id="guest-pay-method"
                      name="payMethod"
                      className="form-control form-select"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="card">Credit/Debit Card</option>
                      <option value="upi">UPI Apps</option>
                      <option value="bank_transfer">Net Banking</option>
                      <option value="cash">Cash Payment</option>
                    </select>
                  </div>
                  <button type="submit" disabled={submittingPayment} className="btn btn-primary" style={{ width: "100%" }}>
                    {submittingPayment ? "Processing..." : "Pay Now"}
                  </button>
                  <div className="form-group" style={{ gridColumn: "1 / -1", marginTop: "1rem", marginBottom: 0 }}>
                    <label htmlFor="guest-pay-ref" className="form-label">Reference ID / Comments (Optional)</label>
                    <input
                      id="guest-pay-ref"
                      name="payRef"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Bank reference or card transaction receipt id"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                    />
                  </div>
                </form>
              </div>
            )}
            {activeBooking.status === "checked_out" && !reviewedBookings[activeBooking.id] && (
              <div style={{ background: "rgba(16, 185, 129, 0.02)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "1.5rem", borderRadius: "12px", marginBottom: "2rem" }}>
                <h4 style={{ fontSize: "1.1rem", color: "var(--success)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Star size={18} aria-hidden="true" />
                  Review Your Stay
                </h4>
                <form onSubmit={handleAddReview}>
                  <div className="form-group">
                    <label className="form-label">Rating</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          type="button"
                          aria-label={`Rate ${stars} star${stars > 1 ? "s" : ""}`}
                          onClick={() => setRating(stars)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px" }}>
                          <Star
                            size={28}
                            aria-hidden="true"
                            style={{ fill: stars <= rating ? "var(--primary)" : "none", color: "var(--primary)" }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="guest-review-comment" className="form-label">Review Comment (Optional)</label>
                    <textarea
                      id="guest-review-comment"
                      name="comment"
                      className="form-control"
                      rows="3"
                      placeholder="How was your stay? Let us know about the service, clean rooms, or environment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={2000} />
                  </div>
                  <button type="submit" disabled={submittingReview} className="btn btn-primary" style={{ background: "var(--success)" }}>
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </form>
              </div>)}
              <div>
                <h4 style={{ fontSize: "1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <ClipboardCheck size={18} />
                  Payment Installments
                </h4>
                {loadingPayments ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading transactions...</div>
                ) : payments.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
                    No payment transactions recorded for this reservation.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Paid At</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{new Date(p.paid_at).toLocaleString()}</td>
                            <td style={{ color: "var(--success)", fontWeight: "600" }}>₹{parseFloat(p.amount).toLocaleString("en-IN")}</td>
                            <td style={{ textTransform: "capitalize" }}>{p.method}</td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{p.reference || "—"}</td>
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
              <Star size={48} style={{ marginBottom: "1rem", opacity: 0.3 }} />
              <h3>Select a stay from the sidebar</h3>
              <p>Choose any booking from your stay history to see check-in/out dates, invoice statements, make payments, or leave feedback.</p>
            </div>
          )}
        </div>
      </div>
    );
  }