/**
 * DAILY VITALS MODAL — DailyVitalsModal.jsx
 * ===========================================
 * Shown once per day when a patient logs in and hasn't
 * recorded their vitals yet. Alzheimer-friendly design:
 * large text, simple fields, clear action button.
 */

import { useState } from 'react';
import { FiX, FiHeart, FiActivity } from 'react-icons/fi';
import { vitalsService } from '../../api/vitals.service';
import toast from 'react-hot-toast';

const DailyVitalsModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    bloodSugar: '',
    weight: '',
    oxygenLevel: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        bloodPressure: {
          systolic: form.bloodPressureSystolic ? Number(form.bloodPressureSystolic) : undefined,
          diastolic: form.bloodPressureDiastolic ? Number(form.bloodPressureDiastolic) : undefined,
        },
        heartRate: form.heartRate ? Number(form.heartRate) : undefined,
        bloodSugar: form.bloodSugar ? Number(form.bloodSugar) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        oxygenLevel: form.oxygenLevel ? Number(form.oxygenLevel) : undefined,
        note: form.note || undefined,
      };

      await vitalsService.add(payload);
      toast.success('Vitals recorded! Great job! 💪');
      onSaved(); // Tell parent to refresh
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save vitals');
    } finally {
      setSaving(false);
    }
  };

  // Simple labeled input for Alzheimer-friendly clarity
  const Field = ({ label, name, placeholder, unit }) => (
    <div>
      <label className="block text-white/70 text-base font-medium mb-1.5">
        {label} {unit && <span className="text-white/30 text-sm">({unit})</span>}
      </label>
      <input
        type="number"
        name={name}
        value={form[name]}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-white/20 focus:outline-none focus:border-teal-500 transition-colors"
      />
    </div>
  );

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center">
              <FiHeart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Daily Health Check</h2>
              <p className="text-white/40 text-sm">Record your vitals for today</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Blood Pressure — side by side */}
          <div>
            <label className="block text-white/70 text-base font-medium mb-1.5">
              Blood Pressure <span className="text-white/30 text-sm">(mmHg)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number" name="bloodPressureSystolic"
                value={form.bloodPressureSystolic} onChange={handleChange}
                placeholder="Systolic (e.g. 120)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-teal-500 transition-colors"
              />
              <input
                type="number" name="bloodPressureDiastolic"
                value={form.bloodPressureDiastolic} onChange={handleChange}
                placeholder="Diastolic (e.g. 80)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          <Field label="Heart Rate"    name="heartRate"   placeholder="e.g. 72"  unit="bpm" />
          <Field label="Blood Sugar"   name="bloodSugar"  placeholder="e.g. 90"  unit="mg/dL" />
          <Field label="Weight"        name="weight"      placeholder="e.g. 70"  unit="kg" />
          <Field label="Oxygen Level"  name="oxygenLevel" placeholder="e.g. 98"  unit="SpO2 %" />

          <div>
            <label className="block text-white/70 text-base font-medium mb-1.5">Note <span className="text-white/30 text-sm">(optional)</span></label>
            <textarea
              name="note" value={form.note} onChange={handleChange}
              placeholder="How are you feeling today?"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-teal-500 transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-base"
            >
              Skip for Now
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 text-white font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><FiActivity /> Save Vitals</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DailyVitalsModal;
