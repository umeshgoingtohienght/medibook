import jwt from "jsonwebtoken";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { asyncHandler, HttpError } from "../utils/http.js";

const DEFAULT_SCHEDULE = [1, 2, 3, 4, 5, 6].flatMap((day) => [
  { day, start: "10:00", end: "13:00" },
  { day, start: "17:00", end: "20:00" },
]);

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

async function authPayload(user) {
  const profile = user.role === "doctor" ? await Doctor.findOne({ user: user._id }).select("_id approved") : null;
  return {
    token: sign(user._id),
    user: { ...user.toPublic(), doctorId: profile?._id ?? null, approved: profile?.approved ?? null },
  };
}

// POST /api/auth/register   (patients, or doctors who then wait for admin approval)
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = "patient", doctor } = req.body;
  if (!["patient", "doctor"].includes(role)) throw new HttpError(400, "Invalid role");

  const user = await User.create({ name, email, password, phone, role });
  if (role === "doctor") {
    try {
      await Doctor.create({
        user: user._id,
        specialty: doctor?.specialty,
        fee: doctor?.fee,
        city: doctor?.city,
        qualifications: doctor?.qualifications,
        experienceYears: doctor?.experienceYears,
        schedule: DEFAULT_SCHEDULE,
      });
    } catch (err) {
      await user.deleteOne(); // keep data consistent without a transaction
      throw err;
    }
  }
  res.status(201).json(await authPayload(user));
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, "Email and password are required");
  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) throw new HttpError(401, "Invalid email or password");
  res.json(await authPayload(user));
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const { user } = await authPayload(req.user);
  res.json({ user });
});
