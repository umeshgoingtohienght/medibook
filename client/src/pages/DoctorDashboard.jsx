import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocketEvent } from "../context/SocketContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, formatTime, inr, todayIST } from "../utils/format.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const nowTimeIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 16);
const started = (a) => a.date < todayIST() || (a.date === todayIST() && a.time <= nowTimeIST());
const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export default function DoctorDashboard() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayIST());
  const [dayAppts, setDayAppts] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("schedule");

  const load = useCallback(async () => {
    const [d, u] = await Promise.all([
      api(`/appointments?date=${date}`, { token }),
      api("/appointments?scope=upcoming", { token }),
    ]);
    setDayAppts(d.appointments);
    setUpcoming(u.appointments.filter((a) => a.status === "booked"));
  }, [date, token]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api("/doctors/me/profile", { token }).then((d) => setProfile(d.doctor));
  }, [token]);

  useSocketEvent("appointment:new", useCallback((e) => {
    toast(`🔔 New booking: ${e.patient} · ${formatDate(e.date)} ${formatTime(e.time)}`, "success");
    load();
  }, [load, toast]));
  useSocketEvent("appointment:cancelled", useCallback((e) => {
    toast(`Patient cancelled ${formatDate(e.date)} ${formatTime(e.time)}`, "warn");
    load();
  }, [load, toast]));

  const act = async (a, action) => {
    try {
      if (action === "cancel") {
        if (!window.confirm(`Cancel ${a.patient.name}'s appointment?`)) return;
        await api(`/appointments/${a.id}/cancel`, { method: "PATCH", token });
      } else {
        await api(`/appointments/${a.id}/status`, { method: "PATCH", token, body: { status: action } });
      }
      toast("Appointment updated", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const today = todayIST();
  const weekCount = useMemo(() => upcoming.filter((a) => a.date <= addDays(today, 6)).length, [upcoming, today]);
  const todays = upcoming.filter((a) => a.date === today);
  const nextPatient = todays.find((a) => !started(a));

  return (
    <main className="container">
      <div className="row-between">
        <div>
          <h1 className="page-title">Good day, {user.name.split(" ").slice(0, 2).join(" ")}</h1>
          <p className="muted">{formatDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      {profile && !profile.approved && (
        <div className="banner warn">⏳ Your profile is awaiting admin approval. Patients can book you once it is approved.</div>
      )}

      <section className="stats">
        <div className="stat"><span className="muted">Today</span><strong>{todays.length}</strong><span className="tiny muted">appointments</span></div>
        <div className="stat"><span className="muted">Next 7 days</span><strong>{weekCount}</strong><span className="tiny muted">booked</span></div>
        <div className="stat"><span className="muted">Next patient</span><strong className="small">{nextPatient ? formatTime(nextPatient.time) : "—"}</strong><span className="tiny muted">{nextPatient?.patient.name || "No more today"}</span></div>
        <div className="stat"><span className="muted">Fee</span><strong>{profile ? inr(profile.fee) : "—"}</strong><span className="tiny muted">per consultation</span></div>
      </section>

      <div className="tabs">
        <button className={tab === "schedule" ? "on" : ""} onClick={() => setTab("schedule")}>📅 Appointments</button>
        <button className={tab === "availability" ? "on" : ""} onClick={() => setTab("availability")}>⚙️ Availability & profile</button>
      </div>

      {tab === "schedule" ? (
        <div className="split">
          <section className="card">
            <div className="row-between">
              <h2>{date === today ? "Today's schedule" : formatDate(date, { weekday: "long", day: "numeric", month: "short" })}</h2>
              <div className="row gap">
                <button className="btn ghost sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">←</button>
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                <button className="btn ghost sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">→</button>
              </div>
            </div>
            {dayAppts.length === 0 && <p className="empty-card">No appointments on this day.</p>}
            <ol className="timeline">
              {dayAppts.map((a) => (
                <li key={a.id} className={a.status}>
                  <span className="t">{formatTime(a.time)}</span>
                  <div className="tl-body">
                    <div className="row-between">
                      <b>{a.patient.name}</b>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="tiny muted">{a.reason || "No reason given"}{a.patient.phone ? ` · 📞 ${a.patient.phone}` : ""}</p>
                    {a.status === "booked" && (
                      <div className="row gap tl-actions">
                        {started(a) ? (
                          <>
                            <button className="btn primary sm" onClick={() => act(a, "completed")}>Mark completed</button>
                            <button className="btn ghost sm" onClick={() => act(a, "no-show")}>No-show</button>
                          </>
                        ) : (
                          <button className="link danger" onClick={() => act(a, "cancel")}>Cancel</button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="card">
            <h2>Upcoming</h2>
            {upcoming.length === 0 && <p className="muted">Nothing booked yet.</p>}
            <ul className="mini-list">
              {upcoming.slice(0, 8).map((a) => (
                <li key={a.id}><button className="link" onClick={() => setDate(a.date)}>{formatDate(a.date)} · {formatTime(a.time)}</button><span>{a.patient.name}</span></li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        profile && <AvailabilityEditor profile={profile} onSaved={setProfile} />
      )}
    </main>
  );
}

function AvailabilityEditor({ profile, onSaved }) {
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    fee: profile.fee, slotMinutes: profile.slotMinutes, clinic: profile.clinic, bio: profile.bio, schedule: profile.schedule,
  });
  const [saving, setSaving] = useState(false);

  const blocks = (day) => form.schedule.map((b, i) => ({ ...b, i })).filter((b) => b.day === day);
  const updateBlock = (i, key, value) =>
    setForm({ ...form, schedule: form.schedule.map((b, j) => (j === i ? { ...b, [key]: value } : b)) });

  const save = async () => {
    setSaving(true);
    try {
      const d = await api("/doctors/me/profile", { method: "PATCH", token, body: { ...form, fee: Number(form.fee), slotMinutes: Number(form.slotMinutes) } });
      onSaved(d.doctor);
      toast("Availability saved — patients see it instantly", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="grid-3">
        <label>Consultation fee (₹)<input type="number" min={0} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></label>
        <label>Slot length
          <select value={form.slotMinutes} onChange={(e) => setForm({ ...form, slotMinutes: e.target.value })}>
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
        <label>Clinic<input value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} /></label>
      </div>
      <label>About you<textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>

      <h3>Weekly hours</h3>
      <div className="week">
        {DAYS.map((name, day) => (
          <div key={name} className="week-row">
            <b>{name}</b>
            <div className="blocks">
              {blocks(day).length === 0 && <span className="muted tiny">Closed</span>}
              {blocks(day).map((b) => (
                <span key={b.i} className="block">
                  <input type="time" value={b.start} onChange={(e) => updateBlock(b.i, "start", e.target.value)} aria-label={`${name} start`} />
                  –
                  <input type="time" value={b.end} onChange={(e) => updateBlock(b.i, "end", e.target.value)} aria-label={`${name} end`} />
                  <button className="link danger" onClick={() => setForm({ ...form, schedule: form.schedule.filter((_, j) => j !== b.i) })} aria-label="Remove">✕</button>
                </span>
              ))}
            </div>
            <button className="link" onClick={() => setForm({ ...form, schedule: [...form.schedule, { day, start: "10:00", end: "13:00" }] })}>+ Add hours</button>
          </div>
        ))}
      </div>
      <button className="btn primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
    </section>
  );
}
