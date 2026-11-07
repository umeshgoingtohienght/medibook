import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, inr } from "../utils/format.js";

export default function AdminDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);

  const load = useCallback(async () => {
    const [s, p, a] = await Promise.all([
      api("/admin/stats", { token }),
      api("/admin/doctors?status=pending", { token }),
      api("/admin/doctors?status=approved", { token }),
    ]);
    setStats(s);
    setPending(p.doctors);
    setApproved(a.doctors);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (doc, ok) => {
    await api(`/admin/doctors/${doc.id}`, { method: "PATCH", token, body: { approved: ok } });
    toast(ok ? `${doc.name} approved ✓` : `${doc.name} moved to pending`, ok ? "success" : "info");
    load();
  };

  if (!stats) return <div className="center"><div className="spinner" /></div>;
  const max = Math.max(...stats.last7.map((d) => d.count), 1);
  const total = Object.values(stats.appointments).reduce((a, b) => a + b, 0);

  return (
    <main className="container">
      <h1 className="page-title">Admin overview</h1>
      <section className="stats">
        <div className="stat"><span className="muted">Patients</span><strong>{stats.patients}</strong></div>
        <div className="stat"><span className="muted">Active doctors</span><strong>{stats.doctors}</strong>
          {stats.pendingDoctors > 0 && <span className="tiny warn-text">{stats.pendingDoctors} awaiting approval</span>}</div>
        <div className="stat"><span className="muted">Appointments today</span><strong>{stats.todayAppointments}</strong></div>
        <div className="stat"><span className="muted">Revenue (completed)</span><strong>{inr(stats.revenue)}</strong></div>
      </section>

      <div className="split">
        <section className="card">
          <h2>Appointments · last 7 days</h2>
          <div className="bars" role="img" aria-label="Appointments per day for the last 7 days">
            {stats.last7.map((d) => (
              <div key={d.date} className="bar-col" title={`${d.count} appointments`}>
                <span className="bar-val">{d.count}</span>
                <span className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
                <span className="tiny muted">{formatDate(d.date, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Status breakdown</h2>
          <ul className="breakdown">
            {Object.entries(stats.appointments).map(([k, v]) => (
              <li key={k}>
                <span className={`status ${k}`}>{k}</span>
                <span className="track"><i className={k} style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></span>
                <b>{v}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2>Doctor approvals {pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
        {pending.length === 0 && <p className="muted">All caught up — no pending registrations.</p>}
        <div className="table">
          {pending.map((d) => (
            <div key={d.id} className="tr">
              <Avatar name={d.name} size={40} />
              <div><b>{d.name}</b><p className="tiny muted">{d.email}</p></div>
              <div>{d.specialty}<p className="tiny muted">{d.qualifications} · {d.experienceYears} yrs</p></div>
              <div>{d.city}<p className="tiny muted">{inr(d.fee)}</p></div>
              <div className="row gap">
                <button className="btn primary sm" onClick={() => decide(d, true)}>Approve</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Active doctors</h2>
        <div className="table">
          {approved.map((d) => (
            <div key={d.id} className="tr">
              <Avatar name={d.name} size={40} />
              <div><b>{d.name}</b><p className="tiny muted">{d.email}</p></div>
              <div>{d.specialty}<p className="tiny muted">{d.experienceYears} yrs</p></div>
              <div>{d.city}<p className="tiny muted">{inr(d.fee)}</p></div>
              <div><button className="link danger" onClick={() => decide(d, false)}>Suspend</button></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
