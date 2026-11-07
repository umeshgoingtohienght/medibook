import { useEffect, useState } from "react";
import { api } from "../api.js";
import DoctorCard from "../components/DoctorCard.jsx";
import { SPECIALTY_ICONS } from "../utils/format.js";

export default function Home() {
  const [meta, setMeta] = useState({ specialties: [], cities: [] });
  const [filters, setFilters] = useState({ search: "", city: "", specialty: "", sort: "rating" });
  const [doctors, setDoctors] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/doctors/meta").then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
      api(`/doctors?${qs}`).then((d) => setDoctors(d.doctors)).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [filters]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Verified doctors · Instant confirmation</p>
          <h1>Book trusted doctors near you, <span>in seconds.</span></h1>
          <p className="hero-sub">See real-time availability, pick a slot that suits you and walk in without the wait.</p>
          <div className="searchbar">
            <input placeholder="Search doctor, specialty or clinic…" value={filters.search} onChange={set("search")} aria-label="Search" />
            <select value={filters.city} onChange={set("city")} aria-label="City">
              <option value="">All cities</option>
              {meta.cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="chips" role="list">
          <button className={!filters.specialty ? "chip on" : "chip"} onClick={() => setFilters({ ...filters, specialty: "" })}>All</button>
          {meta.specialties.map((s) => (
            <button key={s} className={filters.specialty === s ? "chip on" : "chip"}
              onClick={() => setFilters({ ...filters, specialty: filters.specialty === s ? "" : s })}>
              {SPECIALTY_ICONS[s]} {s}
            </button>
          ))}
        </div>

        <div className="row-between">
          <h2 className="section-title">
            {doctors ? `${doctors.length} doctor${doctors.length === 1 ? "" : "s"} available` : "Loading doctors…"}
          </h2>
          <select className="sort" value={filters.sort} onChange={set("sort")} aria-label="Sort">
            <option value="rating">Top rated</option>
            <option value="experience">Most experienced</option>
            <option value="fee">Lowest fee</option>
          </select>
        </div>

        {error && <p className="error">{error}</p>}
        {doctors?.length === 0 && <div className="empty-card">No doctors match your filters. Try another city or specialty.</div>}
        <div className="grid">{doctors?.map((d) => <DoctorCard key={d.id} doctor={d} />)}</div>
      </section>
    </main>
  );
}
