import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiTrendingUp, FiActivity, FiMessageSquare, FiAlertCircle, FiPlus } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import { adherenceService } from '../api/adherence.service';
import TimelineView from '../components/ui/TimelineView';
import RiskBadge from '../components/ui/RiskBadge';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
  { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
  { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
  { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
  { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' }
];

export default function CaregiverMonitoringPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPatient, setLoadingPatient] = useState(false);

  // Behavioral Observation logging form
  const [obsType, setObsType] = useState('confusion');
  const [obsDesc, setObsDesc] = useState('');
  const [obsSeverity, setObsSeverity] = useState('mild');
  const [obsNotes, setObsNotes] = useState('');
  const [obsActions, setObsActions] = useState('');

  // Emergency contact form
  const [contactName, setContactName] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const fetchPatients = async () => {
    setLoadingList(true);
    try {
      const res = await caregiverDashboardService.getOverview();
      if (res.success) {
        setPatients(res.data);
        if (res.data.length > 0) {
          setSelectedPatientId(res.data[0].patientId);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load assigned patients.');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchPatientDetails = async (patientId) => {
    if (!patientId) return;
    setLoadingPatient(true);
    try {
      const [timelineRes, adherenceRes] = await Promise.all([
        caregiverDashboardService.getPatientTimeline(patientId),
        caregiverDashboardService.getPatientAdherence(patientId)
      ]);

      if (timelineRes.success) setTimeline(timelineRes.data);
      if (adherenceRes.success) setPatientData(adherenceRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient monitoring details.');
    } finally {
      setLoadingPatient(false);
    }
  };

  const handleConfirmDose = async (medicationId, timeOfDay, status) => {
    try {
      const res = await adherenceService.confirmDose({
        patientUserId: selectedPatientId,
        medicationId,
        timeOfDay,
        status,
        notes: `Administered by caregiver.`
      });
      if (res.success) {
        toast.success(`Medication marked as ${status}!`);
        fetchPatientDetails(selectedPatientId);
        fetchPatients();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update medication status.');
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientDetails(selectedPatientId);
    }
  }, [selectedPatientId]);

  const handleLogObservation = async (e) => {
    e.preventDefault();
    if (!obsDesc) return;
    try {
      const res = await caregiverDashboardService.logBehavioralObservation({
        patientUserId: selectedPatientId,
        observationType: obsType,
        description: obsDesc,
        severity: obsSeverity,
        actionsTaken: obsActions
      });
      if (res.success) {
        toast.success('Behavioral observation logged successfully!');
        setObsDesc('');
        setObsActions('');
        fetchPatientDetails(selectedPatientId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to log behavioral observation.');
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !contactRelation) return;
    try {
      const res = await caregiverDashboardService.addEmergencyContact({
        patientUserId: selectedPatientId,
        name: contactName,
        relation: contactRelation,
        phone: contactPhone,
        email: contactEmail
      });
      if (res.success) {
        toast.success('Emergency contact added!');
        setContactName('');
        setContactPhone('');
        setContactRelation('');
        setContactEmail('');
        fetchPatientDetails(selectedPatientId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add contact.');
    }
  };

  const activePatient = patients.find(p => p.patientId === selectedPatientId);

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="👁️ Patient Monitoring">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto select-none">
        
        {/* Left Side: Patients List Selection */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">My Patients</h3>
          {loadingList ? (
            <div className="flex justify-center py-6">
              <span className="animate-spin text-slate-500">🌀</span>
            </div>
          ) : patients.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6">No assigned patients found.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {patients.map((p) => {
                const isSelected = p.patientId === selectedPatientId;
                return (
                  <button
                    key={p.patientId}
                    onClick={() => setSelectedPatientId(p.patientId)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                        : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">{p.firstName} {p.lastName}</div>
                    <div className="text-3xs text-slate-500 mt-1 flex justify-between">
                      <span>Adherence: {p.todayAdherence}%</span>
                      <span className="capitalize">Risk: {p.riskLevel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detailed Monitoring Board */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {selectedPatientId && activePatient ? (
            <>
              {/* Patient Banner Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-white">{activePatient.firstName} {activePatient.lastName}</h2>
                    <RiskBadge level={activePatient.riskLevel} score={activePatient.riskScore} />
                  </div>
                  <p className="text-xs text-slate-400">
                    Gender: <span className="capitalize">{activePatient.gender}</span> | Birthdate: {new Date(activePatient.dateOfBirth).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <Link
                    to={`/dashboard/caregiver/cognitive?patientId=${selectedPatientId}`}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    🧠 Log Assessment
                  </Link>
                </div>
              </div>

              {loadingPatient ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left sub-column: Medication & Patient Timeline */}
                  <div className="flex flex-col gap-6">
                    
                    {/* Medication Schedule Admin Panel */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>💊</span> Today's Medication Schedule
                        </h3>
                        <span className="text-3xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-black uppercase">
                          Live Status
                        </span>
                      </div>
                      
                      {!patientData?.todayStatus?.schedule || patientData.todayStatus.schedule.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center py-4">No medications scheduled for today.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {patientData.todayStatus.schedule.map((item, idx) => {
                            const isPending = item.status === 'pending';
                            const isTaken = item.status === 'taken' || item.status === 'delayed';
                            const isSkipped = item.status === 'skipped';
                            const isMissed = item.status === 'missed';
                            
                            let statusColor = 'bg-slate-950/40 text-slate-400 border-slate-850';
                            if (isTaken) statusColor = 'bg-emerald-950/40 border border-emerald-900 text-emerald-400';
                            if (isSkipped) statusColor = 'bg-rose-950/40 border border-rose-900 text-rose-400';
                            if (isMissed) statusColor = 'bg-amber-950/40 border border-amber-900 text-amber-450';
                            
                            return (
                              <div key={idx} className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3 justify-between animate-fade-in">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col gap-0.5">
                                    <h4 className="text-sm font-black text-white">{item.medicineName}</h4>
                                    <span className="text-3xs text-slate-400">Dosage: {item.dosage} | Scheduled: {item.timeOfDay}</span>
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-xl text-3xs font-extrabold capitalize border ${statusColor}`}>
                                    {item.status}
                                  </span>
                                </div>
                                
                                {isPending || isMissed ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleConfirmDose(item.medicationId, item.timeOfDay, 'taken')}
                                      className="flex-grow py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer border-b-2 border-emerald-700 text-center"
                                    >
                                      ✅ Administered
                                    </button>
                                    <button
                                      onClick={() => handleConfirmDose(item.medicationId, item.timeOfDay, 'skipped')}
                                      className="flex-grow py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black rounded-xl transition cursor-pointer border-b-2 border-rose-800 text-center"
                                    >
                                      ❌ Skipped
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-base font-bold text-white mb-4">Activity Timeline</h3>
                      <div className="max-h-[500px] overflow-y-auto pr-1">
                        <TimelineView events={timeline} />
                      </div>
                    </div>
                  </div>

                  {/* Right sub-column: Logging & Settings forms */}
                  <div className="flex flex-col gap-6">
                    
                    {/* Log Behavioral Observation */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Log Behavioral Observation</h3>
                      <form onSubmit={handleLogObservation} className="flex flex-col gap-3">
                        <div>
                          <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Type</label>
                          <select
                            value={obsType}
                            onChange={(e) => setObsType(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none"
                          >
                            <option value="confusion">Confusion / Disorientation</option>
                            <option value="wandering">Wandering</option>
                            <option value="agitation">Agitation / Anger</option>
                            <option value="mood_change">Sudden Mood Change</option>
                            <option value="medication_confusion">Medication Confusion</option>
                            <option value="sleep_disturbance">Sleep Disturbance</option>
                            <option value="safety_concern">Safety Concern</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Severity</label>
                          <select
                            value={obsSeverity}
                            onChange={(e) => setObsSeverity(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none"
                          >
                            <option value="mild">Mild</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Description</label>
                          <textarea
                            required
                            value={obsDesc}
                            onChange={(e) => setObsDesc(e.target.value)}
                            placeholder="Detail what happened, location, triggers..."
                            rows="2.5"
                            className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Actions Taken</label>
                          <input
                            type="text"
                            value={obsActions}
                            onChange={(e) => setObsActions(e.target.value)}
                            placeholder="e.g. Guided to bed, gave water..."
                            className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!obsDesc}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FiPlus /> Log Observation
                        </button>
                      </form>
                    </div>

                    {/* Manage Emergency Contacts Form */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Add Emergency Contact</h3>
                      <form onSubmit={handleAddContact} className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Name</label>
                            <input
                              required
                              type="text"
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              placeholder="Contact name"
                              className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Relation</label>
                            <input
                              required
                              type="text"
                              value={contactRelation}
                              onChange={(e) => setContactRelation(e.target.value)}
                              placeholder="e.g. Spouse, Son"
                              className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                          <input
                            required
                            type="tel"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            placeholder="Phone number"
                            className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Email (Optional)</label>
                          <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="Email address"
                            className="w-full bg-slate-800 border border-slate-700/80 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!contactName || !contactPhone || !contactRelation}
                          className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FiPlus /> Add Emergency Contact
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-500 text-sm">
              Please select a patient on the left.
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
