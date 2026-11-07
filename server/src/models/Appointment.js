import mongoose from "mongoose";

export const STATUSES = ["booked", "completed", "cancelled", "no-show"];

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    time: { type: String, required: true }, // HH:MM (IST)
    reason: { type: String, trim: true, maxlength: 300, default: "" },
    status: { type: String, enum: STATUSES, default: "booked" },
    fee: { type: Number, required: true },
    cancelledBy: { type: String, enum: ["patient", "doctor", "admin", null], default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    /**
     * Double-booking guard: a UNIQUE index on `doctor|date|time` while the slot is held.
     * When an appointment is cancelled the key gets a suffix, freeing the slot again.
     * This works atomically even when two patients click "Book" at the same moment.
     */
    slotKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctor: 1, date: 1 });

export default mongoose.model("Appointment", appointmentSchema);
