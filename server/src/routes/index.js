import { Router } from "express";
import * as admin from "../controllers/adminController.js";
import * as appts from "../controllers/appointmentController.js";
import { login, me, register } from "../controllers/authController.js";
import * as doctors from "../controllers/doctorController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = Router();

// Auth
router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", protect, me);

// Doctors (public browsing; profile editing for doctors)
router.get("/doctors", doctors.listDoctors);
router.get("/doctors/meta", doctors.meta);
router.get("/doctors/me/profile", protect, authorize("doctor"), doctors.myProfile);
router.patch("/doctors/me/profile", protect, authorize("doctor"), doctors.updateMyProfile);
router.get("/doctors/:id", doctors.getDoctor);
router.get("/doctors/:id/slots", doctors.getSlots);
router.get("/doctors/:id/availability", doctors.getAvailability);

// Appointments
router.post("/appointments", protect, authorize("patient"), appts.book);
router.get("/appointments", protect, appts.list);
router.patch("/appointments/:id/cancel", protect, appts.cancel);
router.patch("/appointments/:id/status", protect, authorize("doctor"), appts.updateStatus);

// Admin
router.get("/admin/stats", protect, authorize("admin"), admin.stats);
router.get("/admin/doctors", protect, authorize("admin"), admin.listDoctors);
router.patch("/admin/doctors/:id", protect, authorize("admin"), admin.setApproval);

export default router;
