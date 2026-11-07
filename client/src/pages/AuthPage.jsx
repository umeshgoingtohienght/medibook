import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext.jsx";

const SPECIALTIES = ["General Physician", "Cardiologist", "Dermatologist", "Pediatrician", "Gynecologist",
  "Orthopedic", "ENT Specialist", "Neurologist", "Psychiatrist", "Dentist"];
const DEMO = [
  ["Patient", "patient@medibook.dev", "Patient@123"],
  ["Doctor", "rohan.mehta@medibook.dev", "Doctor@123"],
  ["Admin", "admin@medibook.dev", "Admin@123"],
];

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { authenticate, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", specialty: SPECIALTIES[0], fee: 500, city: "", qualifications: "MBBS" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || homeFor(user)} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = isLogin
        ? { email: form.email, password: form.password }
        : {
            name: form.name, email: form.email, password: form.password, phone: form.phone || undefined, role,
            ...(role === "doctor" && { doctor: { specialty: form.specialty, fee: Number(form.fee), city: form.city, qualifications: form.qualifications } }),
          };
      const u = await authenticate(mode, body);
      navigate(location.state?.from && u.role === "patient" ? location.state.from : homeFor(u));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isLogin ? "Welcome back 👋" : "Create your account"}</h1>
        <p className="muted">{isLogin ? "Log in to manage your appointments." : "Book appointments in under a minute."}</p>

        {!isLogin && (
          <div className="segmented" role="radiogroup">
            {["patient", "doctor"].map((r) => (
              <button type="button" key={r} className={role === r ? "on" : ""} onClick={() => setRole(r)} aria-pressed={role === r}>
                {r === "patient" ? "🙋 I'm a patient" : "🩺 I'm a doctor"}
              </button>
            ))}
          </div>
        )}
        {!isLogin && <label>Full name<input value={form.name} onChange={set("name")} required /></label>}
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
        {!isLogin && <label>Mobile <span className="muted">(optional)</span><input value={form.phone} onChange={set("phone")} placeholder="98765 43210" /></label>}
        <label>Password<input type="password" minLength={6} value={form.password} onChange={set("password")} required /></label>

        {!isLogin && role === "doctor" && (
          <div className="grid-2">
            <label>Specialty<select value={form.specialty} onChange={set("specialty")}>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>City<input value={form.city} onChange={set("city")} required /></label>
            <label>Qualifications<input value={form.qualifications} onChange={set("qualifications")} /></label>
            <label>Fee (₹)<input type="number" min={0} value={form.fee} onChange={set("fee")} required /></label>
            <p className="tiny muted span-2">Doctor accounts are reviewed by an admin before appearing in search.</p>
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
        <p className="center-text muted">
          {isLogin ? "New to MediBook? " : "Already registered? "}
          <Link to={isLogin ? "/register" : "/login"} state={location.state}>{isLogin ? "Create an account" : "Log in"}</Link>
        </p>

        {isLogin && (
          <div className="demo">
            <p className="tiny muted">Try a demo account</p>
            <div className="row gap">
              {DEMO.map(([label, email, password]) => (
                <button type="button" key={label} className="btn ghost sm" onClick={() => setForm({ ...form, email, password })}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
