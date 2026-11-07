/**
 * Seeds demo data: 1 admin, 10 approved doctors, 2 pending doctors, 4 patients and appointments.
 * Usage: npm run seed      (⚠️ wipes existing MediBook collections)
 */
import "dotenv/config";
import mongoose from "mongoose";
import Appointment from "./models/Appointment.js";
import Doctor from "./models/Doctor.js";
import User from "./models/User.js";
import { addDays, generateSlots, nowIST, slotKey, weekday } from "./utils/slots.js";

const weekdays = (days, blocks) => days.flatMap((day) => blocks.map(([start, end]) => ({ day, start, end })));
const MON_SAT = [1, 2, 3, 4, 5, 6];

const DOCTORS = [
  ["Dr. Rohan Mehta", "General Physician", "Jaipur", 8, 400, "MBBS, MD (Medicine)", "City Care Clinic, Malviya Nagar", ["Hindi", "English"], 4.7, 15, weekdays(MON_SAT, [["09:00", "13:00"], ["17:00", "20:00"]])],
  ["Dr. Ananya Iyer", "Cardiologist", "Bengaluru", 14, 900, "MBBS, MD, DM (Cardiology)", "HeartWell Centre, Indiranagar", ["English", "Kannada", "Tamil"], 4.9, 30, weekdays([1, 2, 3, 4, 5], [["10:00", "14:00"]])],
  ["Dr. Kavya Nair", "Dermatologist", "Mumbai", 10, 700, "MBBS, MD (Dermatology)", "SkinFirst Clinic, Bandra", ["English", "Hindi", "Malayalam"], 4.8, 20, weekdays([1, 3, 5, 6], [["11:00", "15:00"], ["18:00", "20:00"]])],
  ["Dr. Arjun Singh", "Orthopedic", "Delhi", 12, 800, "MBBS, MS (Orthopaedics)", "Bone & Joint Hospital, Saket", ["Hindi", "English", "Punjabi"], 4.6, 20, weekdays(MON_SAT, [["10:00", "13:00"]])],
  ["Dr. Meera Joshi", "Pediatrician", "Pune", 9, 600, "MBBS, DCH, DNB (Paediatrics)", "Little Steps Child Clinic, Kothrud", ["Marathi", "Hindi", "English"], 4.9, 15, weekdays(MON_SAT, [["09:30", "12:30"], ["16:00", "19:00"]])],
  ["Dr. Farhan Qureshi", "ENT Specialist", "Hyderabad", 7, 500, "MBBS, MS (ENT)", "ClearSound ENT, Banjara Hills", ["Urdu", "Hindi", "English", "Telugu"], 4.5, 20, weekdays([1, 2, 4, 5, 6], [["10:00", "14:00"]])],
  ["Dr. Sneha Reddy", "Gynecologist", "Hyderabad", 15, 1000, "MBBS, MS (OBG), FRCOG", "Motherhood Women's Clinic, Jubilee Hills", ["Telugu", "English", "Hindi"], 4.8, 30, weekdays([1, 2, 3, 4, 5], [["10:00", "13:00"], ["17:00", "19:00"]])],
  ["Dr. Vikram Rao", "Neurologist", "Chennai", 18, 1200, "MBBS, MD, DM (Neurology)", "NeuroCare Institute, Adyar", ["Tamil", "English"], 4.9, 30, weekdays([1, 3, 5], [["09:00", "13:00"]])],
  ["Dr. Priya Kapoor", "Psychiatrist", "Delhi", 11, 1100, "MBBS, MD (Psychiatry)", "MindSpace Clinic, Hauz Khas", ["Hindi", "English"], 4.7, 45, weekdays([2, 3, 4, 5, 6], [["11:00", "17:00"]])],
  ["Dr. Aditya Verma", "Dentist", "Jaipur", 6, 350, "BDS, MDS (Endodontics)", "SmileCraft Dental, Vaishali Nagar", ["Hindi", "English"], 4.6, 30, weekdays(MON_SAT, [["10:00", "14:00"], ["17:00", "20:30"]])],
];
const PENDING = [
  ["Dr. Nikhil Gupta", "Dermatologist", "Jaipur", 4, 500, "MBBS, DVD"],
  ["Dr. Isha Malhotra", "Pediatrician", "Delhi", 5, 650, "MBBS, MD (Paediatrics)"],
];
const PATIENTS = [
  ["Aarav Sharma", "patient@medibook.dev", "9876543210"],
  ["Diya Patel", "diya@medibook.dev", "9812345678"],
  ["Kabir Khan", "kabir@medibook.dev", "9898989898"],
  ["Ishita Bose", "ishita@medibook.dev", "9123456780"],
];
const REASONS = ["Fever and body ache", "Follow-up visit", "Routine check-up", "Persistent cough", "Back pain",
  "Skin rash", "Headache for a week", "Blood test review", "Allergy consultation", "Knee pain after running"];

