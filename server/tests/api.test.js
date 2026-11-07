import http from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { io as ioClient } from "socket.io-client";
import request from "supertest";

process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
const { default: app } = await import("../src/app.js");
const { initSocket } = await import("../src/socket.js");
const { seed } = await import("../src/seed.js");
const { addDays, nowIST, weekday } = await import("../src/utils/slots.js");

let mongo;
let server;
let port;
const tokens = {};
let rohan; // demo doctor (Mon–Sat, 15-min slots, 09:00–13:00 & 17:00–20:00)
let bookDate;

const login = async (email, password) => (await request(app).post("/api/auth/login").send({ email, password })).body;
const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  // Use a real MongoDB-compatible server if provided, else an in-memory MongoDB
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri();
  }
  await mongoose.connect(uri, { dbName: `medibook_test_${Date.now()}` });
  await seed();

  tokens.patient = (await login("patient@medibook.dev", "Patient@123")).token;
  tokens.patient2 = (await login("diya@medibook.dev", "Patient@123")).token;
  tokens.patient3 = (await login("kabir@medibook.dev", "Patient@123")).token;
  const doc = await login("rohan.mehta@medibook.dev", "Doctor@123");
  tokens.doctor = doc.token;
  tokens.admin = (await login("admin@medibook.dev", "Admin@123")).token;
  rohan = doc.user.doctorId;

  bookDate = addDays(nowIST().date, 14);
  if (weekday(bookDate) === 0) bookDate = addDays(bookDate, 1); // Rohan doesn't work Sundays

  server = http.createServer(app);
  initSocket(server, ["*"]);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
  await new Promise((resolve) => server?.close(resolve));
});

describe("auth & roles", () => {
  it("returns role and doctor profile id on login", async () => {
    const body = await login("rohan.mehta@medibook.dev", "Doctor@123");
    expect(body.user.role).toBe("doctor");
    expect(body.user.approved).toBe(true);
  });

  it("rejects wrong passwords and unknown roles", async () => {
    expect((await request(app).post("/api/auth/login").send({ email: "patient@medibook.dev", password: "nope" })).status).toBe(401);
    const r = await request(app).post("/api/auth/register").send({ name: "X", email: "x@x.dev", password: "secret1", role: "admin" });
    expect(r.status).toBe(400);
  });

  it("registers doctors as pending (hidden from search)", async () => {
    const r = await request(app).post("/api/auth/register").send({
      name: "Dr. Test New", email: "new.doc@medibook.dev", password: "secret1", role: "doctor",
      doctor: { specialty: "Cardiologist", fee: 500, city: "Indore" },
    });
    expect(r.status).toBe(201);
    expect(r.body.user.approved).toBe(false);
    const list = await request(app).get("/api/doctors?search=Test New");
    expect(list.body.doctors).toHaveLength(0);
  });

  it("enforces role-based access", async () => {
    expect((await request(app).get("/api/admin/stats").set(auth("patient"))).status).toBe(403);
    expect((await request(app).post("/api/appointments").set(auth("doctor")).send({})).status).toBe(403);
    expect((await request(app).get("/api/appointments")).status).toBe(401);
  });
});

describe("doctor search", () => {
  it("filters by specialty and city", async () => {
    const r = await request(app).get("/api/doctors?specialty=Dentist&city=Jaipur");
    expect(r.body.doctors.map((d) => d.name)).toEqual(["Dr. Aditya Verma"]);
  });

  it("searches by doctor name", async () => {
    const r = await request(app).get("/api/doctors?search=ananya");
    expect(r.body.doctors[0].specialty).toBe("Cardiologist");
  });

  it("lists specialties and cities", async () => {
    const r = await request(app).get("/api/doctors/meta");
    expect(r.body.cities).toContain("Jaipur");
    expect(r.body.specialties).toContain("Pediatrician");
  });
});

