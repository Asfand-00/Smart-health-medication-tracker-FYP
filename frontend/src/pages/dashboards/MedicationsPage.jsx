/**
 * MEDICATIONS PAGE — MedicationsPage.jsx
 * ========================================
 * Manage patient medications, daily schedule, and history.
 */

import { useState, useEffect } from 'react';
import { 
  FiHome, FiPlusCircle, FiCalendar, FiHeart, FiBell, FiTrendingUp, 
  FiTrash2, FiClock, FiActivity, FiUsers, FiCheck, FiX, FiEdit2, 
  FiChevronLeft, FiChevronRight, FiInfo 
} from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { medicationService } from '../../api/medication.service';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';

const NAV_ITEMS = [
  { to: '/dashboard/patient',                  icon: FiHome,       label: 'Dashboard' },
  { to: '/dashboard/patient/medical-profile',  icon: FiHeart,      label: 'Medical Profile' },
  { to: '/medications',                        icon: FiPlusCircle, label: 'Medications' },
  { to: '/vitals',                             icon: FiActivity,   label: 'Health Vitals' },
  { to: '/dashboard/patient/care-team',        icon: FiUsers,      label: 'Care Team' },
  { to: '/schedule',                           icon: FiCalendar,   label: 'Schedule' },
  { to: '/reminders',                          icon: FiBell,       label: 'Reminders' },
  { to: '/progress',                           icon: FiTrendingUp, label: 'Progress' },
];

const TIME_PERIODS = ["Morning", "Afternoon", "Evening", "Night"];

