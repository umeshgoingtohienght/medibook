import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const ROLES = ["patient", "doctor", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 60 },
    email: {
      type: String, required: [true, "Email is required"], unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: { type: String, trim: true, match: [/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"] },
    password: { type: String, required: true, minlength: [6, "Password must be at least 6 characters"], select: false },
    role: { type: String, enum: ROLES, default: "patient" },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hash(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function compare(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, name: this.name, email: this.email, phone: this.phone, role: this.role };
};

export default mongoose.model("User", userSchema);
