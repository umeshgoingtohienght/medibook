import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import { emitSlotsChanged, notifyUser } from "../socket.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { bookingDateError, hasStarted, isValidTime, nowIST, slotKey, slotsWithAvailability } from "../utils/slots.js";

const populateAll = (q) =>
  q.populate("patient", "name email phone").populate({
    path: "doctor", select: "specialty clinic city fee user", populate: { path: "user", select: "name" },
  });

const shape = (a) => ({
  id: a._id,
  date: a.date,
  time: a.time,
  status: a.status,
  reason: a.reason,
  notes: a.notes,
  fee: a.fee,
  cancelledBy: a.cancelledBy,
  createdAt: a.createdAt,
  patient: a.patient?.name ? { id: a.patient._id, name: a.patient.name, email: a.patient.email, phone: a.patient.phone } : undefined,
  doctor: a.doctor?.specialty
    ? { id: a.doctor._id, name: a.doctor.user?.name, specialty: a.doctor.specialty, clinic: a.doctor.clinic, city: a.doctor.city }
    : undefined,
});

// POST /api/appointments   (patient)
export const book = asyncHandler(async (req, res) => {
  const { doctorId, date, time, reason = "" } = req.body;
  if (!mongoose.isValidObjectId(doctorId)) throw new HttpError(400, "Invalid doctor id");
  const dateErr = bookingDateError(date);
  if (dateErr) throw new HttpError(400, dateErr);
  if (!isValidTime(time)) throw new HttpError(400, "Time must be in HH:MM format");

  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.approved) throw new HttpError(404, "Doctor not found");

  const slot = slotsWithAvailability(doctor.schedule, doctor.slotMinutes, date, []).find((s) => s.time === time);
  if (!slot) throw new HttpError(400, "The doctor is not available at this time");
  if (slot.past) throw new HttpError(400, "This slot has already passed");

  const existing = await Appointment.findOne({ patient: req.user._id, doctor: doctor._id, date, status: "booked" });
  if (existing) throw new HttpError(409, `You already have an appointment with this doctor at ${existing.time} that day`);

  let appt;
  try {
    appt = await Appointment.create({
      patient: req.user._id, doctor: doctor._id, date, time, reason, fee: doctor.fee,
      slotKey: slotKey(doctor._id, date, time),
    });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "Sorry, this slot was just booked by someone else");
    throw err;
  }

  emitSlotsChanged(doctor._id, date);
  notifyUser(doctor.user, "appointment:new", { date, time, patient: req.user.name });
  res.status(201).json({ appointment: shape(await populateAll(Appointment.findById(appt._id))) });
});

// GET /api/appointments?scope=upcoming|past|all&date=YYYY-MM-DD
export const list = asyncHandler(async (req, res) => {
  const { scope = "all", date } = req.query;
  const filter = {};
  if (req.user.role === "patient") filter.patient = req.user._id;
  if (req.user.role === "doctor") {
    const doc = await Doctor.findOne({ user: req.user._id }).select("_id");
    if (!doc) throw new HttpError(404, "Doctor profile not found");
    filter.doctor = doc._id;
  }
  const today = nowIST().date;
  if (date) filter.date = date;
  else if (scope === "upcoming") filter.date = { $gte: today };
  else if (scope === "past") filter.date = { $lt: today };

  const order = scope === "past" ? { date: -1, time: -1 } : { date: 1, time: 1 };
  const appts = await populateAll(Appointment.find(filter).sort(order).limit(200));
  res.json({ appointments: appts.map(shape) });
});

async function loadForUpdate(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid appointment id");
  const appt = await Appointment.findById(id).populate("doctor", "user");
  if (!appt) throw new HttpError(404, "Appointment not found");
  const isPatient = String(appt.patient) === String(user._id);
  const isDoctor = String(appt.doctor.user) === String(user._id);
  if (!isPatient && !isDoctor && user.role !== "admin") throw new HttpError(404, "Appointment not found");
  return { appt, isPatient, isDoctor };
}

// PATCH /api/appointments/:id/cancel
export const cancel = asyncHandler(async (req, res) => {
  const { appt, isPatient } = await loadForUpdate(req.params.id, req.user);
  if (appt.status !== "booked") throw new HttpError(400, `Appointment is already ${appt.status}`);
  if (hasStarted(appt.date, appt.time)) throw new HttpError(400, "Past appointments cannot be cancelled");

  appt.status = "cancelled";
  appt.cancelledBy = req.user.role;
  appt.slotKey = `${appt.slotKey}|cancelled|${appt._id}`; // frees the slot
  await appt.save();

  emitSlotsChanged(appt.doctor._id, appt.date);
  const other = isPatient ? appt.doctor.user : appt.patient;
  notifyUser(other, "appointment:cancelled", { date: appt.date, time: appt.time, by: req.user.role });
  res.json({ appointment: shape(await populateAll(Appointment.findById(appt._id))) });
});

// PATCH /api/appointments/:id/status   (doctor) { status: completed|no-show, notes }
export const updateStatus = asyncHandler(async (req, res) => {
  const { appt, isDoctor } = await loadForUpdate(req.params.id, req.user);
  if (!isDoctor) throw new HttpError(403, "Only the treating doctor can update this appointment");
  const { status, notes } = req.body;
  if (!["completed", "no-show"].includes(status)) throw new HttpError(400, "Status must be completed or no-show");
  if (appt.status !== "booked") throw new HttpError(400, `Appointment is already ${appt.status}`);
  if (!hasStarted(appt.date, appt.time)) throw new HttpError(400, "You can update an appointment once it has started");
  appt.status = status;
  if (notes !== undefined) appt.notes = notes;
  await appt.save();
  notifyUser(appt.patient, "appointment:updated", { date: appt.date, time: appt.time, status });
  res.json({ appointment: shape(await populateAll(Appointment.findById(appt._id))) });
});
