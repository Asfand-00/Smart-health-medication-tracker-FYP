/**
 * ACCESS CONTROL — access.js
 * ===========================
 * One place that answers "may this user see / act on this patient?".
 *
 *  - patient   → only themselves
 *  - caregiver → patients that list them in Patient.assignedCaregivers
 *  - doctor    → patients linked through an accepted DoctorPatientLink
 *                (or User.assignedDoctor)
 *  - admin     → everyone
 *
 * Every feature used to carry its own copy of this logic, and the doctor
 * branch simply returned `true` for any patient. Centralising it is the
 * "role-based authorization" requirement of the Security module.
 */

const Patient = require("../features/patient/patient.model");

const forbid = (message) => {
  const err = new Error(message);
  err.status = 403;
  err.statusCode = 403;
  return err;
};

/**
 * Resolves to the Patient document (or null when the patient has no medical
 * profile yet) when access is allowed, otherwise throws a 403 error whose
 * shape `{ status, message }` is what the controllers expect.
 */
const assertPatientAccess = async (requester, patientUserId) => {
  if (!requester || !patientUserId) throw forbid("Access denied.");
  const requesterId = (requester._id || requester.id).toString();
  const targetId = patientUserId.toString();

  if (requester.role === "admin") {
    return (await Patient.findOne({ userId: targetId })) || null;
  }

  if (requester.role === "patient") {
    if (requesterId !== targetId) throw forbid("You can only view your own data.");
    return (await Patient.findOne({ userId: targetId })) || null;
  }

  if (requester.role === "caregiver") {
    const patient = await Patient.findOne({ userId: targetId, assignedCaregivers: requesterId });
    if (!patient) throw forbid("Not authorized to view this patient.");
    return patient;
  }

  if (requester.role === "doctor") {
    const DoctorPatientLink = require("../features/doctor/doctorPatientLink.model");
    const link = await DoctorPatientLink.findOne({ doctorId: requesterId, patientUserId: targetId, status: "accepted" });
    if (!link) {
      const User = require("../features/user/user.model");
      const patientUser = await User.findById(targetId).select("assignedDoctor");
      if (!patientUser || !patientUser.assignedDoctor || patientUser.assignedDoctor.toString() !== requesterId) {
        throw forbid("This patient is not assigned to you.");
      }
    }
    return (await Patient.findOne({ userId: targetId })) || null;
  }

  throw forbid("Access denied.");
};

/** Boolean version for places that only need yes/no. */
const canAccessPatient = async (requester, patientUserId) => {
  try {
    await assertPatientAccess(requester, patientUserId);
    return true;
  } catch {
    return false;
  }
};

/**
 * Ids of every caregiver and doctor who should be told about events for a
 * patient (used by notifications and AI alerts).
 */
const getCareCircle = async (patientUserId) => {
  const User = require("../features/user/user.model");
  const DoctorPatientLink = require("../features/doctor/doctorPatientLink.model");
  const patient = await Patient.findOne({ userId: patientUserId }).select("assignedCaregivers");
  const caregivers = (patient?.assignedCaregivers || []).map((id) => id.toString());
  const links = await DoctorPatientLink.find({ patientUserId, status: "accepted" }).select("doctorId");
  const doctors = links.map((l) => l.doctorId.toString());
  const patientUser = await User.findById(patientUserId).select("assignedDoctor");
  if (patientUser?.assignedDoctor && !doctors.includes(patientUser.assignedDoctor.toString())) {
    doctors.push(patientUser.assignedDoctor.toString());
  }
  return { caregivers, doctors };
};

module.exports = { assertPatientAccess, canAccessPatient, getCareCircle, forbid };