describe("booking", () => {
  let apptId;

  it("shows open slots for a working day", async () => {
    const r = await request(app).get(`/api/doctors/${rohan}/slots?date=${bookDate}`);
    expect(r.status).toBe(200);
    expect(r.body.slots[0]).toMatchObject({ time: "09:00", available: true });
    expect(r.body.slots).toHaveLength(28); // 16 morning + 12 evening 15-min slots
  });

  it("rejects dates outside the booking window", async () => {
    const r = await request(app).get(`/api/doctors/${rohan}/slots?date=${addDays(nowIST().date, 45)}`);
    expect(r.status).toBe(400);
  });

  it("books a slot and marks it as taken", async () => {
    const r = await request(app).post("/api/appointments").set(auth("patient"))
      .send({ doctorId: rohan, date: bookDate, time: "09:00", reason: "Fever" });
    expect(r.status).toBe(201);
    expect(r.body.appointment.doctor.name).toBe("Dr. Rohan Mehta");
    apptId = r.body.appointment.id;
    const slots = await request(app).get(`/api/doctors/${rohan}/slots?date=${bookDate}`);
    expect(slots.body.slots.find((s) => s.time === "09:00").available).toBe(false);
  });

  it("prevents double booking of the same slot", async () => {
    const r = await request(app).post("/api/appointments").set(auth("patient2"))
      .send({ doctorId: rohan, date: bookDate, time: "09:00" });
    expect(r.status).toBe(409);
  });

  it("allows only one winner when two patients book simultaneously", async () => {
    const body = { doctorId: rohan, date: bookDate, time: "10:00" };
    const results = await Promise.all([
      request(app).post("/api/appointments").set(auth("patient2")).send(body),
      request(app).post("/api/appointments").set(auth("patient3")).send(body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("limits a patient to one active booking per doctor per day", async () => {
    const r = await request(app).post("/api/appointments").set(auth("patient"))
      .send({ doctorId: rohan, date: bookDate, time: "11:00" });
    expect(r.status).toBe(409);
  });

  it("rejects times the doctor does not work", async () => {
    const r = await request(app).post("/api/appointments").set(auth("patient"))
      .send({ doctorId: rohan, date: bookDate, time: "14:00" });
    expect(r.status).toBe(400);
  });

  it("does not let another patient cancel my appointment", async () => {
    const r = await request(app).patch(`/api/appointments/${apptId}/cancel`).set(auth("patient2"));
    expect(r.status).toBe(404);
  });

  it("doctor cannot complete a future appointment", async () => {
    const r = await request(app).patch(`/api/appointments/${apptId}/status`).set(auth("doctor")).send({ status: "completed" });
    expect(r.status).toBe(400);
  });

  it("doctor sees the booking in their schedule", async () => {
    const r = await request(app).get(`/api/appointments?date=${bookDate}`).set(auth("doctor"));
    expect(r.body.appointments.some((a) => a.id === apptId && a.patient.name === "Aarav Sharma")).toBe(true);
  });

  it("cancelling frees the slot for someone else", async () => {
    const c = await request(app).patch(`/api/appointments/${apptId}/cancel`).set(auth("patient"));
    expect(c.body.appointment.status).toBe("cancelled");
    let slots = await request(app).get(`/api/doctors/${rohan}/slots?date=${bookDate}`);
    expect(slots.body.slots.find((s) => s.time === "09:00").available).toBe(true);

    tokens.newPatient = (await request(app).post("/api/auth/register")
      .send({ name: "Neha Jain", email: "neha@medibook.dev", password: "secret1" })).body.token;
    const r = await request(app).post("/api/appointments").set(auth("newPatient"))
      .send({ doctorId: rohan, date: bookDate, time: "09:00" });
    expect(r.status).toBe(201);
    slots = await request(app).get(`/api/doctors/${rohan}/slots?date=${bookDate}`);
    expect(slots.body.slots.find((s) => s.time === "09:00").available).toBe(false);
  });
});

describe("real-time updates", () => {
  it("pushes slots:changed to everyone viewing the doctor", async () => {
    const client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise((resolve) => client.on("connect", resolve));
    client.emit("doctor:watch", String(rohan));
    await new Promise((r) => setTimeout(r, 100));
    const event = new Promise((resolve) => client.on("slots:changed", resolve));
    const nextDay = weekday(addDays(bookDate, 1)) === 0 ? addDays(bookDate, 2) : addDays(bookDate, 1);
    const booked = await request(app).post("/api/appointments").set(auth("patient"))
      .send({ doctorId: rohan, date: nextDay, time: "17:00" });
    expect(booked.status).toBe(201);
    const payload = await event;
    expect(payload.doctorId).toBe(String(rohan));
    client.close();
  });
});

describe("admin", () => {
  it("returns dashboard stats", async () => {
    const r = await request(app).get("/api/admin/stats").set(auth("admin"));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ patients: 5, doctors: 10 });
    expect(r.body.pendingDoctors).toBeGreaterThanOrEqual(2);
    expect(r.body.last7).toHaveLength(7);
  });

  it("approves a pending doctor so they appear in search", async () => {
    const pending = await request(app).get("/api/admin/doctors?status=pending").set(auth("admin"));
    const nikhil = pending.body.doctors.find((d) => d.name === "Dr. Nikhil Gupta");
    const r = await request(app).patch(`/api/admin/doctors/${nikhil.id}`).set(auth("admin")).send({ approved: true });
    expect(r.body.approved).toBe(true);
    const list = await request(app).get("/api/doctors?search=nikhil");
    expect(list.body.doctors).toHaveLength(1);
  });
});
