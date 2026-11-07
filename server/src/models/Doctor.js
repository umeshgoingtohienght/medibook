import mongoose from "mongoose";

export const SPECIALTIES = [
  "General Physician", "Cardiologist", "Dermatologist", "Pediatrician", "Gynecologist",
  "Orthopedic", "ENT Specialist", "Neurologist", "Psychiatrist", "Dentist",
];

const blockSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    specialty: { type: String, enum: SPECIALTIES, required: true },
    qualifications: { type: String, trim: true, maxlength: 120, default: "MBBS" },
    experienceYears: { type: Number, min: 0, max: 60, default: 1 },
    fee: { type: Number, min: 0, max: 10000, required: true },
    city: { type: String, trim: true, required: true },
    clinic: { type: String, trim: true, maxlength: 120, default: "" },
    bio: { type: String, trim: true, maxlength: 600, default: "" },
    languages: [{ type: String, trim: true }],
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    slotMinutes: { type: Number, enum: [10, 15, 20, 30, 45, 60], default: 30 },
    schedule: {
      type: [blockSchema],
      validate: {
        validator: (blocks) => blocks.every((b) => b.start < b.end),
        message: "Each schedule block must end after it starts",
      },
      default: [],
    },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

doctorSchema.index({ approved: 1, specialty: 1, city: 1 });

export default mongoose.model("Doctor", doctorSchema);
