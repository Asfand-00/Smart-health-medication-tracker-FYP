import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit, FiSave, FiX } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
  { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
  { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
  { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
  { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' }
];

export default function CaregiverNotesPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [notes, setNotes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Note form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [severity, setSeverity] = useState('low');
  const [editingNoteId, setEditingNoteId] = useState(null);

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
      toast.error('Failed to load patient overview.');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchNotes = async (patientId) => {
    if (!patientId) return;
    setLoadingNotes(true);
    try {
      const res = await caregiverDashboardService.getNotes(patientId);
      if (res.success) {
        setNotes(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load caregiver notes.');
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchNotes(selectedPatientId);
    }
  }, [selectedPatientId]);

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!title || !content) return;
    try {
      if (editingNoteId) {
        // Edit existing
        const res = await caregiverDashboardService.updateNote(editingNoteId, {
          title, content, noteType, severity
        });
        if (res.success) {
          toast.success('Note updated!');
          setEditingNoteId(null);
        }
      } else {
        // Create new
        const res = await caregiverDashboardService.addNote({
          patientUserId: selectedPatientId,
          title, content, noteType, severity
        });
        if (res.success) {
          toast.success('Caregiver note added successfully');
        }
      }
      setTitle('');
      setContent('');
      setNoteType('general');
      setSeverity('low');
      fetchNotes(selectedPatientId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save caregiver note.');
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    setTitle(note.title);
    setContent(note.content);
    setNoteType(note.noteType);
    setSeverity(note.severity);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setNoteType('general');
    setSeverity('low');
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await caregiverDashboardService.deleteNote(id);
      if (res.success) {
        toast.success('Note deleted.');
        fetchNotes(selectedPatientId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete note.');
    }
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="📝 Caregiver Notes Log">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto select-none">
        
        {/* Left column: Patients List Selection */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Patient Logbooks</h3>
          {loadingList ? (
            <div className="flex justify-center py-6">
              <span className="animate-spin text-slate-500">🌀</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {patients.map((p) => {
                const isSelected = p.patientId === selectedPatientId;
                return (
                  <button
                    key={p.patientId}
                    onClick={() => { setSelectedPatientId(p.patientId); handleCancelEdit(); }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                        : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">{p.firstName} {p.lastName}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Notes workspace */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Notes logger form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 h-fit">
            <h3 className="text-base font-bold text-white">
              {editingNoteId ? '✏️ Edit Caregiver Note' : '📝 Write New Note'}
            </h3>
            <form onSubmit={handleSaveNote} className="flex flex-col gap-3">
              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Title</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Morning cognitive confusion"
                  className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Note Type</label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="general">General Note</option>
                    <option value="medication">Medication Log</option>
                    <option value="cognitive">Cognitive Status</option>
                    <option value="behavioral">Behavioral Observation</option>
                    <option value="safety">Safety Check</option>
                    <option value="daily_report">Daily Log</option>
                  </select>
                </div>
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="low">Low Severity</option>
                    <option value="medium">Medium Severity</option>
                    <option value="high">High Severity</option>
                    <option value="critical">Critical Severity</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Content</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Explain your patient notes and medical observations in detail..."
                  rows="5"
                  className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-3 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!title || !content}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FiSave /> {editingNoteId ? 'Save Edits' : 'Save Note'}
                </button>
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-3 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                  >
                    <FiX />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Past notes feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            <div>
              <h3 className="text-base font-bold text-white">Log History</h3>
              <p className="text-xs text-slate-400">Past logs & observation logs.</p>
            </div>

            {loadingNotes ? (
              <div className="flex justify-center py-10">
                <span className="animate-spin text-slate-500">🌀</span>
              </div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-10">No notes written for this patient.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {notes.map((n) => {
                  const labelColor = 
                    n.severity === 'critical' ? 'text-rose-400 bg-rose-950/40 border-rose-900' :
                    n.severity === 'high' ? 'text-orange-400 bg-orange-950/40 border-orange-900' :
                    n.severity === 'medium' ? 'text-amber-400 bg-amber-950/40 border-amber-900' :
                    'text-emerald-400 bg-emerald-950/40 border-emerald-900';

                  return (
                    <div key={n._id} className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-sm font-bold text-white">{n.title}</h4>
                          <span className="text-3xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditNote(n)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-blue-400 rounded-lg transition cursor-pointer"
                          >
                            <FiEdit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n._id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-rose-450 rounded-lg transition cursor-pointer"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 font-medium leading-relaxed">{n.content}</p>

                      <div className="flex gap-1.5 mt-1">
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded text-3xs font-semibold text-slate-400 capitalize">
                          {n.noteType}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-3xs font-extrabold uppercase tracking-widest ${labelColor}`}>
                          {n.severity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