const slug = (name) => name.replace("Dr. ", "").toLowerCase().replace(/\s+/g, ".");

export async function seed() {
  await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Appointment.deleteMany({})]);

  await User.create({ name: "MediBook Admin", email: "admin@medibook.dev", password: "Admin@123", role: "admin" });
  const patients = [];
  for (const [name, email, phone] of PATIENTS) {
    patients.push(await User.create({ name, email, phone, password: "Patient@123", role: "patient" }));
  }

  const doctors = [];
  for (const [name, specialty, city, exp, fee, quals, clinic, languages, rating, slotMinutes, schedule] of DOCTORS) {
    const user = await User.create({ name, email: `${slug(name)}@medibook.dev`, password: "Doctor@123", role: "doctor" });
    doctors.push(await Doctor.create({
      user: user._id, specialty, city, experienceYears: exp, fee, qualifications: quals, clinic, languages,
      rating, slotMinutes, schedule, approved: true,
      bio: `${name} is a ${specialty.toLowerCase()} in ${city} with ${exp} years of experience, known for clear explanations and evidence-based care.`,
    }));
  }
  for (const [name, specialty, city, exp, fee, quals] of PENDING) {
    const user = await User.create({ name, email: `${slug(name)}@medibook.dev`, password: "Doctor@123", role: "doctor" });
    await Doctor.create({ user: user._id, specialty, city, experienceYears: exp, fee, qualifications: quals,
      schedule: weekdays(MON_SAT, [["10:00", "13:00"]]), approved: false });
  }

  // Appointments: completed history + upcoming bookings (more for Dr. Rohan Mehta, the demo doctor)
  const today = nowIST().date;
  let n = 0;
  const appts = [];
  for (let offset = -12; offset <= 10; offset += 1) {
    const date = addDays(today, offset);
    doctors.forEach((doc, di) => {
      const slots = generateSlots(doc.schedule, doc.slotMinutes, date);
      if (!slots.length) return;
      const count = di === 0 ? 5 : (offset + di) % 3 === 0 ? 1 : 0;
      for (let k = 0; k < count && k < slots.length; k += 1) {
        const time = slots[(k * 3 + di) % slots.length];
        const patient = patients[(n += 1) % patients.length];
        const past = offset < 0;
        const status = past ? (n % 9 === 0 ? "no-show" : n % 7 === 0 ? "cancelled" : "completed") : n % 11 === 0 ? "cancelled" : "booked";
        const key = slotKey(doc._id, date, time);
        if (appts.some((a) => a.slotKey === key)) continue;
        appts.push({
          patient: patient._id, doctor: doc._id, date, time, fee: doc.fee, reason: REASONS[n % REASONS.length], status,
          cancelledBy: status === "cancelled" ? "patient" : null,
          slotKey: status === "cancelled" ? `${key}|cancelled|seed${n}` : key,
        });
      }
    });
  }
  await Appointment.insertMany(appts);
  return { doctors: doctors.length + PENDING.length, patients: patients.length, appointments: appts.length, today, weekday: weekday(today) };
}

if (process.argv[1]?.endsWith("seed.js")) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("🌱 Seeded:", await seed());
  console.log("\nDemo logins (password):\n  admin@medibook.dev (Admin@123)\n  rohan.mehta@medibook.dev (Doctor@123)\n  patient@medibook.dev (Patient@123)");
  await mongoose.disconnect();
}
