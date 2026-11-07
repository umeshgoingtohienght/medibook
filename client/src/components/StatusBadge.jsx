const LABELS = { booked: "Upcoming", completed: "Completed", cancelled: "Cancelled", "no-show": "No-show" };
const ICONS = { booked: "🕒", completed: "✓", cancelled: "✕", "no-show": "!" };

export default function StatusBadge({ status }) {
  return <span className={`status ${status}`}>{ICONS[status]} {LABELS[status] || status}</span>;
}
