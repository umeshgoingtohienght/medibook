import { Link } from "react-router-dom";
import { inr, SPECIALTY_ICONS } from "../utils/format.js";
import Avatar from "./Avatar.jsx";

export default function DoctorCard({ doctor }) {
  return (
    <article className="doc-card">
      <div className="doc-head">
        <Avatar name={doctor.name} size={56} />
        <div>
          <h3>{doctor.name}</h3>
          <p className="muted">{SPECIALTY_ICONS[doctor.specialty]} {doctor.specialty}</p>
          <p className="tiny muted">{doctor.qualifications}</p>
        </div>
      </div>
      <ul className="doc-facts">
        <li>⭐ <b>{doctor.rating.toFixed(1)}</b></li>
        <li>🎓 {doctor.experienceYears} yrs exp</li>
        <li>📍 {doctor.city}</li>
      </ul>
      <p className="tiny muted clinic">{doctor.clinic}</p>
      <div className="doc-foot">
        <span><span className="muted tiny">Consultation</span><br /><b>{inr(doctor.fee)}</b></span>
        <Link className="btn primary" to={`/doctors/${doctor.id}`}>Book visit</Link>
      </div>
    </article>
  );
}
