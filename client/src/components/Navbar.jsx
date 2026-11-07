import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = {
    patient: [["/", "Find doctors"], ["/appointments", "My appointments"]],
    doctor: [["/doctor", "Dashboard"]],
    admin: [["/admin", "Admin"], ["/", "Doctors"]],
  }[user?.role] || [["/", "Find doctors"]];

  return (
    <header className="nav">
      <Link to="/" className="brand">🩺 Medi<span>Book</span></Link>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
        ))}
      </nav>
      <div className="nav-right">
        {user ? (
          <>
            <span className="who"><Avatar name={user.name} size={30} /> <span className="hide-sm">{user.name}</span></span>
            <button className="btn ghost sm" onClick={() => { logout(); navigate("/"); }}>Log out</button>
          </>
        ) : (
          <>
            <Link className="btn ghost sm" to="/login">Log in</Link>
            <Link className="btn primary sm" to="/register">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
