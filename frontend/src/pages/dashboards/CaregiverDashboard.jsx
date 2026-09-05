/**
 * CAREGIVER DASHBOARD — CaregiverDashboard.jsx
 * ===============================================
 * Enhanced with:
 * - Send real-time reminders to patients via Socket.io
 * - "Poke" patient when they miss medication
 * - Manage Patient Medications (Add/Edit/Delete) with start and end dates
 * - Log doses on behalf of patients
 */

import { useState, useEffect, useRef } from 'react';
import { FiHome, FiUsers, FiBell, FiCheckSquare, FiHeart, FiClock, FiCheck, FiX, FiActivity, FiPlus, FiZap, FiEdit2, FiTrash2, FiCalendar } from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { caregiverService } from '../../api/caregiver.service';
import { reminderService } from '../../api/reminder.service';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/caregiver',                icon: FiHome,        label: 'Overview' },
  { to: '/dashboard/caregiver/monitoring',     icon: FiActivity,    label: 'Monitoring' },
  { to: '/dashboard/caregiver/notes',          icon: FiEdit2,       label: 'Notes Log' },
  { to: '/dashboard/caregiver/alerts',         icon: FiBell,        label: 'Alerts Hub' },
  { to: '/dashboard/caregiver/reports',        icon: FiCheckSquare, label: 'Reports & Risk' },
  { to: '/dashboard/caregiver/cognitive',      icon: FiZap,         label: 'Cognitive Status' },
  { to: '/emergency-contacts',                 icon: FiHeart,       label: 'Emergency Support' }
];

const TIME_PERIODS = ["Morning", "Afternoon", "Evening", "Night"];

