import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { addDays, nowIST } from "../utils/slots.js";

// GET /api/admin/stats
export const stats = asyncHandler(async (req, res) => {
  const today = nowIST().date;
  const weekStart = addDays(today, -6);
  const [patients, doctors, pending, statusCounts, todayCount, completed, recent] = await Promise.all([
    User.countDocuments({ role: "patient" }),
    Doctor.countDocuments({ approved: true }),
    Doctor.countDocuments({ approved: false }),
    Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Appointment.countDocuments({ date: today, status: { $ne: "cancelled" } }),
    Appointment.find({ status: "completed" }).select("fee"),
    Appointment.find({ date: { $gte: weekStart, $lte: today } }).select("date status"),
  ]);
  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, count: recent.filter((a) => a.date === date && a.status !== "cancelled").length };
  });
  res.json({
    patients, doctors, pendingDoctors: pending, todayAppointments: todayCount,
    appointments: { booked: 0, completed: 0, cancelled: 0, "no-show": 0, ...byStatus },
    revenue: completed.reduce((sum, a) => sum + a.fee, 0),
    last7,
  });
});

// GET /api/admin/doctors?status=pending|approved
export const listDoctors = asyncHandler(async (req, res) => {
  const approved = req.query.status !== "pending";
  const docs = await Doctor.find({ approved }).populate("user", "name email phone createdAt").sort({ createdAt: -1 });
  res.json({
    doctors: docs.map((d) => ({
      id: d._id, name: d.user?.name, email: d.user?.email, phone: d.user?.phone, specialty: d.specialty,
      qualifications: d.qualifications, experienceYears: d.experienceYears, city: d.city, fee: d.fee,
      approved: d.approved, registeredAt: d.createdAt,
    })),
  });
});

// PATCH /api/admin/doctors/:id  { approved: true|false }
export const setApproval = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid doctor id");
  if (typeof req.body.approved !== "boolean") throw new HttpError(400, "approved must be true or false");
  const doc = await Doctor.findByIdAndUpdate(req.params.id, { approved: req.body.approved }, { new: true });
  if (!doc) throw new HttpError(404, "Doctor not found");
  res.json({ id: doc._id, approved: doc.approved });
});
