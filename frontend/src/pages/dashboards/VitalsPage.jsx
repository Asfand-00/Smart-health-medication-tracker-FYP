/**
 * VITALS PAGE — VitalsPage.jsx
 * =============================
 * Track health conditions like BP, Heart Rate, etc.
 */

import { useState, useEffect } from 'react';
import { FiHome, FiPlusCircle, FiCalendar, FiHeart, FiBell, FiTrendingUp, FiActivity, FiTrash2, FiClock } from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { vitalsService } from '../../api/vitals.service';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/patient', icon: FiHome,       label: 'Dashboard' },
  { to: '/dashboard/patient/medical-profile', icon: FiHeart, label: 'Medical Profile' },
  { to: '/medications',       icon: FiPlusCircle,  label: 'Medications' },
  { to: '/vitals',            icon: FiActivity,    label: 'Health Vitals' },
  { to: '/schedule',          icon: FiCalendar,    label: 'Schedule' },
  { to: '/reminders',         icon: FiBell,        label: 'Reminders' },
  { to: '/progress',          icon: FiTrendingUp,  label: 'Progress' },
];

const VitalsPage = () => {
  const [history, setHistory] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    systolic: '',
    diastolic: '',
    heartRate: '',
    bloodSugar: '',
    weight: '',
    temperature: '',
    oxygenLevel: '',
    note: '',
  });

  const fetchHistory = async () => {
    try {
      const { data } = await vitalsService.getHistory();
      setHistory(data || []);
    } catch (error) {
      toast.error('Failed to load vitals history');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        bloodPressure: {
          systolic: formData.systolic ? Number(formData.systolic) : undefined,
          diastolic: formData.diastolic ? Number(formData.diastolic) : undefined,
        },
        heartRate: formData.heartRate ? Number(formData.heartRate) : undefined,
        bloodSugar: formData.bloodSugar ? Number(formData.bloodSugar) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        temperature: formData.temperature ? Number(formData.temperature) : undefined,
        oxygenLevel: formData.oxygenLevel ? Number(formData.oxygenLevel) : undefined,
        note: formData.note,
      };
      
      await vitalsService.add(payload);
      toast.success('Vitals recorded successfully');
      setFormData({ systolic: '', diastolic: '', heartRate: '', bloodSugar: '', weight: '', temperature: '', oxygenLevel: '', note: '' });
      setIsAdding(false);
      fetchHistory();
    } catch (error) {
      toast.error('Failed to record vitals');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await vitalsService.delete(id);
      toast.success('Record deleted');
      setHistory(history.filter(h => h._id !== id));
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Health Vitals">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center glass-card p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Health Conditions</h2>
            <p className="text-white/50 text-sm">Track your body's vital signs over time.</p>
          </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2">
              <FiPlusCircle className="w-5 h-5" /> Record New Vitals
            </Button>
          )}
        </div>

        {/* Add Vitals Form */}
        {isAdding && (
          <div className="glass-card p-6 bg-gradient-to-r from-teal-900/40 to-blue-900/20 border-teal-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">New Health Entry</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input id="systolic" name="systolic" type="number" label="Systolic (Top)" value={formData.systolic} onChange={handleChange} placeholder="120" />
                <Input id="diastolic" name="diastolic" type="number" label="Diastolic (Bottom)" value={formData.diastolic} onChange={handleChange} placeholder="80" />
                <Input id="heartRate" name="heartRate" type="number" label="Heart Rate (bpm)" value={formData.heartRate} onChange={handleChange} placeholder="72" />
                <Input id="bloodSugar" name="bloodSugar" type="number" label="Blood Sugar (mg/dL)" value={formData.bloodSugar} onChange={handleChange} placeholder="95" />
                <Input id="weight" name="weight" type="number" label="Weight (kg)" value={formData.weight} onChange={handleChange} placeholder="70" />
                <Input id="oxygenLevel" name="oxygenLevel" type="number" label="Oxygen (SpO2 %)" value={formData.oxygenLevel} onChange={handleChange} placeholder="98" />
                <div className="md:col-span-3">
                   <Input id="note" name="note" label="Additional Notes" value={formData.note} onChange={handleChange} placeholder="e.g. Feeling a bit tired today" />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button type="submit" isLoading={isSaving}>Save Record</Button>
              </div>
            </form>
          </div>
        )}

        {/* History Table */}
        {isFetching ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="glass-card p-12 text-center border-dashed border-white/20">
            <h3 className="text-lg font-medium text-white mb-1">No vitals recorded</h3>
            <p className="text-white/40 text-sm">Start tracking your health today.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">BP (mmHg)</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Heart Rate</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Sugar</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Weight</th>
                    <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((record) => (
                    <tr key={record._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                        {new Date(record.recordedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                        {record.bloodPressure?.systolic}/{record.bloodPressure?.diastolic}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {record.heartRate || '-'} <span className="text-[10px] text-white/30">bpm</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {record.bloodSugar || '-'} <span className="text-[10px] text-white/30">mg/dL</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {record.weight || '-'} <span className="text-[10px] text-white/30">kg</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button onClick={() => handleDelete(record._id)} className="text-white/20 hover:text-red-400 transition-colors">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default VitalsPage;
