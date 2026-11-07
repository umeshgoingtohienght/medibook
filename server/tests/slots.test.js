import {
  addDays, bookingDateError, generateSlots, hasStarted, nowIST, slotsWithAvailability, weekday,
} from "../src/utils/slots.js";

const schedule = [
  { day: 1, start: "09:00", end: "10:00" },
  { day: 1, start: "17:00", end: "18:00" },
];
const MONDAY = "2026-11-09";

describe("slot engine", () => {
  it("knows the weekday", () => expect(weekday(MONDAY)).toBe(1));

  it("generates slots for every block on that weekday", () => {
    expect(generateSlots(schedule, 30, MONDAY)).toEqual(["09:00", "09:30", "17:00", "17:30"]);
    expect(generateSlots(schedule, 30, "2026-11-10")).toEqual([]);
  });

  it("drops a slot that would overrun the block", () => {
    expect(generateSlots([{ day: 1, start: "09:00", end: "09:50" }], 20, MONDAY)).toEqual(["09:00", "09:20"]);
  });

  it("converts UTC to IST correctly", () => {
    // 2026-11-08 20:00 UTC = 2026-11-09 01:30 IST
    expect(nowIST(new Date("2026-11-08T20:00:00Z"))).toEqual({ date: MONDAY, minutes: 90 });
  });

  it("marks booked and already-passed slots as unavailable", () => {
    const now = new Date("2026-11-09T03:50:00Z"); // 09:20 IST → 09:30 is < 15 min away
    const s = slotsWithAvailability(schedule, 30, MONDAY, ["17:00"], now);
    expect(s.map((x) => [x.time, x.available])).toEqual([
      ["09:00", false], ["09:30", false], ["17:00", false], ["17:30", true],
    ]);
    expect(s[2].booked).toBe(true);
  });

  it("validates the booking window", () => {
    const now = new Date("2026-11-09T05:00:00Z");
    expect(bookingDateError("2026-11-08", now)).toMatch(/past/);
    expect(bookingDateError(addDays(MONDAY, 31), now)).toMatch(/30 days/);
    expect(bookingDateError("09-11-2026", now)).toMatch(/format/);
    expect(bookingDateError(addDays(MONDAY, 3), now)).toBeNull();
  });

  it("detects started appointments", () => {
    const now = new Date("2026-11-09T05:00:00Z"); // 10:30 IST
    expect(hasStarted(MONDAY, "10:00", now)).toBe(true);
    expect(hasStarted(MONDAY, "11:00", now)).toBe(false);
  });
});
