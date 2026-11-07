import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Avatar from "../components/Avatar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocketEvent } from "../context/SocketContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, formatTime, inr } from "../utils/format.js";

export default function MyAppointments() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [scope, setScope] = useState("upcoming");
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    api(`/appointments?scope=${scope}`, { token }).then((d) => setItems(d.appointments));
  }, [scope, token]);

  useEffect(load, [load]);

  useSocketEvent("appointment:updated", useCallback((e) => {
    toast(`Your ${formatTime(e.time)} visit was marked ${e.status}`, "info");
    load();
  }, [load, toast]));
  useSocketEvent("appointment:cancelled", useCallback((e) => {
    toast(`The doctor cancelled your ${formatDate(e.date)} appointment`, "warn");
    load();
  }, [load, toast]));

  const cancel = async (id) => {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await api(`/appointments/${id}/cancel`, { method: "PATCH", token });
      toast("Appointment cancelled", "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const next = items?.find((a) => a.status === "booked");

  return (
    <main className="container narrow">
      <div className="row-between">
        <div>
          <h1 className="page-title">My appointments</h1>
          <p className="muted">Hi {user.name.split(" ")[0]}, here's your care schedule.</p>
        </div>
        <Link className="btn primary" to="/">+ Book new</Link>
      </div>

      {scope === "upcoming" && next && (
        <div className="next-card">
          <span className="tiny">NEXT VISIT</span>
          <h2>{formatDate(next.date, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(next.time)}</h2>
          <p>{next.doctor.name} · {next.doctor.specialty} · {next.doctor.clinic}, {next.doctor.city}</p>
        </div>
      )}

      <div className="tabs" role="tablist">
        {["upcoming", "past"].map((s) => (
          <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? "on" : ""} onClick={() => setScope(s)}>
            {s === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      {!items && <div className="center"><div className="spinner" /></div>}
      {items?.length === 0 && (
        <div className="empty-card">
          {scope === "upcoming" ? "No upcoming appointments." : "No past appointments yet."}{" "}
          <Link to="/">Find a doctor →</Link>
        </div>
      )}
      <div className="list">
        {items?.map((a) => (
          <article key={a.id} className="appt">
            <div className="appt-date">
              <b>{formatDate(a.date, { day: "numeric" })}</b>
              <span>{formatDate(a.date, { month: "short" })}</span>
            </div>
            <Avatar name={a.doctor.name} size={44} />
            <div className="appt-main">
              <h3>{a.doctor.name}</h3>
              <p className="muted">{a.doctor.specialty} · {formatTime(a.time)} · {a.doctor.clinic}</p>
              {a.reason && <p className="tiny muted">“{a.reason}”</p>}
            </div>
            <div className="appt-side">
              <StatusBadge status={a.status} />
              <span className="tiny muted">{inr(a.fee)}</span>
              {a.status === "booked" && <button className="link danger" onClick={() => cancel(a.id)}>Cancel</button>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
