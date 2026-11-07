import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket, useSocketEvent } from "../context/SocketContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, formatTime, inr, partOfDay, SPECIALTY_ICONS } from "../utils/format.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DoctorPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const socket = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(null);
  const [slots, setSlots] = useState(null);
  const [picked, setPicked] = useState(null);
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState("");

  const loadDays = useCallback(async () => {
    const d = await api(`/doctors/${id}/availability?days=14`);
    setDays(d.days);
    setDate((cur) => cur || d.days.find((x) => x.available > 0)?.date || d.days[0].date);
  }, [id]);

  const loadSlots = useCallback(async () => {
    if (!date) return;
    const d = await api(`/doctors/${id}/slots?date=${date}`);
    setSlots(d.slots);
    setPicked((p) => (p && d.slots.find((s) => s.time === p)?.available ? p : null));
  }, [id, date]);

  useEffect(() => {
    api(`/doctors/${id}`).then((d) => setDoctor(d.doctor)).catch((e) => setError(e.message));
    loadDays().catch(() => {});
  }, [id, loadDays]);

  useEffect(() => {
    loadSlots().catch((e) => setError(e.message));
  }, [loadSlots]);

  // Live updates: join this doctor's room while the page is open
  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit("doctor:watch", id);
    join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit("doctor:unwatch", id);
    };
  }, [socket, id]);

  useSocketEvent("slots:changed", useCallback((e) => {
    if (e.doctorId !== id) return;
    loadDays();
    if (e.date === date) {
      loadSlots();
      toast("Availability just updated", "info");
    }
  }, [id, date, loadDays, loadSlots, toast]));

  const book = async () => {
    if (!user) return navigate("/login", { state: { from: `/doctors/${id}` } });
    setBooking(true);
    setError("");
    try {
      const d = await api("/appointments", { method: "POST", token, body: { doctorId: id, date, time: picked, reason } });
      setBooked(d.appointment);
      toast("Appointment confirmed 🎉", "success");
    } catch (e) {
      setError(e.message);
      loadSlots();
    } finally {
      setBooking(false);
    }
  };

  if (error && !doctor) return <main className="container"><p className="error">{error}</p></main>;
  if (!doctor) return <div className="center"><div className="spinner" /></div>;

  const groups = (slots || []).reduce((g, s) => ({ ...g, [partOfDay(s.time)]: [...(g[partOfDay(s.time)] || []), s] }), {});
  const workDays = [...new Set(doctor.schedule.map((b) => b.day))].sort().map((d) => DAYS[d]).join(", ");

  return (
    <main className="container doctor-page">
      <section className="card profile">
        <div className="profile-head">
          <Avatar name={doctor.name} size={84} />
          <div>
            <h1>{doctor.name}</h1>
            <p className="muted">{SPECIALTY_ICONS[doctor.specialty]} {doctor.specialty} · {doctor.qualifications}</p>
            <div className="pills">
              <span>⭐ {doctor.rating.toFixed(1)}</span>
              <span>🎓 {doctor.experienceYears} years</span>
              <span>🗣️ {doctor.languages.join(", ")}</span>
            </div>
          </div>
        </div>
        <p className="bio">{doctor.bio}</p>
        <dl className="facts">
          <div><dt>Clinic</dt><dd>{doctor.clinic}, {doctor.city}</dd></div>
          <div><dt>Consultation fee</dt><dd>{inr(doctor.fee)}</dd></div>
          <div><dt>Available</dt><dd>{workDays}</dd></div>
          <div><dt>Slot length</dt><dd>{doctor.slotMinutes} minutes</dd></div>
        </dl>
      </section>

      <section className="card booking">
        {booked ? (
          <div className="confirmed">
            <div className="tick">✓</div>
            <h2>Appointment confirmed</h2>
            <p>{formatDate(booked.date, { weekday: "long", day: "numeric", month: "long" })} at <b>{formatTime(booked.time)}</b></p>
            <p className="muted">with {doctor.name} · {doctor.clinic}</p>
            <div className="row gap">
              <Link className="btn primary" to="/appointments">View my appointments</Link>
              <button className="btn ghost" onClick={() => { setBooked(null); setPicked(null); setReason(""); loadSlots(); loadDays(); }}>Book another</button>
            </div>
          </div>
        ) : (
          <>
            <div className="row-between">
              <h2>Book an appointment</h2>
              <span className="live"><i /> Live availability</span>
            </div>
            <div className="date-strip" role="tablist">
              {days.map((d) => (
                <button key={d.date} role="tab" aria-selected={d.date === date} disabled={d.total === 0}
                  className={`day ${d.date === date ? "on" : ""}`} onClick={() => setDate(d.date)}>
                  <span className="tiny">{formatDate(d.date, { weekday: "short" })}</span>
                  <b>{formatDate(d.date, { day: "numeric" })}</b>
                  <span className={`tiny ${d.available ? "free" : "full"}`}>
                    {d.total === 0 ? "Off" : d.available ? `${d.available} free` : "Full"}
                  </span>
                </button>
              ))}
            </div>

            {slots && slots.length === 0 && <p className="muted">The doctor is not available on this day.</p>}
            {Object.entries(groups).map(([part, list]) => (
              <div key={part} className="slot-group">
                <h4>{part === "Morning" ? "🌅" : part === "Afternoon" ? "☀️" : "🌙"} {part}</h4>
                <div className="slots">
                  {list.map((s) => (
                    <button key={s.time} disabled={!s.available} title={s.booked ? "Already booked" : s.past ? "Time has passed" : ""}
                      className={`slot ${picked === s.time ? "on" : ""} ${s.booked ? "taken" : ""}`}
                      onClick={() => setPicked(s.time)}>
                      {formatTime(s.time)}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <label className="reason">Reason for visit <span className="muted">(optional)</span>
              <textarea rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Fever for 3 days, follow-up on blood test" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            {user && user.role !== "patient" ? (
              <p className="muted">Log in with a patient account to book.</p>
            ) : (
              <button className="btn primary block" disabled={!picked || booking} onClick={book}>
                {booking ? "Booking…" : picked ? `Confirm ${formatTime(picked)} · ${formatDate(date)} · ${inr(doctor.fee)}` : "Select a time slot"}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
