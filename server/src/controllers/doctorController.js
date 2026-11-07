import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Doctor, { SPECIALTIES } from "../models/Doctor.js";
import User from "../models/User.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { addDays, bookingDateError, nowIST, slotsWithAvailability } from "../utils/slots.js";

const PUBLIC_FIELDS = "specialty qualifications experienceYears fee city clinic bio languages rating slotMinutes schedule approved user";
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shape = (doc) => ({
  id: doc._id,
  name: doc.user?.name,
  specialty: doc.specialty,
  qualifications: doc.qualifications,
  experienceYears: doc.experienceYears,
  fee: doc.fee,
  city: doc.city,
  clinic: doc.clinic,
  bio: doc.bio,
  languages: doc.languages,
  rating: doc.rating,
  slotMinutes: doc.slotMinutes,
  schedule: doc.schedule,
  approved: doc.approved,
});

// GET /api/doctors/meta
export const meta = asyncHandler(async (req, res) => {
  const cities = await Doctor.distinct("city", { approved: true });
  res.json({ specialties: SPECIALTIES, cities: cities.sort() });
});

// GET /api/doctors?specialty=&city=&search=&sort=fee|experience|rating
export const listDoctors = asyncHandler(async (req, res) => {
  const { specialty, city, search, sort = "rating" } = req.query;
  const filter = { approved: true };
  if (specialty && SPECIALTIES.includes(specialty)) filter.specialty = specialty;
  if (city) filter.city = city;
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), "i");
    const users = await User.find({ role: "doctor", name: rx }).select("_id");
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { specialty: rx }, { clinic: rx }];
  }
  const order = { fee: { fee: 1 }, experience: { experienceYears: -1 }, rating: { rating: -1 } }[sort] || { rating: -1 };
  const doctors = await Doctor.find(filter).select(PUBLIC_FIELDS).sort(order).limit(100).populate("user", "name");
  res.json({ doctors: doctors.map(shape) });
});

async function findDoctor(id, viewer) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid doctor id");
  const doc = await Doctor.findById(id).select(PUBLIC_FIELDS).populate("user", "name");
  const isOwner = viewer && doc && String(doc.user._id) === String(viewer._id);
  if (!doc || (!doc.approved && !isOwner && viewer?.role !== "admin")) throw new HttpError(404, "Doctor not found");
  return doc;
}

// GET /api/doctors/:id
export const getDoctor = asyncHandler(async (req, res) => {
  res.json({ doctor: shape(await findDoctor(req.params.id)) });
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
export const getSlots = asyncHandler(async (req, res) => {
  const date = req.query.date || nowIST().date;
  const err = bookingDateError(date);
  if (err) throw new HttpError(400, err);
  const doc = await findDoctor(req.params.id);
  const booked = await Appointment.find({ doctor: doc._id, date, status: "booked" }).select("time");
  const slots = slotsWithAvailability(doc.schedule, doc.slotMinutes, date, booked.map((a) => a.time));
  res.json({ date, slots, available: slots.filter((s) => s.available).length });
});

// GET /api/doctors/:id/availability?days=14 — count of free slots per day (for the date picker)
export const getAvailability = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 30);
  const doc = await findDoctor(req.params.id);
  const today = nowIST().date;
  const last = addDays(today, days - 1);
  const booked = await Appointment.find({ doctor: doc._id, status: "booked", date: { $gte: today, $lte: last } })
    .select("date time");
  const byDate = booked.reduce((m, a) => m.set(a.date, [...(m.get(a.date) || []), a.time]), new Map());
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i);
    const slots = slotsWithAvailability(doc.schedule, doc.slotMinutes, date, byDate.get(date) || []);
    out.push({ date, total: slots.length, available: slots.filter((s) => s.available).length });
  }
  res.json({ days: out });
});

// GET /api/doctors/me/profile   (doctor)
export const myProfile = asyncHandler(async (req, res) => {
  const doc = await Doctor.findOne({ user: req.user._id }).populate("user", "name");
  if (!doc) throw new HttpError(404, "Doctor profile not found");
  res.json({ doctor: shape(doc) });
});

// PATCH /api/doctors/me/profile   (doctor)
export const updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = ["qualifications", "experienceYears", "fee", "city", "clinic", "bio", "languages", "slotMinutes", "schedule"];
  const doc = await Doctor.findOne({ user: req.user._id });
  if (!doc) throw new HttpError(404, "Doctor profile not found");
  for (const key of allowed) if (key in req.body) doc[key] = req.body[key];
  await doc.save();
  await doc.populate("user", "name");
  res.json({ doctor: shape(doc) });
});