const MedicationsPage = () => {
  const [activeTab, setActiveTab] = useState('schedule'); // schedule, list, history
  
  const [medications, setMedications] = useState([]);
  const [history, setHistory] = useState([]); // History for selected date
  const [fullHistory, setFullHistory] = useState([]); // All history
  
  const [isFetching, setIsFetching] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMed, setEditingMed] = useState(null);

  // Calendar/Schedule state
  const [selectedDate, setSelectedDate] = useState(new Date());

  const initialFormState = {
    medicineName: '',
    dosage: '',
    frequency: 'daily',
    timeOfDay: [],
    description: '',
    notes: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const medsRes = await medicationService.getAll();
      setMedications(medsRes.data || []);
      
      // Get history for selected date
      const startOfDay = new Date(selectedDate.setHours(0,0,0,0)).toISOString();
      const endOfDay = new Date(selectedDate.setHours(23,59,59,999)).toISOString();
      
      const histRes = await medicationService.getHistory({ startDate: startOfDay, endDate: endOfDay });
      setHistory(histRes.data || []);
      
      // Get full history
      const fullHistRes = await medicationService.getHistory({});
      setFullHistory(fullHistRes.data || []);
    } catch (error) {
      toast.error('Failed to load medication data');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]); // Re-fetch history when date changes

  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchData();
    socket.on('medication_logged', handleUpdate);
    socket.on('medication_updated', handleUpdate);
    return () => {
      socket.off('medication_logged', handleUpdate);
      socket.off('medication_updated', handleUpdate);
    };
  }, [socket]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTimeToggle = (time) => {
    setFormData(prev => {
      const times = prev.timeOfDay.includes(time)
        ? prev.timeOfDay.filter(t => t !== time)
        : [...prev.timeOfDay, time];
      return { ...prev, timeOfDay: times };
    });
  };

  const handleEditClick = (med) => {
    setEditingMed(med);
    setFormData({
      medicineName: med.medicineName,
      dosage: med.dosage,
      frequency: med.frequency,
      timeOfDay: med.timeOfDay || [],
      description: med.description || '',
      notes: med.notes || '',
      startDate: new Date(med.startDate).toISOString().split('T')[0],
      endDate: med.endDate ? new Date(med.endDate).toISOString().split('T')[0] : '',
    });
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (formData.timeOfDay.length === 0) {
      toast.error("Please select at least one time of day.");
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingMed) {
        await medicationService.update(editingMed._id, formData);
        toast.success('Medication updated successfully');
      } else {
        await medicationService.add(formData);
        toast.success('Medication added successfully');
      }
      
      setFormData(initialFormState);
      setIsAdding(false);
      setEditingMed(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save medication');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this medication?")) return;
    try {
      await medicationService.delete(id);
      toast.success('Medication deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete medication');
    }
  };

  const handleLogDose = async (medId, timeOfDay, status) => {
    try {
      await medicationService.logDose(medId, {
        date: selectedDate.toISOString(),
        timeOfDay,
        status
      });
      toast.success(`Marked as ${status}`);
      fetchData(); // Refresh history
    } catch (error) {
      toast.error('Failed to log dose');
    }
  };

  const getLogStatus = (medId, timeOfDay) => {
    const log = history.find(h => h.medicationId && h.medicationId._id === medId && h.timeOfDay === timeOfDay);
    return log ? log.status : null; 
  };

  // Calendar Navigation
  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };
  const isToday = new Date().toDateString() === selectedDate.toDateString();

  // Render Tabs
  const renderSchedule = () => (
    <div className="space-y-6">
      {/* Calendar Navigation Header */}
      <div className="glass-card p-6 border-l-4 border-l-teal-500 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Calendar Schedule</h3>
          <p className="text-white/60 text-sm">View and track medications by date.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[120px]">
            <span className="block text-white font-semibold">
              {isToday ? "Today" : selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {TIME_PERIODS.map(period => {
        const periodMeds = medications.filter(m => {
          if (!m.timeOfDay || !m.timeOfDay.includes(period)) return false;
          
          // Check if selectedDate is within start and end date
          const selDate = new Date(selectedDate);
          selDate.setHours(0,0,0,0);
          
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
        
        if (periodMeds.length === 0) return null;

        return (
          <div key={period} className="glass-card p-5">
            <h4 className="text-lg font-semibold text-teal-300 mb-4 flex items-center gap-2">
              <FiClock className="w-5 h-5" /> {period}
            </h4>
            <div className="space-y-3">
              {periodMeds.map(med => {
                const status = getLogStatus(med._id, period);
                return (
                  <div key={med._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 gap-4">
                    <div>
                      <h5 className="font-medium text-white text-lg">{med.medicineName}</h5>
                      <p className="text-white/50 text-sm">{med.dosage}</p>
                    </div>
                    <div className="flex gap-2">
                      {status === 'taken' ? (
                        <span className="px-4 py-2 bg-teal-500/20 text-teal-300 rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center">
                          <FiCheck /> Taken
                        </span>
                      ) : status === 'missed' ? (
                        <span className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center">
                          <FiX /> Missed
                        </span>
                      ) : (
                        <>
                          {status === 'overdue' && (
                            <span className="px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1.5 justify-center text-sm font-semibold sm:mr-2 animate-pulse">
                              ⚠️ Overdue
                            </span>
                          )}
                          <Button variant="secondary" onClick={() => handleLogDose(med._id, period, 'missed')} className="!px-3 !py-2 hover:!bg-red-500/20 hover:!text-red-300 border-red-500/30 flex-1 sm:flex-none justify-center">
                            <FiX /> Skip
                          </Button>
                          <Button onClick={() => handleLogDose(med._id, period, 'taken')} className="!px-3 !py-2 flex-1 sm:flex-none justify-center">
                            <FiCheck /> Take
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {medications.length === 0 && (
        <div className="text-center p-8 text-white/50">No medications scheduled.</div>
      )}
    </div>
  );

  const renderMedicationsList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center glass-card p-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Drug Information & Management</h2>
          <p className="text-white/50 text-sm">Add, edit, or delete prescriptions.</p>
        </div>
        {!isAdding && (
          <Button onClick={() => { setIsAdding(true); setEditingMed(null); setFormData(initialFormState); }} className="flex items-center gap-2">
            <FiPlusCircle className="w-5 h-5" /> Add Medication
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="glass-card p-6 bg-gradient-to-r from-blue-900/40 to-teal-900/20 border-teal-500/30 animate-fade-in">
          <h3 className="text-lg font-semibold text-white mb-4">{editingMed ? 'Edit Medication' : 'Add New Medication'}</h3>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="medicineName" name="medicineName" label="Medication Name *" required
                value={formData.medicineName} onChange={handleChange} placeholder="e.g. Aspirin"
              />
              <Input
                id="dosage" name="dosage" label="Dosage *" required
                value={formData.dosage} onChange={handleChange} placeholder="e.g. 1 tablet, 500mg"
              />
              
              <div>
                <label className="input-label">Frequency *</label>
                <select
                  name="frequency" value={formData.frequency} onChange={handleChange}
                  className="input-field"
                >
                  <option value="daily" className="bg-slate-800 text-white">Daily</option>
                  <option value="weekly" className="bg-slate-800 text-white">Weekly</option>
                  <option value="custom" className="bg-slate-800 text-white">Custom</option>
                </select>
              </div>

              <Input
                type="date" id="startDate" name="startDate" label="Start Date *" required
                value={formData.startDate} onChange={handleChange}
              />
              <Input
                type="date" id="endDate" name="endDate" label="End Date (Optional)"
                value={formData.endDate} onChange={handleChange}
              />
              
              <div className="md:col-span-2">
                <label className="input-label mb-2 block">Time of Day (Select all that apply) *</label>
                <div className="flex flex-wrap gap-3">
                  {TIME_PERIODS.map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeToggle(time)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        formData.timeOfDay.includes(time) 
                          ? 'bg-teal-500/20 border-teal-500 text-teal-300' 
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <Input
                  id="description" name="description" label="Drug Information / Description"
                  value={formData.description} onChange={handleChange} placeholder="What is this medication for?"
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  id="notes" name="notes" label="Doctor Instructions / Notes"
                  value={formData.notes} onChange={handleChange} placeholder="e.g. Take after meals with water"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
              <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); setEditingMed(null); }}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                {editingMed ? 'Update Medication' : 'Save Medication'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {medications.map(med => (
          <div key={med._id} className="glass-card p-5 relative hover:bg-white/[0.03] transition-colors group">
            
            {/* Actions (Edit/Delete) */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEditClick(med)}
                className="text-white/30 hover:text-teal-400 p-1"
                title="Edit Medication"
              >
                <FiEdit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(med._id)}
                className="text-white/30 hover:text-red-400 p-1"
                title="Delete Medication"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-teal-300 shrink-0`}>
                <FiPlusCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 pr-12">
                <h4 className="text-lg font-semibold text-white leading-tight">{med.medicineName}</h4>
                <p className="text-teal-400 font-medium text-sm mb-3">{med.dosage}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <FiClock className="w-3.5 h-3.5 text-teal-500/70" />
                    <span className="capitalize">{med.frequency} • {med.timeOfDay.join(', ')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <FiCalendar className="w-3.5 h-3.5 text-teal-500/70" />
                    <span>
                      {new Date(med.startDate).toLocaleDateString()} 
                      {med.endDate ? ` — ${new Date(med.endDate).toLocaleDateString()}` : ' (Ongoing)'}
                    </span>
                  </div>

                  {(med.description || med.notes) && (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 mt-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-teal-300 text-xs font-medium mb-1">
                        <FiInfo className="w-3.5 h-3.5" /> Drug Information
                      </div>
                      {med.description && <p className="text-white/70 text-xs">{med.description}</p>}
                      {med.notes && <p className="text-white/50 text-[11px] italic">Instructions: {med.notes}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {medications.length === 0 && !isAdding && (
          <div className="col-span-full text-center p-12 glass-card border-dashed border-white/10">
            <p className="text-white/50">No medications added yet.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="glass-card p-6">
      <h3 className="text-xl font-bold text-white mb-6">Full Medication History</h3>
      {fullHistory.length === 0 ? (
        <p className="text-white/50">No logs available yet.</p>
      ) : (
        <div className="space-y-3">
          {fullHistory.map(log => (
            <div key={log._id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <p className="text-white font-medium text-lg">{log.medicationId?.medicineName || 'Unknown Medication'}</p>
                <p className="text-white/50 text-sm">{new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} • {log.timeOfDay}</p>
              </div>
              <div>
                {log.status === 'taken' ? (
                  <span className="text-teal-400 bg-teal-400/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <FiCheck /> Taken
                  </span>
                ) : (
                  <span className="text-red-400 bg-red-400/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <FiX /> Missed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Medication Management">
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white/5 p-1.5 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'schedule' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2"><FiCalendar /> Calendar Schedule</span>
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2"><FiInfo /> Drug Information</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2"><FiActivity /> Full History</span>
          </button>
        </div>

        {isFetching ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'schedule' && renderSchedule()}
            {activeTab === 'list' && renderMedicationsList()}
            {activeTab === 'history' && renderHistory()}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default MedicationsPage;