const CaregiverDashboard = () => {
  const { user } = useAuth();
  const [patients, setPatients]               = useState([]);
  const [requests, setRequests]               = useState([]);
  const [isFetching, setIsFetching]           = useState(true);
  const [handlingRequestId, setHandlingRequestId] = useState(null);
  
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientRecords, setPatientRecords]   = useState(null);
  const [loadingRecords, setLoadingRecords]   = useState(false);

  // Calendar view for patient records
  const [selectedDates, setSelectedDates]     = useState({});

  const handleDateChange = (patientId, date) => {
    setSelectedDates(prev => ({ ...prev, [patientId]: date }));
  };

  const getFilteredMedications = (meds, patientId) => {
    if (!meds) return [];
    const dateStr = selectedDates[patientId] || new Date().toISOString().split('T')[0];
    const selDate = new Date(dateStr);
    selDate.setHours(0,0,0,0);

    return meds.filter(m => {
      const startDate = new Date(m.startDate);
      startDate.setHours(0,0,0,0);
      if (selDate < startDate) return false;
      
      if (m.endDate) {
        const endDate = new Date(m.endDate);
        endDate.setHours(23,59,59,999);
        if (selDate > endDate) return false;
      }
      return true;
    });
  };

  // Missed medication alerts from patients
  const [missedAlerts, setMissedAlerts]       = useState([]);

  // Reminders / Poking
  const [pokingId, setPokingId]               = useState(null);

  // Medication Management (Add/Edit)
  const initialMedForm = { medicineName: '', dosage: '', frequency: 'daily', timeOfDay: [], description: '', notes: '', startDate: new Date().toISOString().split('T')[0], endDate: '' };
  const [medModal, setMedModal]               = useState(null); // { patientUserId, patientName, mode: 'add' | 'edit', medId: null }
  const [medForm, setMedForm]                 = useState(initialMedForm);
  const [isSavingMed, setIsSavingMed]         = useState(false);

  // Socket
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleMissedAlert = (data) => {
      setMissedAlerts(prev => [{ ...data, id: Date.now() }, ...prev]);
      // Note: Toast is already shown by SocketContext globally, no need to show it twice
    };

    socket.on('patient_missed_medication', handleMissedAlert);

    return () => {
      socket.off('patient_missed_medication', handleMissedAlert);
    };
  }, [socket]);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [patientsRes, requestsRes] = await Promise.all([
        caregiverService.getCaregiverPatients(),
        caregiverService.getCaregiverRequests()
      ]);
      setPatients(patientsRes.data || []);
      setRequests(requestsRes.data || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRequest = async (requestId, status) => {
    setHandlingRequestId(requestId);
    try {
      await caregiverService.handleRequest(requestId, status);
      toast.success(`Request ${status} successfully!`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${status} request`);
    } finally {
      setHandlingRequestId(null);
    }
  };

  const loadPatientRecords = async (patientUserId) => {
    if (selectedPatient === patientUserId) { setSelectedPatient(null); setPatientRecords(null); return; }
    setSelectedPatient(patientUserId);
    setLoadingRecords(true);
    try {
      const { data } = await caregiverService.getPatientRecords(patientUserId);
      setPatientRecords(data);
    } catch { toast.error('Failed to load patient records'); }
    finally { setLoadingRecords(false); }
  };

  const handlePoke = async (patientUserId, patientName) => {
    setPokingId(patientUserId);
    try {
      await reminderService.pokePatient(patientUserId);
      toast.success(`Poke sent to ${patientName}! 👋`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send poke');
    } finally { setPokingId(null); }
  };

  const handleTimeToggle = (time) => {
    setMedForm(prev => {
      const times = prev.timeOfDay.includes(time) ? prev.timeOfDay.filter(t => t !== time) : [...prev.timeOfDay, time];
      return { ...prev, timeOfDay: times };
    });
  };

  const handleSaveMedication = async (e) => {
    e.preventDefault();
    if (medForm.timeOfDay.length === 0) return toast.error("Select at least one time of day");
    setIsSavingMed(true);
    try {
      if (medModal.mode === 'add') {
        await caregiverService.addPatientMedication(medModal.patientUserId, medForm);
        toast.success(`Medication added for ${medModal.patientName}`);
      } else {
        await caregiverService.updatePatientMedication(medModal.patientUserId, medModal.medId, medForm);
        toast.success(`Medication updated for ${medModal.patientName}`);
      }
      setMedModal(null);
      loadPatientRecords(medModal.patientUserId); // refresh records
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save medication');
    } finally { setIsSavingMed(false); }
  };

  const handleDeleteMedication = async (patientUserId, medId) => {
    if (!window.confirm("Delete this medication?")) return;
    try {
      await caregiverService.deletePatientMedication(patientUserId, medId);
      toast.success("Medication deleted");
      loadPatientRecords(patientUserId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete medication');
    }
  };

  const handleLogDose = async (patientUserId, medId, timeOfDay) => {
    try {
      await caregiverService.logPatientDose(patientUserId, medId, {
        date: new Date().toISOString(),
        timeOfDay,
        status: 'taken'
      });
      toast.success("Dose logged for patient");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to log dose");
    }
  };

  const handleRemovePatient = async (patientUserId, patientName) => {
    if (!window.confirm(`Are you sure you want to remove ${patientName} from your care list?`)) return;
    try {
      await caregiverService.removePatient(patientUserId);
      toast.success(`${patientName} has been removed from your care list.`);
      if (selectedPatient === patientUserId) {
        setSelectedPatient(null);
        setPatientRecords(null);
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove patient.");
    }
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Caregiver Dashboard">

      {/* Welcome Banner */}
      <div className="glass-card p-6 mb-6 bg-gradient-to-r from-purple-600/20 to-blue-600/10 border-purple-500/20">
        <h2 className="text-2xl font-bold text-white">Welcome, {user?.firstName}! 🤝</h2>
        <p className="text-white/50 mt-1">
          <span className="text-purple-400 font-semibold">{requests.length} pending requests</span> · {patients.length} patients under care.
        </p>
      </div>

      {/* Missed Alerts */}
      {missedAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-red-400 font-semibold flex items-center gap-2 mb-3">⚠️ Missed Medication Alerts</h3>
          {missedAlerts.map(alert => (
            <div key={alert.id} className="glass-card p-4 border-l-4 border-l-red-500 bg-red-950/30 flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{alert.patientName} missed <span className="text-red-400">{alert.medicationName}</span></p>
                <p className="text-white/50 text-sm">{alert.timeOfDay} · {new Date(alert.timestamp).toLocaleTimeString()}</p>
              </div>
              <Button onClick={() => handlePoke(alert.patientId, alert.patientName)} isLoading={pokingId === alert.patientId} className="!bg-orange-500/20 !text-orange-300 hover:!bg-orange-500/30 flex items-center gap-2 shrink-0">
                <FiZap /> Poke Patient
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Patients */}
        <div id="patients" className="xl:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FiUsers className="w-5 h-5 text-purple-400" /> Patients Under Care
            </h3>
            {isFetching ? (
              <div className="flex justify-center p-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>
            ) : patients.length === 0 ? (
              <p className="text-white/50 text-sm">No assigned patients yet.</p>
            ) : (
              <div className="space-y-3">
                {patients.map(patient => {
                  const u = patient?.userId;
                  if (!u || !u._id) return null;
                  const isSelected = selectedPatient === u._id;
                  return (
                    <div key={u._id} className="flex flex-col gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-white font-bold shrink-0 cursor-pointer" onClick={() => loadPatientRecords(u._id)}>
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadPatientRecords(u._id)}>
                          <div className="text-white font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-white/50 text-sm">{u.email}</div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePoke(u._id, u.firstName)}
                              disabled={pokingId === u._id}
                              className="px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              <FiZap className="w-3.5 h-3.5" /> {pokingId === u._id ? '...' : 'Poke'}
                            </button>
                            <button
                              onClick={() => handleRemovePatient(u._id, u.firstName)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                            >
                              <FiX className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Patient Records Expansion */}
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          {loadingRecords ? (
                            <p className="text-white/50 text-sm">Loading records...</p>
                          ) : patientRecords ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Vitals */}
                              <div className="bg-white/5 p-4 rounded-lg">
                                <h4 className="text-white font-medium mb-3 flex items-center gap-2"><FiActivity /> Recent Vitals</h4>
                                {patientRecords.vitals?.length > 0 ? (
                                  patientRecords.vitals.slice(0, 5).map(v => (
                                    <div key={v._id} className="text-sm text-white/70 mb-2 pb-2 border-b border-white/5">
                                      <span className="font-semibold text-white/90">{v.heartRate || '-'} bpm</span> · {v.bloodPressure?.systolic || '-'}/{v.bloodPressure?.diastolic || '-'} mmHg
                                      <div className="text-xs text-white/40 mt-1">{new Date(v.recordedAt).toLocaleString()}</div>
                                    </div>
                                  ))
                                ) : <p className="text-xs text-white/40">No vitals recorded.</p>}
                              </div>
                              
                              {/* Medications */}
                              <div className="bg-white/5 p-4 rounded-lg flex flex-col">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex flex-col gap-1">
                                    <h4 className="text-white font-medium flex items-center gap-2"><FiBell /> Medications</h4>
                                    <input 
                                      type="date" 
                                      className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-purple-500"
                                      value={selectedDates[u._id] || new Date().toISOString().split('T')[0]}
                                      onChange={(e) => handleDateChange(u._id, e.target.value)}
                                    />
                                  </div>
                                  <button 
                                    onClick={() => { setMedModal({ patientUserId: u._id, patientName: u.firstName, mode: 'add', medId: null }); setMedForm(initialMedForm); }}
                                    className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-2 py-1 rounded"
                                  >
                                    <FiPlus /> Add
                                  </button>
                                </div>
                                
                                {getFilteredMedications(patientRecords.medications, u._id).length > 0 ? (
                                  <div className="space-y-3">
                                    {getFilteredMedications(patientRecords.medications, u._id).map(med => (
                                      <div key={med._id} className="text-sm text-white/70 pb-3 border-b border-white/5 group relative">
                                        <div className="flex justify-between items-start pr-12">
                                          <div>
                                            <span className="font-semibold text-white/90">{med.medicineName || med.name}</span> <span className="text-xs">({med.dosage})</span>
                                            <div className="text-xs text-white/50 mt-1">{med.frequency} · {med.timeOfDay?.join(', ') || 'N/A'}</div>
                                            <div className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                                              <FiCalendar className="w-3 h-3" />
                                              {new Date(med.startDate).toLocaleDateString()} {med.endDate ? ` - ${new Date(med.endDate).toLocaleDateString()}` : ''}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Actions (Edit/Delete/Checkoff) */}
                                        <div className="mt-2 flex gap-2">
                                          <button onClick={() => {
                                            setMedModal({ patientUserId: u._id, patientName: u.firstName, mode: 'edit', medId: med._id });
                                            setMedForm({
                                              medicineName: med.medicineName, dosage: med.dosage, frequency: med.frequency, timeOfDay: med.timeOfDay,
                                              description: med.description || '', notes: med.notes || '',
                                              startDate: new Date(med.startDate).toISOString().split('T')[0],
                                              endDate: med.endDate ? new Date(med.endDate).toISOString().split('T')[0] : ''
                                            });
                                          }} className="p-1.5 text-blue-400 hover:bg-blue-400/20 rounded bg-blue-400/10 transition-colors" title="Edit">
                                            <FiEdit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => handleDeleteMedication(u._id, med._id)} className="p-1.5 text-red-400 hover:bg-red-400/20 rounded bg-red-400/10 transition-colors" title="Delete">
                                            <FiTrash2 className="w-3.5 h-3.5" />
                                          </button>
                                          
                                          {/* Log dose for today */}
                                          {med.timeOfDay?.map(time => (
                                            <button key={time} onClick={() => handleLogDose(u._id, med._id, time)} className="p-1.5 px-2 text-xs font-medium text-teal-400 hover:bg-teal-400/20 rounded bg-teal-400/10 transition-colors flex items-center gap-1" title={`Mark ${time} dose as taken`}>
                                              <FiCheck className="w-3 h-3" /> Log {time}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : <p className="text-xs text-white/40">No medications found.</p>}
                              </div>
                            </div>
                          ) : <p className="text-white/50 text-sm">Could not load records.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Pending Requests */}
        <div id="requests">
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FiClock className="w-5 h-5 text-amber-400" /> Connection Requests
            </h3>
            {requests.length === 0 ? (
              <p className="text-white/50 text-sm">No pending requests.</p>
            ) : (
              <div className="space-y-4">
                {requests.map(request => {
                  if (!request?.patientId) return null;
                  return (
                    <div key={request._id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                          {request.patientId?.firstName?.[0]}
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm">{request.patientId?.firstName} {request.patientId?.lastName}</div>
                          <div className="text-white/40 text-xs">{request.patientId?.email}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="flex-1 !bg-red-500/10 !text-red-400 hover:!bg-red-500/20 border-0"
                          onClick={() => handleRequest(request._id, 'declined')} isLoading={handlingRequestId === request._id}>
                          <FiX /> Decline
                        </Button>
                        <Button size="sm" className="flex-1 !bg-green-500/20 !text-green-400 hover:!bg-green-500/30 border-0"
                          onClick={() => handleRequest(request._id, 'accepted')} isLoading={handlingRequestId === request._id}>
                          <FiCheck /> Accept
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Medication Modal */}
      {medModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-20 pb-10">
          <div className="glass-card w-full max-w-2xl p-6 bg-gray-900 border-white/20 animate-fade-in my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{medModal.mode === 'add' ? 'Add' : 'Edit'} Medication for {medModal.patientName}</h3>
              <button onClick={() => setMedModal(null)} className="text-white/50 hover:text-white"><FiX className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSaveMedication} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input id="medicineName" name="medicineName" label="Medication Name *" required value={medForm.medicineName} onChange={e => setMedForm({...medForm, medicineName: e.target.value})} placeholder="e.g. Aspirin" />
                <Input id="dosage" name="dosage" label="Dosage *" required value={medForm.dosage} onChange={e => setMedForm({...medForm, dosage: e.target.value})} placeholder="e.g. 1 tablet, 500mg" />
                
                <div>
                  <label className="text-xs text-white/50 block mb-1">Frequency *</label>
                  <select name="frequency" value={medForm.frequency} onChange={e => setMedForm({...medForm, frequency: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    <option value="daily" className="bg-slate-800 text-white">Daily</option>
                    <option value="weekly" className="bg-slate-800 text-white">Weekly</option>
                    <option value="custom" className="bg-slate-800 text-white">Custom</option>
                  </select>
                </div>
                
                <div className="col-span-1 md:col-span-2">
                  <label className="text-xs text-white/50 block mb-2">Time of Day (Select all that apply) *</label>
                  <div className="flex flex-wrap gap-2">
                    {TIME_PERIODS.map(time => (
                      <button key={time} type="button" onClick={() => handleTimeToggle(time)} className={`px-4 py-2 rounded-lg border text-sm transition-colors ${medForm.timeOfDay.includes(time) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <Input type="date" id="startDate" name="startDate" label="Start Date *" required value={medForm.startDate} onChange={e => setMedForm({...medForm, startDate: e.target.value})} />
                <Input type="date" id="endDate" name="endDate" label="End Date (Optional)" value={medForm.endDate} onChange={e => setMedForm({...medForm, endDate: e.target.value})} />

                <div className="col-span-1 md:col-span-2">
                  <Input id="description" name="description" label="Instructions / Description" value={medForm.description} onChange={e => setMedForm({...medForm, description: e.target.value})} placeholder="e.g. Take after meals" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <Button type="button" variant="secondary" onClick={() => setMedModal(null)}>Cancel</Button>
                <Button type="submit" isLoading={isSavingMed}>{medModal.mode === 'add' ? 'Save Medication' : 'Update Medication'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};

export default CaregiverDashboard;
