import React, { useState, useEffect } from "react";
import "../index.css";
import { Search, Calendar, MapPin, Award, CheckCircle, ArrowRight, User } from "lucide-react";
import { apiFetch, DEFAULT_PROPERTIES } from "../api";
export default function LandingPage({ user, triggerToast, onNavigate }) {
  const [properties, setProperties] = useState(DEFAULT_PROPERTIES);
  const [selectedProperty, setSelectedProperty] = useState("1");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomType, setRoomType] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [guestsCount, setGuestsCount] = useState(1);
  const [includeDeposit, setIncludeDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("card");
  const [depositRef, setDepositRef] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    setCheckIn(today.toISOString().split("T")[0]);
    setCheckOut(tomorrow.toISOString().split("T")[0]);
  }, []);
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await apiFetch("/properties");
        if (res.ok) {
          const data = await res.json();
          if (data.items?.length > 0) {
            setProperties(data.items);
            setSelectedProperty(data.items[0].id.toString());
          }
        }
      } catch (err) {
        console.warn("Could not fetch properties, using default list", err);
      }
    }
    loadProperties();
  }, []);
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!selectedProperty) {
      triggerToast("Please select a hotel.", "error");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      triggerToast("Check-out date must be after check-in date.", "error");
      return;
    }
    setLoading(true);
    setSearchResults(null);
    try {
      let url = `/properties/${selectedProperty}/availability?from=${checkIn}&to=${checkOut}`;
      if (roomType) {
        url += `&room_type=${encodeURIComponent(roomType)}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        if (data.items?.length === 0) {
          triggerToast("No rooms available for the selected dates.", "info");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Search failed.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server. Please verify FastAPI is running on port 8000.", "error");
    } finally {
      setLoading(false);
    }
  };
  const handleBookClick = (room) => {
    if (!user) {
      triggerToast("Please login or register to book a room.", "info");
      sessionStorage.setItem("pending_booking", JSON.stringify({
        propertyId: selectedProperty,
        checkIn,
        checkOut,
        roomId: room.room_id,
        roomNumber: room.room_number,
        totalRate: room.total_rate,
        nights: room.nights,
        roomType: room.room_type
      }));
      onNavigate("auth");
      return;
    }
    setBookingRoom(room);
    setGuestsCount(1);
    setIncludeDeposit(false);
    setDepositAmount("");
    setDepositRef("");
  };
  const submitBooking = async (e) => {
    e.preventDefault();
    if (guestsCount > bookingRoom.room_type.max_occupancy) {
      triggerToast(`Max capacity for this room type is ${bookingRoom.room_type.max_occupancy}.`, "error");
      return;
    }
    setBookingSubmitting(true);
    try {
      const payload = {
        room_id: bookingRoom.room_id,
        check_in: checkIn,
        check_out: checkOut,
        guests: parseInt(guestsCount),
      };
      if (includeDeposit) {
        payload.deposit = {
          amount: parseFloat(depositAmount),
          method: depositMethod,
          reference: depositRef || null,
        };
      }
      const res = await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const booking = await res.json();
        triggerToast(`Booking #${booking.id} confirmed successfully!`, "success");
        setBookingRoom(null);
        handleSearch();
        onNavigate("guest");
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.error?.message || "Booking failed.", "error");
      }
    } catch (err) {
      triggerToast("Cannot reach backend server to confirm booking. Please verify server status.", "error");
    } finally {
      setBookingSubmitting(false);
    }
  };
  const getPropertyName = (id) => {
    const prop = properties.find(p => p.id.toString() === id.toString());
    return prop ? prop.name : "Kaveri Resort";
  };
  return (
    <div className="landing-page">
      <section className="hero-section" style={{
        padding: "5rem 0",
        textAlign: "center",
        background: "linear-gradient(135deg, #090d16 0%, #111827 50%, #090d16 100%)",
        borderBottom: "1px solid var(--border)",
        position: "relative"
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1rem" }}>
          <h1 className="font-serif" style={{ fontSize: "3.5rem", color: "#fff", marginBottom: "1.5rem", lineHeight: "1.2" }}>
            Experience Royal Hospitality in <span style={{ color: "var(--primary)" }}>Kaveri</span> Stays
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.15rem", marginBottom: "2.5rem", maxWidth: "600px", margin: "0 auto 2.5rem" }}>
            Unwind in Coorg's rivers, Ooty's mist-covered hills, and Alleppey's backwaters. Your luxury escape awaits.
          </p>
        </div>
      </section>
      <section style={{ marginTop: "-2.5rem", padding: "0 1rem" }}>
        <form onSubmit={handleSearch} className="glass-panel" style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          alignItems: "end"
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <MapPin size={14} style={{ marginRight: "4px", color: "var(--primary)", verticalAlign: "middle" }} />
              Select Destination
            </label>
            <select
              className="form-control form-select"
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}>
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.city}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <Calendar size={14} style={{ marginRight: "4px", color: "var(--primary)", verticalAlign: "middle" }} />
              Check In
            </label>
            <input
              type="date"
              className="form-control"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <Calendar size={14} style={{ marginRight: "4px", color: "var(--primary)", verticalAlign: "middle" }} />
              Check Out
            </label>
            <input
              type="date"
              className="form-control"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Room Type</label>
            <select
              className="form-control form-select"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}>
              <option value="">All Room Types</option>
              <option value="Deluxe">Deluxe Room</option>
              <option value="Suite">Presidential Suite</option>
              <option value="Standard">Standard Room</option>
              <option value="Executive">Executive Suite</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "220px" }}>
              {loading ? "Searching..." : (
                <>
                  <Search size={18} />
                  Check Availability
                </>)}
            </button>
          </div>
        </form>
      </section>
      {!searchResults && (
        <section style={{ maxWidth: "1280px", margin: "5rem auto 3rem", padding: "0 1.5rem" }}>
          <h2 className="font-serif" style={{ fontSize: "2.25rem", textAlign: "center", marginBottom: "3rem" }}>
            Our Signature Destinations
          </h2>
          <div className="grid-3">
            <div className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: "200px", background: "linear-gradient(45deg, #1e3a8a, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={48} color="rgba(255,255,255,0.7)" />
              </div>
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.25rem" }}>Kaveri Riverside</h3>
                  <div style={{ color: "var(--primary)", display: "flex", gap: "2px" }}>★★★★☆</div>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                  Nestled in the lush hills of Coorg, overlooking the serene river banks. Ideal for nature lovers and tranquil retreats.
                </p>
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.5rem", borderRadius: "4px", color: "var(--primary)" }}>Coorg</span>
              </div>
            </div>
            <div className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: "200px", background: "linear-gradient(45deg, #311b92, #880e4f)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={48} color="rgba(255,255,255,0.7)" />
              </div>
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.25rem" }}>Kaveri Hilltop</h3>
                  <div style={{ color: "var(--primary)", display: "flex", gap: "2px" }}>★★★★★</div>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                  Perched high in Ooty's clouds, offering breathtaking views of tea gardens and valleys. Wrap yourself in cozy mountain luxury.
                </p>
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.5rem", borderRadius: "4px", color: "var(--primary)" }}>Ooty</span>
              </div>
            </div>
            <div className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: "200px", background: "linear-gradient(45deg, #01579b, #006064)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={48} color="rgba(255,255,255,0.7)" />
              </div>
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.25rem" }}>Kaveri Backwater</h3>
                  <div style={{ color: "var(--primary)", display: "flex", gap: "2px" }}>★★★★☆</div>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                  Experience backwater bliss in Alleppey. Watch houseboats slide by from your private floating balcony.
                </p>
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.5rem", borderRadius: "4px", color: "var(--primary)" }}>Alleppey</span>
              </div>
            </div>
          </div>
        </section>)}
      {searchResults && (
        <section style={{ maxWidth: "1000px", margin: "4rem auto 3rem", padding: "0 1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 className="font-serif" style={{ fontSize: "2rem" }}>Available Accommodations</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                {searchResults.items?.length || 0} rooms found at <strong>{getPropertyName(selectedProperty)}</strong> ({checkIn} to {checkOut})
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => setSearchResults(null)}>Clear Search</button>
          </div>
          {searchResults.items?.length === 0 ? (
            <div className="glass-panel" style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <Award size={48} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
              <h3 style={{ marginBottom: "0.5rem" }}>No Rooms Available</h3>
              <p style={{ color: "var(--text-muted)" }}>Try searching for a different property or adjusting your stay dates.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {searchResults.items.map((room) => (
                <div key={room.room_id} className="glass-panel" style={{
                  display: "flex",
                  padding: "1.5rem",
                  gap: "2rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "var(--transition)"
                }}>
                  <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <div style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(31, 41, 55, 0.8) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--border)"
                    }}>
                      <span className="font-serif" style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{room.room_number}</span>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        Room {room.room_number}
                        <span style={{ fontSize: "0.8rem", fontWeight: "normal", background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: "4px", color: "var(--text-muted)" }}>
                          {room.room_type.name}
                        </span>
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                        Max Occupancy: {room.room_type.max_occupancy} Guest{room.room_type.max_occupancy > 1 ? "s" : ""}
                      </p>
                      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle size={12} /> Instant Confirmation
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle size={12} /> Free cancellation
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "150px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total for {room.nights} night{room.nights > 1 ? "s" : ""}</div>
                    <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--primary)", margin: "0.25rem 0" }}>₹{parseFloat(room.total_rate).toLocaleString("en-IN")}</div>
                    <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => handleBookClick(room)}>
                      Book Now
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>)}
      {bookingRoom && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
              <h3 className="font-serif" style={{ fontSize: "1.5rem" }}>Complete Your Booking</h3>
              <button style={{ cursor: "pointer", fontSize: "1.5rem", color: "var(--text-muted)" }} onClick={() => setBookingRoom(null)}>×</button>
            </div>
            <div className="glass-card" style={{ marginBottom: "1.5rem", background: "rgba(255,255,255,0.02)" }}>
              <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>{getPropertyName(selectedProperty)}</h4>
              <p style={{ fontSize: "0.95rem" }}><strong>Room:</strong> {bookingRoom.room_number} ({bookingRoom.room_type.name})</p>
              <p style={{ fontSize: "0.95rem" }}><strong>Dates:</strong> {checkIn} to {checkOut} ({bookingRoom.nights} Night{bookingRoom.nights > 1 ? "s" : ""})</p>
              <p style={{ fontSize: "1.1rem", fontWeight: "600", marginTop: "0.5rem", borderTop: "1px dashed var(--border)", paddingTop: "0.5rem" }}>
                Total Rate: <span style={{ color: "var(--primary)" }}>₹{parseFloat(bookingRoom.total_rate).toLocaleString("en-IN")}</span>
              </p>
            </div>
            <form onSubmit={submitBooking}>
              <div className="form-group">
                <label className="form-label">Number of Guests</label>
                <select
                  className="form-control form-select"
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(e.target.value)}>
                  {Array.from({ length: bookingRoom.room_type.max_occupancy }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} Guest{n > 1 ? "s" : ""}</option>))}
                </select>
                <small style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "4px", display: "block" }}>
                  Max capacity: {bookingRoom.room_type.max_occupancy} guests.
                </small>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "1.5rem 0" }}>
                <input
                  type="checkbox"
                  id="includeDeposit"
                  checked={includeDeposit}
                  onChange={(e) => setIncludeDeposit(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }} />
                <label htmlFor="includeDeposit" style={{ cursor: "pointer", fontWeight: "500" }}>Pay Security Deposit Now</label>
              </div>
              {includeDeposit && (
                <div style={{ borderLeft: "2px solid var(--primary)", paddingLeft: "1rem", marginTop: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Deposit Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 5000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      max={bookingRoom.total_rate}
                      min="1"
                      required />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Payment Method</label>
                      <select
                        className="form-control form-select"
                        value={depositMethod}
                        onChange={(e) => setDepositMethod(e.target.value)}>
                        <option value="card">Credit/Debit Card</option>
                        <option value="upi">UPI (GPay/PhonePe)</option>
                        <option value="bank_transfer">Net Banking</option>
                        <option value="cash">Cash at Counter</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reference ID (Optional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Transaction Ref No"
                        value={depositRef}
                        onChange={(e) => setDepositRef(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBookingRoom(null)}>Cancel</button>
                <button type="submit" disabled={bookingSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                  {bookingSubmitting ? "Confirming..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
