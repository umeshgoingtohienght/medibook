import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Please log in to continue");
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Session expired, please log in again");
  }
  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, "User no longer exists");
  req.user = user;
  next();
});

/** Role-based access control: authorize("doctor", "admin") */
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(new HttpError(403, "You do not have access to this action"));
  next();
};
