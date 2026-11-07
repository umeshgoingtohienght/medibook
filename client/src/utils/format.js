const parse = (date) => new Date(`${date}T00:00:00`);

export const formatDate = (date, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  parse(date).toLocaleDateString("en-IN", opts);

export const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export const initials = (name = "") =>
  name.replace(/^Dr\.?\s*/, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Today's date in India as YYYY-MM-DD, regardless of the viewer's timezone. */
export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

export const SPECIALTY_ICONS = {
  "General Physician": "🩺", Cardiologist: "❤️", Dermatologist: "🧴", Pediatrician: "🧸", Gynecologist: "🤰",
  Orthopedic: "🦴", "ENT Specialist": "👂", Neurologist: "🧠", Psychiatrist: "💬", Dentist: "🦷",
};

export const partOfDay = (hhmm) => {
  const h = Number(hhmm.slice(0, 2));
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
};
