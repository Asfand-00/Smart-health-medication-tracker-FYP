/**
 * END-TO-END API TESTS — tests/api.test.js
 * ==========================================
 * Exercises every module of the Smart Medication Health Tracker against a
 * RUNNING backend (default http://localhost:5000) and its MongoDB.
 *
 *   npm test                        # expects the server on :5000
 *   API_URL=http://host:5000 npm test
 *
 * The suite creates its own users (unique per run), so it can be re-run.
 * Start the server with DISABLE_RATE_LIMIT=true and EXPOSE_RESET_CODE=true
 * (both are set in .env.example for development).
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { io: socketClient } = require("socket.io-client");

const API = (process.env.API_URL || "http://localhost:5000").replace(/\/$/, "");
const RUN = Date.now().toString(36);
const PASSWORD = "Passw0rd1";

// ── tiny harness ──────────────────────────────────────────────────────
const results = [];
let current = "";
const test = async (name, fn) => {
  current = name;
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`  ✖ ${name}\n      ${err.message}`);
  }
};
const section = (title) => console.log(`\n${title}`);
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || "assertion failed");
};
const eq = (a, b, msg) => assert(a === b, `${msg || "expected equal"}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);

const api = async (method, path, { token, body, form, raw } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}/api${path}`, { method, headers, body: payload });
  if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
};
const expectStatus = (r, status, label) => {
  if (r.status !== status) throw new Error(`${label || "request"} → ${r.status} (expected ${status}): ${JSON.stringify(r.json?.message || r.json).slice(0, 300)}`);
  return r.json;
};
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── shared state ──────────────────────────────────────────────────────
const U = {}; // users: { patient: { token, id, email }, ... }
const S = {}; // ids created along the way

const register = async (role, label) => {
  const email = `${role}.${label || ""}${RUN}@example.com`.replace("..", ".");
  const r = await api("POST", "/auth/register", { body: { firstName: role[0].toUpperCase() + role.slice(1), lastName: `Test${RUN.slice(-3)}`, email, password: PASSWORD, role, phone: "+923001234567" } });
  const data = expectStatus(r, 201, `register ${role}`);
  return { token: data.data.token, id: data.data.user._id, email };
};

(async () => {
  const health = await api("GET", "/health");
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${API}. Start it first (npm run dev).`);
    process.exit(1);
  }

  // Admin is created directly in the database (admin self-registration is blocked by design)
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, family: 4 });
  const User = require("../src/features/user/user.model");
  const adminEmail = `admin.${RUN}@example.com`;
  await User.create({ firstName: "Sys", lastName: "Admin", email: adminEmail, password: PASSWORD, role: "admin" });

  // ═══════════════════════════════════════════════════════════════════
  section("1. Authentication & User Management");
  await test("register patient, caregiver, doctor", async () => {
    U.patient = await register("patient");
    U.caregiver = await register("caregiver");
    U.doctor = await register("doctor");
    U.doctor2 = await register("doctor", "two.");
    assert(U.patient.token && U.caregiver.token && U.doctor.token, "tokens");
  });
  await test("admin self-registration is blocked (403)", async () => {
    const r = await api("POST", "/auth/register", { body: { firstName: "Evil", lastName: "Admin", email: `evil${RUN}@example.com`, password: PASSWORD, role: "admin" } });
    eq(r.status, 403, "status");
  });
  await test("duplicate email rejected (400) and weak password rejected (422)", async () => {
    const dup = await api("POST", "/auth/register", { body: { firstName: "Dup", lastName: "User", email: U.patient.email, password: PASSWORD, role: "patient" } });
    eq(dup.status, 400, "duplicate");
    const weak = await api("POST", "/auth/register", { body: { firstName: "Weak", lastName: "User", email: `weak${RUN}@example.com`, password: "abc", role: "patient" } });
    eq(weak.status, 422, "weak password");
  });
  await test("login succeeds and GET /auth/me returns the user", async () => {
    const r = await api("POST", "/auth/login", { body: { email: U.patient.email, password: PASSWORD } });
    const data = expectStatus(r, 200, "login");
    U.patient.token = data.data.token;
    const me = await api("GET", "/auth/me", { token: U.patient.token });
    eq(expectStatus(me, 200, "me").data.user.email, U.patient.email, "email");
    U.admin = { email: adminEmail };
    const a = await api("POST", "/auth/login", { body: { email: adminEmail, password: PASSWORD } });
    U.admin.token = expectStatus(a, 200, "admin login").data.token;
    U.admin.id = a.json.data.user._id;
  });
  await test("5 wrong passwords lock the account (423) and admin can unlock it", async () => {
    U.lockme = await register("patient", "lock.");
    for (let i = 0; i < 5; i++) {
      const r = await api("POST", "/auth/login", { body: { email: U.lockme.email, password: "wrong0000" } });
      eq(r.status, 401, `attempt ${i + 1}`);
    }
    const locked = await api("POST", "/auth/login", { body: { email: U.lockme.email, password: PASSWORD } });
    eq(locked.status, 423, "locked");
    const unlock = await api("POST", `/admin/users/${U.lockme.id}/unlock`, { token: U.admin.token });
    expectStatus(unlock, 200, "unlock");
    const ok = await api("POST", "/auth/login", { body: { email: U.lockme.email, password: PASSWORD } });
    expectStatus(ok, 200, "login after unlock");
  });
  await test("change password: wrong current → 400, success invalidates the old token", async () => {
    const bad = await api("PUT", "/auth/change-password", { token: U.lockme.token, body: { currentPassword: "nope1234", newPassword: "NewPass123" } });
    eq(bad.status, 400, "wrong current");
    const old = U.lockme.token;
    const r = await api("PUT", "/auth/change-password", { token: old, body: { currentPassword: PASSWORD, newPassword: "NewPass123" } });
    const data = expectStatus(r, 200, "change");
    const stale = await api("GET", "/auth/me", { token: old });
    eq(stale.status, 401, "old token rejected");
    const fresh = await api("GET", "/auth/me", { token: data.data.token });
    eq(fresh.status, 200, "new token works");
    U.lockme.token = data.data.token;
  });
  await test("account recovery: forgot-password issues a code, wrong code → 400, correct code resets", async () => {
    const f = await api("POST", "/auth/forgot-password", { body: { email: U.lockme.email } });
    const data = expectStatus(f, 200, "forgot");
    assert(data.data.devCode && data.data.devCode.length === 6, "dev code returned in development");
    const bad = await api("POST", "/auth/reset-password", { body: { email: U.lockme.email, code: "000000", newPassword: "Reset1234" } });
    eq(bad.status, 400, "wrong code");
    const good = await api("POST", "/auth/reset-password", { body: { email: U.lockme.email, code: data.data.devCode, newPassword: "Reset1234" } });
    expectStatus(good, 200, "reset");
    const login = await api("POST", "/auth/login", { body: { email: U.lockme.email, password: "Reset1234" } });
    U.lockme.token = expectStatus(login, 200, "login with reset password").data.token;
    const unknown = await api("POST", "/auth/forgot-password", { body: { email: `nobody${RUN}@example.com` } });
    eq(unknown.status, 200, "unknown email still 200 (no enumeration)");
    assert(!unknown.json.data.devCode, "no code for unknown email");
  });
  await test("recovery options, privacy consent and data export", async () => {
    const r = await api("PUT", "/user/recovery", { token: U.patient.token, body: { recoveryEmail: `backup.${RUN}@example.com` } });
    eq(expectStatus(r, 200, "recovery").data.user.recoveryEmail, `backup.${RUN}@example.com`, "recovery email");
    const bad = await api("PUT", "/user/recovery", { token: U.patient.token, body: { recoveryEmail: "not-an-email" } });
    eq(bad.status, 400, "invalid recovery email");
    expectStatus(await api("POST", "/user/consent", { token: U.patient.token }), 200, "consent");
    const ex = await api("GET", "/user/export", { token: U.patient.token });
    const data = expectStatus(ex, 200, "export");
    assert(data.data.account.email === U.patient.email && Array.isArray(data.data.medications), "export shape");
  });
  await test("logout everywhere revokes every session", async () => {
    const r = await api("POST", "/auth/logout", { token: U.lockme.token, body: { everywhere: true } });
    expectStatus(r, 200, "logout");
    eq((await api("GET", "/auth/me", { token: U.lockme.token })).status, 401, "revoked");
    const login = await api("POST", "/auth/login", { body: { email: U.lockme.email, password: "Reset1234" } });
    U.lockme.token = expectStatus(login, 200, "re-login").data.token;
  });
  await test("own activity trail (GET /audit/me) records the login", async () => {
    const r = await api("GET", "/audit/me", { token: U.patient.token });
    const data = expectStatus(r, 200, "audit me");
    assert(data.data.logs.some((l) => l.action === "auth.login"), "login audited");
  });
  await test("no token → 401, wrong role → 403", async () => {
    eq((await api("GET", "/medication")).status, 401, "no token");
    eq((await api("GET", "/medication", { token: U.caregiver.token })).status, 403, "caregiver on patient route");
    eq((await api("GET", "/admin/dashboard", { token: U.patient.token })).status, 403, "patient on admin route");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("2. Patient Profile Management");
  await test("create and read the medical profile", async () => {
    const r = await api("PUT", "/patient/profile", {
      token: U.patient.token,
      body: { dateOfBirth: "1950-05-20", gender: "female", bloodGroup: "O+", height: 160, weight: 62, medicalHistory: { chronicDiseases: ["Alzheimer's disease", "Hypertension"], allergies: ["Penicillin"], pastSurgeries: [] }, emergencyContact: { name: "Sara", relation: "Daughter", phone: "+923001112222" } },
    });
    expectStatus(r, 200, "upsert");
    const g = await api("GET", "/patient/profile", { token: U.patient.token });
    eq(expectStatus(g, 200, "get").data.bloodGroup, "O+", "blood group");
  });
  await test("health condition tracking: add, update with change log, list, delete", async () => {
    const add = await api("POST", "/patient/conditions", { token: U.patient.token, body: { name: "Hypertension", status: "active", severity: "moderate", diagnosedOn: "2020-01-15", notes: "On amlodipine" } });
    const cond = expectStatus(add, 201, "add").data;
    S.conditionId = cond._id;
    const upd = await api("PUT", `/patient/conditions/${cond._id}`, { token: U.patient.token, body: { status: "managed", note: "BP stable for 3 months" } });
    const updated = expectStatus(upd, 200, "update").data;
    eq(updated.status, "managed", "status");
    assert(updated.updates.length === 2, "change log has two entries");
    const list = await api("GET", "/patient/conditions", { token: U.patient.token });
    assert(expectStatus(list, 200, "list").data.length === 1, "one condition");
    const add2 = await api("POST", "/patient/conditions", { token: U.patient.token, body: { name: "Insomnia" } });
    const c2 = expectStatus(add2, 201, "add2").data;
    expectStatus(await api("DELETE", `/patient/conditions/${c2._id}`, { token: U.patient.token }), 200, "delete");
  });
  await test("caregiver assignment & linking (request → accept → my team)", async () => {
    const req = await api("POST", "/caregiver/request", { token: U.patient.token, body: { caregiverId: U.caregiver.id } });
    const request = expectStatus(req, 201, "request").data;
    const incoming = await api("GET", "/caregiver/requests", { token: U.caregiver.token });
    assert(expectStatus(incoming, 200, "incoming").data.some((r) => r._id === request._id), "request visible");
    expectStatus(await api("POST", `/caregiver/requests/${request._id}/handle`, { token: U.caregiver.token, body: { status: "accepted" } }), 200, "accept");
    const team = await api("GET", "/caregiver/my-team", { token: U.patient.token });
    assert(expectStatus(team, 200, "team").data.some((c) => c._id === U.caregiver.id), "caregiver in team");
  });
  await test("care-team profile access: assigned caregiver 200, unlinked doctor 403", async () => {
    const cg = await api("GET", `/patient/${U.patient.id}/profile`, { token: U.caregiver.token });
    eq(expectStatus(cg, 200, "caregiver").data.profile.bloodGroup, "O+", "profile");
    eq((await api("GET", `/patient/${U.patient.id}/profile`, { token: U.doctor2.token })).status, 403, "unlinked doctor");
    const cgCond = await api("GET", `/patient/${U.patient.id}/conditions`, { token: U.caregiver.token });
    expectStatus(cgCond, 200, "caregiver conditions");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("3. Medication Management");
  await test("add, list, update, log dose, history, stats", async () => {
    const add = await api("POST", "/medication", { token: U.patient.token, body: { medicineName: "Donepezil", dosage: "10mg", frequency: "daily", timeOfDay: ["Morning", "Night"], startDate: dateKey(daysAgo(20)), description: "Memory", notes: "At bedtime" } });
    S.med1 = expectStatus(add, 201, "add").data._id;
    const add2 = await api("POST", "/medication", { token: U.patient.token, body: { medicineName: "Warfarin", dosage: "5mg", frequency: "daily", timeOfDay: ["Evening"], startDate: dateKey(daysAgo(20)) } });
    S.med2 = expectStatus(add2, 201, "add2").data._id;
    const list = await api("GET", "/medication", { token: U.patient.token });
    assert(expectStatus(list, 200, "list").data.length >= 2, "two meds");
    const upd = await api("PUT", `/medication/${S.med2}`, { token: U.patient.token, body: { dosage: "2.5mg" } });
    eq(expectStatus(upd, 200, "update").data.dosage, "2.5mg", "dosage");
    const log = await api("POST", `/medication/${S.med1}/log`, { token: U.patient.token, body: { date: new Date().toISOString(), timeOfDay: "Night", status: "taken" } });
    expectStatus(log, 201, "log");
    const hist = await api("GET", "/medication/history", { token: U.patient.token });
    assert(expectStatus(hist, 200, "history").data.length >= 1, "history entry");
    const stats = await api("GET", "/medication/stats", { token: U.patient.token });
    assert(expectStatus(stats, 200, "stats").data.today.taken >= 1, "today taken");
  });
  await test("calendar-based medication view (month grid)", async () => {
    const r = await api("GET", `/medication/calendar?month=${dateKey(new Date()).slice(0, 7)}`, { token: U.patient.token });
    const cal = expectStatus(r, 200, "calendar").data;
    assert(cal.days.length >= 28 && cal.medications.length >= 2, "days & meds");
    const today = cal.days.find((d) => d.isToday);
    assert(today && today.total >= 3, "today has 3 scheduled slots");
    assert(today.items.some((i) => i.status === "taken"), "today shows the taken dose");
    const cg = await api("GET", `/medication/calendar?patientId=${U.patient.id}`, { token: U.caregiver.token });
    expectStatus(cg, 200, "caregiver calendar");
  });
  await test("drug information: search, detail, unknown → 404, interaction check", async () => {
    const s = await api("GET", "/medication/drug-info?q=done", { token: U.patient.token });
    assert(expectStatus(s, 200, "search").data.some((d) => d.name === "Donepezil"), "search finds Donepezil");
    const d = await api("GET", "/medication/drug-info/aricept", { token: U.patient.token });
    eq(expectStatus(d, 200, "alias").data.name, "Donepezil", "alias resolves");
    eq((await api("GET", "/medication/drug-info/unobtainium", { token: U.patient.token })).status, 404, "unknown");
    const i = await api("GET", "/medication/interactions", { token: U.patient.token });
    const inter = expectStatus(i, 200, "interactions").data;
    assert(inter.recognised.includes("Donepezil") && inter.recognised.includes("Warfarin"), "recognised");
    const named = await api("GET", "/medication/interactions?names=Warfarin,Aspirin", { token: U.caregiver.token });
    assert(expectStatus(named, 200, "named").data.warnings.length >= 1, "warfarin+aspirin flagged");
  });
  await test("medication templates (FR12): list globals, apply one, create & delete own", async () => {
    const list = await api("GET", "/medication-templates", { token: U.patient.token });
    const templates = expectStatus(list, 200, "list").data;
    assert(templates.filter((t) => t.isGlobal).length >= 5, "global templates seeded");
    const vit = templates.find((t) => t.name.startsWith("Vitamin"));
    const apply = await api("POST", `/medication-templates/${vit._id}/apply`, { token: U.patient.token });
    const applied = expectStatus(apply, 200, "apply").data;
    eq(applied.created.length, 2, "two meds created");
    const again = await api("POST", `/medication-templates/${vit._id}/apply`, { token: U.patient.token });
    eq(expectStatus(again, 200, "apply again").data.created.length, 0, "no duplicates");
    const own = await api("POST", "/medication-templates", { token: U.patient.token, body: { name: "My evening set", items: [{ medicineName: "Melatonin", dosage: "2mg", timeOfDay: ["Night"] }] } });
    const t = expectStatus(own, 201, "create").data;
    assert(!t.isGlobal, "patient templates are private");
    expectStatus(await api("DELETE", `/medication-templates/${t._id}`, { token: U.patient.token }), 200, "delete");
    for (const m of applied.created) await api("DELETE", `/medication/${m._id}`, { token: U.patient.token });
  });
  await test("caregiver patient records now return the medication list (bug fix)", async () => {
    const r = await api("GET", `/caregiver/patients/${U.patient.id}/records`, { token: U.caregiver.token });
    assert(expectStatus(r, 200, "records").data.medications.length >= 2, "medications listed");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("7. Doctor linking (needed by several modules)");
  await test("patient finds a doctor and sends a request; doctor accepts; both sides see the link", async () => {
    const avail = await api("GET", "/doctor/available", { token: U.patient.token });
    assert(expectStatus(avail, 200, "available").data.some((d) => d._id === U.doctor.id), "doctor listed");
    const req = await api("POST", "/doctor/request", { token: U.patient.token, body: { doctorId: U.doctor.id, message: "Please supervise my plan" } });
    const link = expectStatus(req, 201, "request").data;
    const incoming = await api("GET", "/doctor/requests", { token: U.doctor.token });
    assert(expectStatus(incoming, 200, "requests").data.some((l) => l._id === link._id), "visible to doctor");
    expectStatus(await api("POST", `/doctor/requests/${link._id}/handle`, { token: U.doctor.token, body: { status: "accepted" } }), 200, "accept");
    const mine = await api("GET", "/doctor/my-doctor", { token: U.patient.token });
    assert(expectStatus(mine, 200, "my-doctor").data.some((d) => d._id === U.doctor.id), "patient sees doctor");
    const patients = await api("GET", "/doctor/patients", { token: U.doctor.token });
    const p = expectStatus(patients, 200, "patients").data.find((x) => x.patientId === U.patient.id);
    assert(p && typeof p.todayAdherence === "number" && p.riskLevel, "patient row with adherence + risk");
  });
  await test("doctor dashboard, patient overview, and access denied for the unlinked doctor", async () => {
    const dash = await api("GET", "/doctor/dashboard", { token: U.doctor.token });
    eq(expectStatus(dash, 200, "dashboard").data.totalPatients, 1, "one patient");
    const ov = await api("GET", `/doctor/patients/${U.patient.id}/overview`, { token: U.doctor.token });
    const data = expectStatus(ov, 200, "overview").data;
    assert(data.user && data.medications.length >= 2 && data.today && data.risk, "overview shape");
    eq((await api("GET", `/doctor/patients/${U.patient.id}/overview`, { token: U.doctor2.token })).status, 403, "unlinked doctor");
  });
  await test("doctor notes CRUD; patient sees non-confidential notes only", async () => {
    const n1 = await api("POST", "/doctor/notes", { token: U.doctor.token, body: { patientUserId: U.patient.id, title: "Follow-up", content: "Review in 4 weeks", noteType: "follow_up", followUpDate: dateKey(new Date(Date.now() + 28 * 86400000)) } });
    const note = expectStatus(n1, 201, "note").data;
    const n2 = await api("POST", "/doctor/notes", { token: U.doctor.token, body: { patientUserId: U.patient.id, title: "Private", content: "Internal", isConfidential: true } });
    expectStatus(n2, 201, "confidential note");
    const asPatient = await api("GET", `/doctor/notes/${U.patient.id}`, { token: U.patient.token });
    const notes = expectStatus(asPatient, 200, "patient notes").data;
    assert(notes.some((n) => n._id === note._id) && !notes.some((n) => n.title === "Private"), "confidential hidden");
    expectStatus(await api("PUT", `/doctor/notes/${note._id}`, { token: U.doctor.token, body: { content: "Review in 6 weeks" } }), 200, "update");
    expectStatus(await api("DELETE", `/doctor/notes/${n2.json.data._id}`, { token: U.doctor.token }), 200, "delete");
  });
  await test("doctor manages an assigned patient's medications", async () => {
    const add = await api("POST", `/doctor/patients/${U.patient.id}/medications`, { token: U.doctor.token, body: { medicineName: "Memantine", dosage: "10mg", frequency: "daily", timeOfDay: ["Morning", "Evening"], startDate: dateKey(new Date()) } });
    S.medDoctor = expectStatus(add, 201, "add").data._id;
    const list = await api("GET", `/doctor/patients/${U.patient.id}/medications`, { token: U.doctor.token });
    assert(expectStatus(list, 200, "list").data.some((m) => m._id === S.medDoctor), "listed");
    expectStatus(await api("PUT", `/doctor/patients/${U.patient.id}/medications/${S.medDoctor}`, { token: U.doctor.token, body: { dosage: "5mg" } }), 200, "update");
    eq((await api("POST", `/doctor/patients/${U.patient.id}/medications`, { token: U.doctor2.token, body: { medicineName: "X", dosage: "1", timeOfDay: ["Morning"] } })).status, 403, "unlinked doctor");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("3b. Medication plan approval (FR8 / FR9)");
  await test("patient proposes a new medication to the caregiver; caregiver approves → medication created", async () => {
    const req = await api("POST", "/medication-plans/requests", { token: U.patient.token, body: { type: "add", reviewerId: U.caregiver.id, proposed: { medicineName: "Vitamin D3", dosage: "1000 IU", frequency: "daily", timeOfDay: ["Morning"] }, reason: "Doctor suggested it" } });
    const r = expectStatus(req, 201, "request").data;
    const pending = await api("GET", "/medication-plans/pending", { token: U.caregiver.token });
    assert(expectStatus(pending, 200, "pending").data.some((x) => x._id === r._id), "pending for caregiver");
    const review = await api("POST", `/medication-plans/requests/${r._id}/review`, { token: U.caregiver.token, body: { status: "approved", note: "Fine" } });
    const reviewed = expectStatus(review, 200, "approve").data;
    eq(reviewed.status, "approved", "status");
    const meds = await api("GET", "/medication", { token: U.patient.token });
    const created = expectStatus(meds, 200, "meds").data.find((m) => m.medicineName === "Vitamin D3");
    assert(created, "medication created on approval");
    S.medVitD = created._id;
  });
  await test("stop request to the doctor is rejected; cancel works; reviewer must be linked", async () => {
    const req = await api("POST", "/medication-plans/requests", { token: U.patient.token, body: { type: "stop", reviewerId: U.doctor.id, medicationId: S.med2, reason: "Side effects" } });
    const r = expectStatus(req, 201, "stop request").data;
    const rej = await api("POST", `/medication-plans/requests/${r._id}/review`, { token: U.doctor.token, body: { status: "rejected", note: "Keep taking it" } });
    eq(expectStatus(rej, 200, "reject").data.status, "rejected", "rejected");
    const req2 = await api("POST", "/medication-plans/requests", { token: U.patient.token, body: { type: "update", reviewerId: U.caregiver.id, medicationId: S.med2, proposed: { dosage: "1mg" } } });
    const r2 = expectStatus(req2, 201, "update request").data;
    expectStatus(await api("DELETE", `/medication-plans/requests/${r2._id}`, { token: U.patient.token }), 200, "cancel");
    const bad = await api("POST", "/medication-plans/requests", { token: U.patient.token, body: { type: "add", reviewerId: U.doctor2.id, proposed: { medicineName: "X", dosage: "1", timeOfDay: ["Morning"] } } });
    eq(bad.status, 400, "unlinked reviewer");
    const mine = await api("GET", "/medication-plans/requests", { token: U.patient.token });
    assert(expectStatus(mine, 200, "mine").data.length >= 3, "history of requests");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("4. Intelligent Reminder System");
  await test("reminder preferences: set Morning to 08:30 and generated reminders use it", async () => {
    const pref = await api("PUT", "/smart-reminders/preferences", { token: U.patient.token, body: { reminderTimes: { Morning: "08:30" }, reminderLeadMinutes: 10, voiceAlerts: true } });
    eq(expectStatus(pref, 200, "prefs").data.reminderTimes.Morning, "08:30", "saved");
    const bad = await api("PUT", "/smart-reminders/preferences", { token: U.patient.token, body: { reminderTimes: { Morning: "8am" } } });
    eq(bad.status, 400, "invalid time");
    const gen = await api("POST", "/smart-reminders/generate", { token: U.patient.token });
    expectStatus(gen, 200, "generate");
    const up = await api("GET", "/smart-reminders/upcoming", { token: U.patient.token });
    const reminders = expectStatus(up, 200, "upcoming").data;
    const morning = reminders.find((r) => /morning/i.test(r.title));
    assert(morning, "morning reminder exists");
    const t = new Date(morning.scheduledTime);
    eq(`${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`, "8:30", "scheduled at 08:30");
    S.reminder = reminders.find((r) => /night/i.test(r.title)) || reminders[0];
  });
  await test("one-tap acknowledge (taken) logs adherence and history; suggestions endpoint answers", async () => {
    const ack = await api("POST", `/smart-reminders/acknowledge/${S.reminder._id}`, { token: U.patient.token, body: { status: "taken" } });
    const data = expectStatus(ack, 200, "ack").data;
    eq(data.log.status, "taken", "adherence log");
    const hist = await api("GET", "/smart-reminders/history", { token: U.patient.token });
    assert(expectStatus(hist, 200, "history").data.length >= 1, "history entry");
    const sug = await api("GET", "/smart-reminders/suggestions", { token: U.patient.token });
    assert(Array.isArray(expectStatus(sug, 200, "suggestions").data.suggestions), "suggestions array");
    const apply = await api("POST", "/smart-reminders/suggestions/apply", { token: U.patient.token, body: { timeOfDay: "Evening", suggestedTime: "18:45" } });
    eq(expectStatus(apply, 200, "apply").data.reminderTimes.Evening, "18:45", "applied");
    const missed = await api("GET", "/smart-reminders/missed", { token: U.patient.token });
    expectStatus(missed, 200, "missed");
  });
  await test("manual escalation trigger is admin-only (403 for patient)", async () => {
    eq((await api("POST", `/smart-reminders/escalate/${S.reminder._id}`, { token: U.patient.token })).status, 403, "patient");
    expectStatus(await api("POST", `/smart-reminders/escalate/${S.reminder._id}`, { token: U.admin.token }), 200, "admin");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("5. Medication Adherence Monitoring");
  await test("seed 14 days of history (misses on Morning Mon–Wed pattern) via /adherence/confirm", async () => {
    for (let i = 1; i <= 14; i++) {
      const day = daysAgo(i);
      const dow = day.getDay();
      const morningStatus = i <= 3 || dow === 1 ? "missed" : "taken";
      expectStatus(await api("POST", "/adherence/confirm", { token: U.patient.token, body: { medicationId: S.med1, date: day.toISOString(), timeOfDay: "Morning", status: morningStatus } }), 201, `day -${i} morning`);
      expectStatus(await api("POST", "/adherence/confirm", { token: U.patient.token, body: { medicationId: S.med1, date: day.toISOString(), timeOfDay: "Night", status: i % 5 === 0 ? "delayed" : "taken" } }), 201, `day -${i} night`);
      expectStatus(await api("POST", "/adherence/confirm", { token: U.patient.token, body: { medicationId: S.med2, date: day.toISOString(), timeOfDay: "Evening", status: "taken" } }), 201, `day -${i} evening`);
    }
  });
  await test("today / weekly / monthly / history / csv export", async () => {
    const today = await api("GET", "/adherence/today", { token: U.patient.token });
    assert(expectStatus(today, 200, "today").data.schedule.length >= 3, "schedule");
    const weekly = await api("GET", "/adherence/weekly", { token: U.patient.token });
    const w = expectStatus(weekly, 200, "weekly").data;
    assert(w.dailyData.length === 7 && w.summary.totalDoses >= 15, "weekly data");
    const monthly = await api("GET", "/adherence/monthly", { token: U.patient.token });
    expectStatus(monthly, 200, "monthly");
    const hist = await api("GET", "/adherence/history?status=missed&limit=5", { token: U.patient.token });
    const h = expectStatus(hist, 200, "history").data;
    assert(h.logs.length >= 1 && h.logs.every((l) => l.status === "missed"), "filtered to missed");
    const csv = await api("GET", "/adherence/export?format=csv", { token: U.patient.token, raw: true });
    eq(csv.status, 200, "csv");
    assert(csv.headers.get("content-type").includes("text/csv") && csv.buffer.toString().startsWith("Date,Time of Day"), "csv body");
  });
  await test("caregiver and linked doctor can view; caregiver confirms a dose; unlinked doctor 403", async () => {
    const cg = await api("GET", `/adherence/today?patientId=${U.patient.id}`, { token: U.caregiver.token });
    expectStatus(cg, 200, "caregiver today");
    const dr = await api("GET", `/adherence/weekly?patientId=${U.patient.id}`, { token: U.doctor.token });
    expectStatus(dr, 200, "linked doctor weekly");
    eq((await api("GET", `/adherence/weekly?patientId=${U.patient.id}`, { token: U.doctor2.token })).status, 403, "unlinked doctor");
    const confirm = await api("POST", "/adherence/confirm", { token: U.caregiver.token, body: { patientUserId: U.patient.id, medicationId: S.medDoctor, timeOfDay: "Morning", status: "taken" } });
    eq(expectStatus(confirm, 201, "caregiver confirm").data.loggedBy, "caregiver", "logged by caregiver");
    const risk = await api("GET", `/adherence/risk-score/${U.patient.id}`, { token: U.caregiver.token });
    assert(expectStatus(risk, 200, "risk").data.overallRisk, "risk level");
    const pred = await api("GET", `/adherence/predictions/${U.patient.id}`, { token: U.doctor.token });
    expectStatus(pred, 200, "predictions");
    const pat = await api("GET", `/adherence/patterns/${U.patient.id}`, { token: U.caregiver.token });
    eq(expectStatus(pat, 200, "patterns").data.mostMissedTime, "Morning", "most missed time");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("6. Caregiver Dashboard");
  await test("overview, timeline, adherence bundle, alerts", async () => {
    const ov = await api("GET", "/caregiver-dashboard/overview", { token: U.caregiver.token });
    const p = expectStatus(ov, 200, "overview").data.find((x) => x.patientId === U.patient.id);
    assert(p && typeof p.todayAdherence === "number", "patient in overview");
    const tl = await api("GET", `/caregiver-dashboard/patients/${U.patient.id}/timeline`, { token: U.caregiver.token });
    assert(expectStatus(tl, 200, "timeline").data.length >= 10, "timeline events");
    const ad = await api("GET", `/caregiver-dashboard/patients/${U.patient.id}/adherence`, { token: U.caregiver.token });
    assert(expectStatus(ad, 200, "adherence").data.patterns, "bundle");
    const drTl = await api("GET", `/caregiver-dashboard/patients/${U.patient.id}/timeline`, { token: U.doctor.token });
    expectStatus(drTl, 200, "linked doctor timeline (was 403 before)");
    const alerts = await api("GET", "/caregiver-dashboard/alerts", { token: U.caregiver.token });
    expectStatus(alerts, 200, "alerts");
  });
  await test("caregiver notes, cognitive assessment, behavioural observation, mood, emergency contacts", async () => {
    const note = await api("POST", "/caregiver-dashboard/notes", { token: U.caregiver.token, body: { patientUserId: U.patient.id, title: "Morning routine", content: "Confused about the pill box", noteType: "medication", severity: "medium" } });
    const n = expectStatus(note, 201, "note").data;
    expectStatus(await api("PUT", `/caregiver-dashboard/notes/${n._id}`, { token: U.caregiver.token, body: { severity: "high" } }), 200, "update note");
    const notes = await api("GET", `/caregiver-dashboard/notes/${U.patient.id}`, { token: U.caregiver.token });
    assert(expectStatus(notes, 200, "notes").data.length >= 1, "listed");
    const cog = await api("POST", "/caregiver-dashboard/cognitive-assessment", { token: U.caregiver.token, body: { patientUserId: U.patient.id, assessmentType: "mini_mental", memoryScore: 5, orientationScore: 6, languageScore: 7, attentionScore: 6, maxScore: 40, observations: "Mild forgetfulness" } });
    expectStatus(cog, 201, "cognitive");
    const obs = await api("POST", "/caregiver-dashboard/behavioral-observation", { token: U.caregiver.token, body: { patientUserId: U.patient.id, observationType: "confusion", description: "Could not find the kitchen", severity: "moderate" } });
    expectStatus(obs, 201, "observation");
    const mood = await api("POST", "/caregiver-dashboard/mood", { token: U.patient.token, body: { mood: "anxious", energyLevel: 2, notes: "Slept badly" } });
    expectStatus(mood, 201, "mood");
    const ec = await api("POST", "/caregiver-dashboard/emergency-contacts", { token: U.patient.token, body: { name: "Sara", relation: "Daughter", phone: "+923001112222", isPrimary: true } });
    const contact = expectStatus(ec, 201, "contact").data;
    expectStatus(await api("PUT", `/caregiver-dashboard/emergency-contacts/${contact._id}`, { token: U.caregiver.token, body: { phone: "+923009998888" } }), 200, "update contact");
    const list = await api("GET", `/caregiver-dashboard/emergency-contacts/${U.patient.id}`, { token: U.caregiver.token });
    assert(expectStatus(list, 200, "contacts").data.length >= 1, "contact listed");
    const drMood = await api("GET", `/caregiver-dashboard/mood/${U.patient.id}`, { token: U.doctor.token });
    expectStatus(drMood, 200, "doctor mood history");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("8. Prescription Management");
  await test("parse-text preview turns a free-text prescription into a plan (FR11)", async () => {
    const r = await api("POST", "/prescriptions/parse-text", { token: U.patient.token, body: { text: "Tab. Donepezil 10mg once daily at night for 30 days\nMetformin 500 mg BD after meals x 2 weeks\nAspirin 75mg OD morning" } });
    const data = expectStatus(r, 200, "parse").data;
    eq(data.medications.length, 3, "three medications");
    const met = data.medications.find((m) => m.medicineName === "Metformin");
    assert(met.timeOfDay.length === 2 && met.durationDays === 14 && /after meals/.test(met.instructions), "metformin details");
  });
  await test("patient creates a text prescription → pending; apply before verification is refused", async () => {
    const r = await api("POST", "/prescriptions", { token: U.patient.token, body: { title: "Neurology visit", doctorName: "Dr. Ahmed", issuedDate: dateKey(new Date()), rawText: "Rivastigmine 4.6 mg every 24 hours\nMelatonin 2mg at bedtime" } });
    const rx = expectStatus(r, 201, "create").data;
    S.rx1 = rx._id;
    eq(rx.status, "pending", "pending");
    eq(rx.medications.length, 2, "parsed meds");
    const apply = await api("POST", `/prescriptions/${rx._id}/apply`, { token: U.patient.token });
    eq(apply.status, 400, "not verified");
    const list = await api("GET", "/prescriptions", { token: U.patient.token });
    assert(expectStatus(list, 200, "list").data.some((p) => p._id === rx._id), "listed");
    const hist = await api("GET", `/prescriptions/${rx._id}/history`, { token: U.patient.token });
    assert(expectStatus(hist, 200, "history").data.some((h) => h.action === "created"), "history");
  });
  await test("doctor sees it, verifies it; applying then adds the medications to the schedule", async () => {
    const list = await api("GET", "/prescriptions?status=pending", { token: U.doctor.token });
    assert(expectStatus(list, 200, "doctor list").data.some((p) => p._id === S.rx1), "doctor sees pending prescription");
    eq((await api("POST", `/prescriptions/${S.rx1}/verify`, { token: U.caregiver.token, body: { status: "verified" } })).status, 403, "caregiver cannot verify");
    eq((await api("POST", `/prescriptions/${S.rx1}/verify`, { token: U.doctor2.token, body: { status: "verified" } })).status, 403, "unlinked doctor cannot verify");
    const v = await api("POST", `/prescriptions/${S.rx1}/verify`, { token: U.doctor.token, body: { status: "verified", note: "Checked" } });
    eq(expectStatus(v, 200, "verify").data.status, "verified", "verified");
    const apply = await api("POST", `/prescriptions/${S.rx1}/apply`, { token: U.patient.token });
    eq(expectStatus(apply, 200, "apply").data.created.length, 2, "two medications created");
    const meds = await api("GET", "/medication", { token: U.patient.token });
    assert(expectStatus(meds, 200, "meds").data.some((m) => m.medicineName === "Rivastigmine" && m.prescriptionId === S.rx1), "provenance stored");
  });
  await test("upload a document (multipart): stored encrypted, served decrypted with correct type and checksum", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fe0d0ac6a10000000049454e44ae426082", "hex");
    const form = new FormData();
    form.append("title", "Scanned prescription");
    form.append("doctorName", "Dr. Khan");
    form.append("medications", JSON.stringify([{ medicineName: "Amlodipine", dosage: "5mg", timeOfDay: ["Morning"] }]));
    form.append("file", new Blob([png], { type: "image/png" }), "rx.png");
    const up = await api("POST", "/prescriptions", { token: U.patient.token, form });
    const rx = expectStatus(up, 201, "upload").data;
    S.rx2 = rx._id;
    assert(rx.file.originalName === "rx.png" && rx.file.encrypted === true && !rx.file.storagePath, "file metadata, no storage path leaked");
    const fileRes = await api("GET", `/prescriptions/${rx._id}/file`, { token: U.caregiver.token, raw: true });
    eq(fileRes.status, 200, "caregiver downloads");
    eq(fileRes.headers.get("content-type"), "image/png", "mime");
    assert(fileRes.buffer.equals(png), "decrypted bytes match the upload");
    const fs = require("fs");
    const path = require("path");
    const stored = fs.readFileSync(path.join(__dirname, "..", "uploads", "prescriptions", `${rx._id}.enc`));
    assert(!stored.equals(png) && !stored.subarray(0, 8).equals(png.subarray(0, 8)), "bytes on disk are encrypted");
    eq((await api("GET", `/prescriptions/${rx._id}/file`, { token: U.doctor2.token })).status, 403, "unlinked doctor denied");
    const badType = new FormData();
    badType.append("title", "Bad");
    badType.append("file", new Blob([Buffer.from("MZ...")], { type: "application/x-msdownload" }), "virus.exe");
    eq((await api("POST", "/prescriptions", { token: U.patient.token, form: badType })).status, 400, "exe rejected");
  });
  await test("doctor-issued prescription is verified immediately; patient edit resets verification; archive", async () => {
    const r = await api("POST", "/prescriptions", { token: U.doctor.token, body: { patientUserId: U.patient.id, title: "Hypertension plan", diagnosis: "Hypertension", medications: [{ medicineName: "Losartan", dosage: "50mg", timeOfDay: ["Morning"], durationDays: 90 }] } });
    const rx = expectStatus(r, 201, "doctor rx").data;
    eq(rx.status, "verified", "auto-verified");
    const edit = await api("PUT", `/prescriptions/${rx._id}`, { token: U.patient.token, body: { medications: [{ medicineName: "Losartan", dosage: "100mg", timeOfDay: ["Morning"] }] } });
    eq(expectStatus(edit, 200, "edit").data.status, "pending", "verification reset after patient edit");
    expectStatus(await api("DELETE", `/prescriptions/${rx._id}`, { token: U.patient.token }), 200, "archive");
    const list = await api("GET", "/prescriptions", { token: U.patient.token });
    assert(!expectStatus(list, 200, "list").data.some((p) => p._id === rx._id), "archived hidden from default list");
    const archived = await api("GET", "/prescriptions?archived=true", { token: U.patient.token });
    assert(expectStatus(archived, 200, "archived").data.some((p) => p._id === rx._id), "visible in archive");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("9. AI-Based Prediction and Alerts");
  await test("insights: missed-dose predictions, behaviour patterns, risk flags, recommendations", async () => {
    const r = await api("GET", "/ai/insights", { token: U.patient.token });
    const ai = expectStatus(r, 200, "insights").data;
    assert(ai.predictions.predictions.length >= 3, "a prediction per medication slot");
    const morning = ai.predictions.predictions.find((p) => p.medicineName === "Donepezil" && p.timeOfDay === "Morning");
    const night = ai.predictions.predictions.find((p) => p.medicineName === "Donepezil" && p.timeOfDay === "Night");
    assert(morning.probability > night.probability, `Morning (${morning.probability}) riskier than Night (${night.probability})`);
    const slotMorning = ai.behavior.bySlot.find((s) => s.slot === "Morning");
    const slotNight = ai.behavior.bySlot.find((s) => s.slot === "Night");
    assert(slotMorning.missed >= 4 && slotMorning.missRate > (slotNight.missRate ?? 0), `behaviour shows morning misses (${slotMorning.missed} missed, rate ${slotMorning.missRate})`);
    assert(ai.behavior.insights.length >= 1, "insight text");
    assert(ai.risks.flags.some((f) => f.code === "consecutive_misses"), "consecutive misses flagged");
    assert(ai.recommendations.length >= 1 && ai.summary.headline, "recommendations + headline");
    S.topProbability = morning.probability;
  });
  await test("preventive alerts: run creates AiAlert records and notifies patient (and care circle when high)", async () => {
    // Lower the platform thresholds so the seeded data (≈ 30–50 % miss probability) triggers an alert
    expectStatus(await api("PUT", "/admin/config", { token: U.admin.token, body: { ai: { alertThreshold: 0.2, caregiverAlertThreshold: 0.25 } } }), 200, "thresholds");
    eq((await api("POST", "/ai/run", { token: U.caregiver.token })).status, 400, "caregiver must name a patient");
    const run = await api("POST", `/ai/run?patientId=${U.patient.id}`, { token: U.caregiver.token });
    const data = expectStatus(run, 200, "run").data;
    assert(data.created >= 1, "alerts created");
    const alerts = await api("GET", "/ai/alerts", { token: U.patient.token });
    const list = expectStatus(alerts, 200, "alerts").data;
    assert(list.some((a) => a.kind === "missed_dose_prediction" && a.notifiedPatient), "prediction alert stored");
    const again = await api("POST", `/ai/run?patientId=${U.patient.id}`, { token: U.caregiver.token });
    eq(expectStatus(again, 200, "run again").data.created, 0, "no duplicate alerts the same day");
    const notif = await api("GET", "/notifications/history?type=ai_alert", { token: U.patient.token });
    assert(expectStatus(notif, 200, "patient ai notifications").data.notifications.length >= 1, "patient notified");
    const cgNotif = await api("GET", "/notifications/history?type=ai_alert", { token: U.caregiver.token });
    assert(expectStatus(cgNotif, 200, "caregiver ai notifications").data.notifications.length >= 1, "caregiver notified of high risk");
    const acc = await api("GET", "/ai/accuracy", { token: U.patient.token });
    expectStatus(acc, 200, "accuracy");
    eq((await api("GET", `/ai/insights?patientId=${U.patient.id}`, { token: U.doctor2.token })).status, 403, "unlinked doctor");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("10. Notification System");
  await test("alert customisation: settings round-trip, type toggles and quiet hours affect delivery", async () => {
    const get = await api("GET", "/notifications/settings", { token: U.patient.token });
    const s = expectStatus(get, 200, "get").data;
    assert(s.channels.inApp === true && s.types.missed_dose === true, "defaults");
    const put = await api("PUT", "/notifications/settings", { token: U.patient.token, body: { channels: { sms: true }, smsPhone: "+923001234567", types: { system: false }, quietHours: { enabled: false } } });
    const saved = expectStatus(put, 200, "put").data;
    assert(saved.channels.sms === true && saved.types.system === false, "saved");
    const t = await api("POST", "/notifications/test", { token: U.patient.token, body: { priority: "high" } });
    const n = expectStatus(t, 200, "test").data;
    const email = n.deliveries.find((d) => d.channel === "email");
    assert(email && email.status === "skipped" && /turned off/.test(email.detail), "email skipped because system alerts are off");
    await api("PUT", "/notifications/settings", { token: U.patient.token, body: { types: { system: true } } });
    const t2 = await api("POST", "/notifications/test", { token: U.patient.token, body: { priority: "high" } });
    const n2 = expectStatus(t2, 200, "test2").data;
    const sms = n2.deliveries.find((d) => d.channel === "sms");
    assert(sms && (sms.status === "mock" || sms.status === "sent"), `sms attempted (${sms?.status})`);
    assert(n2.deliveries.find((d) => d.channel === "email")?.status === "mock", "email mocked (no SMTP)");
    const now = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    const start = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endD = new Date(now.getTime() + 60 * 60000);
    const end = `${pad(endD.getHours())}:${pad(endD.getMinutes())}`;
    await api("PUT", "/notifications/settings", { token: U.patient.token, body: { quietHours: { enabled: true, start, end } } });
    const t3 = await api("POST", "/notifications/test", { token: U.patient.token, body: { priority: "normal" } });
    const n3 = expectStatus(t3, 200, "quiet").data;
    assert(n3.deliveries.find((d) => d.channel === "push")?.status === "skipped", "push skipped in quiet hours");
    await api("PUT", "/notifications/settings", { token: U.patient.token, body: { quietHours: { enabled: false } } });
  });
  await test("push tokens: register, list, delivery records push, unregister", async () => {
    const reg = await api("POST", "/notifications/push-token", { token: U.patient.token, body: { token: `test-token-${RUN}`, platform: "android", deviceName: "Pixel" } });
    expectStatus(reg, 200, "register");
    const list = await api("GET", "/notifications/push-tokens", { token: U.patient.token });
    assert(expectStatus(list, 200, "list").data.some((t) => t.token === `test-token-${RUN}`), "listed");
    const t = await api("POST", "/notifications/test", { token: U.patient.token, body: { priority: "high" } });
    const push = expectStatus(t, 200, "test").data.deliveries.find((d) => d.channel === "push");
    assert(push && push.status === "mock", `push delivered to mock token (${push?.status})`);
    expectStatus(await api("DELETE", "/notifications/push-token", { token: U.patient.token, body: { token: `test-token-${RUN}` } }), 200, "unregister");
    eq((await api("POST", "/notifications/push-token", { token: U.patient.token, body: {} })).status, 400, "token required");
  });
  await test("inbox: unread count, history filters, mark read, mark all, delete", async () => {
    const unread = await api("GET", "/notifications/unread-count", { token: U.patient.token });
    assert(expectStatus(unread, 200, "unread").data.unreadCount >= 1, "unread > 0");
    const hist = await api("GET", "/notifications/history?priority=high&limit=5", { token: U.patient.token });
    const h = expectStatus(hist, 200, "history").data;
    assert(h.notifications.length >= 1 && h.notifications.every((n) => n.priority === "high"), "priority filter");
    const first = h.notifications[0];
    assert(Array.isArray(first.deliveries) && first.deliveries.length >= 1, "delivery log present in history");
    expectStatus(await api("PATCH", `/notifications/${first._id}/read`, { token: U.patient.token }), 200, "mark read");
    expectStatus(await api("PATCH", "/notifications/read-all", { token: U.patient.token }), 200, "mark all");
    eq(expectStatus(await api("GET", "/notifications/unread-count", { token: U.patient.token }), 200, "unread").data.unreadCount, 0, "zero unread");
    expectStatus(await api("DELETE", `/notifications/${first._id}`, { token: U.patient.token }), 200, "delete");
    eq((await api("DELETE", `/notifications/${first._id}`, { token: U.caregiver.token })).status, 404, "cannot delete others");
  });
  await test("real-time: caregiver socket receives the patient's skipped dose + notification", async () => {
    const socket = socketClient(API, { transports: ["websocket"] });
    const received = { missed: null, notification: null };
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("socket connect timeout")), 8000);
      socket.on("connect", () => {
        socket.emit("join", U.caregiver.id);
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", (e) => reject(e));
    });
    socket.on("patient_missed_medication", (d) => (received.missed = d));
    socket.on("new_notification", (n) => (received.notification = n));
    await sleep(300);
    expectStatus(await api("POST", "/adherence/confirm", { token: U.patient.token, body: { medicationId: S.med2, timeOfDay: "Evening", status: "skipped" } }), 201, "skip");
    for (let i = 0; i < 20 && !(received.missed && received.notification); i++) await sleep(250);
    socket.disconnect();
    assert(received.missed && received.missed.medicationName === "Warfarin", "patient_missed_medication received");
    assert(received.notification && received.notification.type === "missed_dose", "new_notification received");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("7b. Health Analytics and Reporting");
  await test("seed vitals, then health trends / insights / performance / exports", async () => {
    for (const v of [
      { bloodPressure: { systolic: 128, diastolic: 82 }, heartRate: 72, weight: 62, temperature: 36.6, oxygenLevel: 97 },
      { bloodPressure: { systolic: 134, diastolic: 86 }, heartRate: 75, weight: 61.5, temperature: 36.7, oxygenLevel: 97 },
      { bloodPressure: { systolic: 146, diastolic: 92 }, heartRate: 80, weight: 61, temperature: 36.8, oxygenLevel: 96 },
    ]) {
      expectStatus(await api("POST", "/vitals", { token: U.patient.token, body: v }), 201, "vitals");
    }
    const trends = await api("GET", "/reports/health-trends?days=30", { token: U.patient.token });
    const t = expectStatus(trends, 200, "trends").data;
    eq(t.vitals.systolic.stats.count, 3, "three systolic points");
    eq(t.vitals.systolic.trend.direction, "rising", "systolic rising");
    assert(t.adherence.series.length >= 10, "adherence series");
    const ins = await api("GET", "/reports/insights", { token: U.patient.token });
    const insights = expectStatus(ins, 200, "insights").data.insights;
    assert(insights.some((i) => /Systolic BP/.test(i.title)), "insight about blood pressure");
    const perf = await api("GET", "/reports/performance?months=3", { token: U.patient.token });
    const p = expectStatus(perf, 200, "performance").data;
    assert(p.monthly.length === 3 && p.bestWeek, "monthly + best week");
    const csv = await api("GET", "/reports/export/csv?type=vitals", { token: U.patient.token, raw: true });
    assert(csv.status === 200 && csv.buffer.toString().startsWith("Date,Systolic"), "vitals csv");
    const full = await api("GET", `/reports/export/csv?type=full&patientId=${U.patient.id}`, { token: U.caregiver.token, raw: true });
    assert(full.status === 200 && full.buffer.toString().includes("# Vitals"), "full csv for caregiver");
    const pdf = await api("GET", `/reports/export/pdf?patientId=${U.patient.id}`, { token: U.doctor.token });
    assert(expectStatus(pdf, 200, "pdf-ready").data.currentMedications.length >= 2, "pdf data");
    const adh = await api("GET", "/reports/adherence", { token: U.patient.token });
    assert(expectStatus(adh, 200, "adherence report").data.totalDoses >= 40, "report totals");
    const risk = await api("GET", `/reports/risk-analysis?patientId=${U.patient.id}`, { token: U.caregiver.token });
    expectStatus(risk, 200, "risk analysis");
    eq((await api("GET", `/reports/health-trends?patientId=${U.patient.id}`, { token: U.doctor2.token })).status, 403, "unlinked doctor");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("11. Security and Data Protection");
  await test("secure headers are sent; audit trail and stats visible to admin only", async () => {
    const h = await api("GET", "/health");
    assert(h.headers.get("x-content-type-options") === "nosniff" && h.headers.get("x-frame-options"), "helmet headers");
    const logs = await api("GET", "/audit?category=prescription&limit=5", { token: U.admin.token });
    const data = expectStatus(logs, 200, "audit").data;
    assert(data.logs.length >= 1 && data.logs.every((l) => l.category === "prescription"), "prescription audit entries");
    const denied = await api("GET", "/audit?status=denied&limit=5", { token: U.admin.token });
    assert(expectStatus(denied, 200, "denied").data.logs.length >= 1, "denied requests are logged");
    const stats = await api("GET", "/audit/stats?days=1", { token: U.admin.token });
    const st = expectStatus(stats, 200, "stats").data;
    assert(st.total > 20 && st.failedLogins >= 5, "stats counts");
    eq((await api("GET", "/audit", { token: U.caregiver.token })).status, 403, "non-admin denied");
  });
  await test("maintenance mode blocks non-admins with 503 and can be switched off", async () => {
    expectStatus(await api("PUT", "/admin/config", { token: U.admin.token, body: { maintenanceMode: true, maintenanceMessage: "Back soon" } }), 200, "enable");
    const blocked = await api("GET", "/medication", { token: U.patient.token });
    eq(blocked.status, 503, "patient blocked");
    eq(blocked.json.message, "Back soon", "message");
    expectStatus(await api("GET", "/admin/dashboard", { token: U.admin.token }), 200, "admin still works");
    expectStatus(await api("PUT", "/admin/config", { token: U.admin.token, body: { maintenanceMode: false } }), 200, "disable");
    expectStatus(await api("GET", "/medication", { token: U.patient.token }), 200, "patient restored");
  });
  await test("registration can be disabled by configuration", async () => {
    expectStatus(await api("PUT", "/admin/config", { token: U.admin.token, body: { allowRegistration: false } }), 200, "disable");
    const r = await api("POST", "/auth/register", { body: { firstName: "Late", lastName: "User", email: `late${RUN}@example.com`, password: PASSWORD, role: "patient" } });
    eq(r.status, 403, "blocked");
    expectStatus(await api("PUT", "/admin/config", { token: U.admin.token, body: { allowRegistration: true } }), 200, "enable");
  });
  await test("self-service account deletion needs the password and anonymises the account", async () => {
    eq((await api("DELETE", "/user/me", { token: U.lockme.token, body: { password: "wrong" } })).status, 400, "wrong password");
    expectStatus(await api("DELETE", "/user/me", { token: U.lockme.token, body: { password: "Reset1234" } }), 200, "deleted");
    eq((await api("POST", "/auth/login", { body: { email: U.lockme.email, password: "Reset1234" } })).status, 401, "cannot log in");
    eq((await api("GET", "/auth/me", { token: U.lockme.token })).status, 401, "token dead");
  });

  // ═══════════════════════════════════════════════════════════════════
  section("12. Admin Panel");
  await test("system monitoring dashboard and health checks", async () => {
    const d = await api("GET", "/admin/dashboard", { token: U.admin.token });
    const data = expectStatus(d, 200, "dashboard").data;
    assert(data.users.total >= 5 && data.system.status === "healthy" && data.system.database.state === "connected", "dashboard shape");
    assert(data.system.scheduler && data.notifications.last24h >= 1, "scheduler + notifications");
    const hc = await api("GET", "/admin/health-checks", { token: U.admin.token });
    assert(expectStatus(hc, 200, "health").data.database.ok, "db ok");
  });
  await test("user management: list/search, create doctor, detail, deactivate (token revoked), role change, reset password", async () => {
    const list = await api("GET", `/admin/users?search=${RUN}&limit=50`, { token: U.admin.token });
    assert(expectStatus(list, 200, "list").data.users.length >= 5, "search by run id");
    const inactive = await api("GET", "/admin/users?status=inactive", { token: U.admin.token });
    assert(expectStatus(inactive, 200, "inactive").data.users.some((u) => u._id === U.lockme.id), "deleted account listed as inactive");
    const create = await api("POST", "/admin/users", { token: U.admin.token, body: { firstName: "Created", lastName: "Doctor", email: `created.dr.${RUN}@example.com`, password: PASSWORD, role: "doctor", speciality: "Neurology" } });
    const created = expectStatus(create, 201, "create").data.user;
    eq(created.role, "doctor", "role");
    const detail = await api("GET", `/admin/users/${U.patient.id}`, { token: U.admin.token });
    const det = expectStatus(detail, 200, "detail").data;
    assert(det.user.email === U.patient.email && det.medications >= 2 && Array.isArray(det.activity), "detail shape");
    const victim = await register("caregiver", "deact.");
    expectStatus(await api("PUT", `/admin/users/${victim.id}/status`, { token: U.admin.token, body: { isActive: false } }), 200, "deactivate");
    eq((await api("GET", "/auth/me", { token: victim.token })).status, 401, "deactivated token rejected");
    expectStatus(await api("PUT", `/admin/users/${victim.id}/status`, { token: U.admin.token, body: { isActive: true } }), 200, "reactivate");
    expectStatus(await api("PUT", `/admin/users/${victim.id}/role`, { token: U.admin.token, body: { role: "doctor" } }), 200, "role");
    eq((await api("PUT", `/admin/users/${U.admin.id}/role`, { token: U.admin.token, body: { role: "patient" } })).status, 400, "cannot demote self");
    const reset = await api("POST", `/admin/users/${victim.id}/reset-password`, { token: U.admin.token, body: { newPassword: "Temp12345" } });
    expectStatus(reset, 200, "set temp password");
    expectStatus(await api("POST", "/auth/login", { body: { email: victim.email, password: "Temp12345" } }), 200, "login with temp password");
    const emailed = await api("POST", `/admin/users/${victim.id}/reset-password`, { token: U.admin.token });
    assert(expectStatus(emailed, 200, "emailed reset").data.devCode, "reset code issued");
    eq((await api("DELETE", `/user/${U.admin.id}`, { token: U.admin.token })).status, 400, "cannot delete self");
  });
  await test("notification & alert management: broadcast reaches patients, listing, alerts, delete", async () => {
    const before = expectStatus(await api("GET", "/notifications/unread-count", { token: U.patient.token }), 200, "unread").data.unreadCount;
    const b = await api("POST", "/admin/notifications/broadcast", { token: U.admin.token, body: { title: "Scheduled maintenance", message: "Tonight 2am", roles: ["patient"], priority: "normal", channel: "in_app" } });
    const bc = expectStatus(b, 200, "broadcast").data;
    assert(bc.recipients >= 1, "recipients");
    const after = expectStatus(await api("GET", "/notifications/unread-count", { token: U.patient.token }), 200, "unread").data.unreadCount;
    eq(after, before + 1, "patient received the broadcast");
    const cgUnread = await api("GET", "/notifications/history?type=system&limit=3", { token: U.caregiver.token });
    assert(!expectStatus(cgUnread, 200, "cg").data.notifications.some((n) => n.title === "Scheduled maintenance"), "caregiver not targeted");
    const list = await api("GET", "/admin/notifications?type=system&limit=10", { token: U.admin.token });
    const l = expectStatus(list, 200, "list").data;
    const mine = l.notifications.find((n) => n.broadcastId === bc.broadcastId);
    assert(mine && l.byType.system >= 1, "broadcast listed with per-type counts");
    expectStatus(await api("DELETE", `/admin/notifications/${mine._id}`, { token: U.admin.token }), 200, "delete");
    const alerts = await api("GET", "/admin/alerts", { token: U.admin.token });
    const a = expectStatus(alerts, 200, "alerts").data;
    assert(Array.isArray(a.aiAlerts) && a.aiAlerts.length >= 1 && Array.isArray(a.highRiskPatients), "alerts shape");
  });
  await test("administrative reporting: overview aggregates and CSV exports", async () => {
    const ov = await api("GET", "/admin/reports/overview?months=3", { token: U.admin.token });
    const data = expectStatus(ov, 200, "overview").data;
    assert(data.usersByRole.patient >= 1 && data.totalDosesLogged >= 40 && data.topMedications.length >= 1, "aggregates");
    for (const type of ["users", "adherence", "audit"]) {
      const csv = await api("GET", `/admin/reports/export?type=${type}`, { token: U.admin.token, raw: true });
      assert(csv.status === 200 && csv.headers.get("content-type").includes("text/csv") && csv.buffer.length > 30, `${type} csv`);
    }
  });
  await test("platform configuration: reminder time defaults flow into patients without overrides; jobs run on demand", async () => {
    const get = await api("GET", "/admin/config", { token: U.admin.token });
    const cfg = expectStatus(get, 200, "get").data;
    assert(cfg.reminderTimes && cfg.security && cfg.ai, "config shape");
    expectStatus(await api("PUT", "/admin/config", { token: U.admin.token, body: { reminderTimes: { Afternoon: "12:45" }, escalation: { level2Minutes: 10 }, ai: { alertThreshold: 0.5 } } }), 200, "update");
    const prefs = await api("GET", "/smart-reminders/preferences", { token: U.patient.token });
    const p = expectStatus(prefs, 200, "prefs").data;
    eq(`${p.effective.Afternoon.hour}:${p.effective.Afternoon.minute}`, "12:45", "platform default applies to Afternoon");
    eq(`${p.effective.Morning.hour}:${p.effective.Morning.minute}`, "8:30", "user override kept for Morning");
    for (const job of ["generate-reminders", "escalate-reminders", "expire-prescriptions", "recalculate-risk", "ai-alerts"]) {
      expectStatus(await api("POST", `/admin/jobs/${job}`, { token: U.admin.token }), 200, `job ${job}`);
    }
    eq((await api("POST", "/admin/jobs/nope", { token: U.admin.token })).status, 404, "unknown job");
    await api("PUT", "/admin/config", { token: U.admin.token, body: { reminderTimes: { Afternoon: "13:00" }, escalation: { level2Minutes: 15 }, ai: { alertThreshold: 0.6, caregiverAlertThreshold: 0.75 } } });
  });

  // ═══════════════════════════════════════════════════════════════════
  await mongoose.disconnect();
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${passed}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailures:");
    failed.forEach((f) => console.log(` - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  process.exit(0);
})().catch(async (err) => {
  console.error(`\nFatal during "${current}":`, err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
