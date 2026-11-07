/**
 * Pure scheduling helpers (no database) — easy to unit test.
 * All dates/times are clinic-local India Standard Time (UTC+05:30).
 */
export const IST_OFFSET_MIN = 330;
export const BOOKING_WINDOW_DAYS = 30;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** "Now" in IST as { date: "YYYY-MM-DD", minutes: minutes since midnight }. */
export function nowIST(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return { date: ist.toISOString().slice(0, 10), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}

export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isValidTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD string. */
export const weekday = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * All slot start times a doctor works on a date.
 * schedule: [{ day: 1, start: "09:00", end: "13:00" }, …]  (several blocks per day allowed)
 */
export function generateSlots(schedule, slotMinutes, dateStr) {
  const day = weekday(dateStr);
  const slots = [];
  for (const block of schedule.filter((b) => b.day === day)) {
    for (let t = toMinutes(block.start); t + slotMinutes <= toMinutes(block.end); t += slotMinutes) {
      slots.push(toHHMM(t));
    }
  }
  return [...new Set(slots)].sort();
}

/** Slots with availability flags; past slots (today) and booked slots are unavailable. */
export function slotsWithAvailability(schedule, slotMinutes, dateStr, bookedTimes, now = new Date()) {
  const { date: today, minutes } = nowIST(now);
  const booked = new Set(bookedTimes);
  return generateSlots(schedule, slotMinutes, dateStr).map((time) => {
    const past = dateStr < today || (dateStr === today && toMinutes(time) <= minutes + 15);
    return { time, available: !past && !booked.has(time), booked: booked.has(time), past };
  });
}

/** Returns an error message if a date cannot be booked, else null. */
export function bookingDateError(dateStr, now = new Date()) {
  if (!isValidDate(dateStr)) return "Date must be in YYYY-MM-DD format";
  const { date: today } = nowIST(now);
  if (dateStr < today) return "Cannot book a date in the past";
  if (dateStr > addDays(today, BOOKING_WINDOW_DAYS)) return `Bookings open only ${BOOKING_WINDOW_DAYS} days ahead`;
  return null;
}

/** Has the appointment start time already passed? */
export function hasStarted(dateStr, time, now = new Date()) {
  const { date: today, minutes } = nowIST(now);
  return dateStr < today || (dateStr === today && toMinutes(time) <= minutes);
}

export const slotKey = (doctorId, date, time) => `${doctorId}|${date}|${time}`;
