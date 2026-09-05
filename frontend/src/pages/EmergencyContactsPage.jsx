import React, { useState, useEffect } from 'react';
import { FiPhone, FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiShield, FiMail, FiMessageSquare } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function EmergencyContactsPage() {
  const { user } = useAuth();
  const isCaregiver = user?.role === 'caregiver';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canReceiveAlerts, setCanReceiveAlerts] = useState(true);
  const [editingContactId, setEditingContactId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch overview if caregiver
  const fetchPatients = async () => {
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
    }
  };

  const fetchContacts = async (patientId) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await caregiverDashboardService.getEmergencyContacts(patientId);
      if (res.success) {
        setContacts(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch emergency contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCaregiver) {
      fetchPatients();
    } else if (user?._id) {
      setSelectedPatientId(user._id);
    }
  }, [isCaregiver, user]);

  useEffect(() => {
    if (selectedPatientId) {
      fetchContacts(selectedPatientId);
    }
  }, [selectedPatientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !relation || !phone) return;

    try {
      const contactData = {
        patientUserId: selectedPatientId,
        name,
        relation,
        phone,
        email,
        isPrimary,
        canReceiveAlerts
      };

      if (editingContactId) {
        const res = await caregiverDashboardService.updateEmergencyContact(editingContactId, contactData);
        if (res.success) {
          toast.success('Emergency contact updated successfully!');
        }
      } else {
        const res = await caregiverDashboardService.addEmergencyContact(contactData);
        if (res.success) {
          toast.success('Emergency contact added successfully!');
        }
      }

      // Reset form
      setName('');
      setRelation('');
      setPhone('');
      setEmail('');
      setIsPrimary(false);
      setCanReceiveAlerts(true);
      setEditingContactId(null);
      setShowForm(false);
      fetchContacts(selectedPatientId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save emergency contact.');
    }
  };

  const handleEdit = (contact) => {
    setEditingContactId(contact._id);
    setName(contact.name);
    setRelation(contact.relation);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setIsPrimary(contact.isPrimary);
    setCanReceiveAlerts(contact.canReceiveAlerts);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this emergency contact?')) return;
    try {
      const res = await caregiverDashboardService.deleteEmergencyContact(id);
      if (res.success) {
        toast.success('Emergency contact deleted.');
        fetchContacts(selectedPatientId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete contact.');
    }
  };

  const patientNav = [
    { to: '/dashboard/patient',                  icon: '🏠',       label: 'Dashboard' },
    { to: '/dashboard/patient/medical-profile',  icon: '❤️',      label: 'Medical Profile' },
    { to: '/medications',                        icon: '💊',       label: 'Medications' },
    { to: '/vitals',                             icon: '🩺',       label: 'Health Vitals' },
    { to: '/dashboard/patient/care-team',        icon: '👥',       label: 'Care Team' },
    { to: '/smart-reminders',                    icon: '🔔',       label: 'Smart Reminders' },
    { to: '/adherence',                          icon: '📈',       label: 'Adherence' },
    { to: '/mood',                               icon: '😊',       label: 'Mood Check' },
    { to: '/emergency-contacts',                 icon: '🚨',       label: 'Emergency Contacts' }
  ];

  const caregiverNav = [
    { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
    { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
    { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
    { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
    { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' },
    { to: '/dashboard/caregiver/cognitive',      icon: '🧠',       label: 'Cognitive Status' }
  ];

  const currentPatientName = isCaregiver && patients.find(p => p.patientId === selectedPatientId)
    ? `${patients.find(p => p.patientId === selectedPatientId).firstName} ${patients.find(p => p.patientId === selectedPatientId).lastName}`
    : 'Your';

  return (
    <DashboardLayout navItems={isCaregiver ? caregiverNav : patientNav} title="🚨 Emergency Contacts">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 select-none">
        
        {/* Banner */}
        <div className="glass-card p-6 bg-gradient-to-r from-rose-600/20 to-orange-600/10 border-rose-500/20 rounded-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <FiShield className="text-rose-450" /> Emergency Support Network
              </h2>
              <p className="text-white/60 text-xs sm:text-sm mt-1">
                Alzheimer-focused immediate dialers & medical escalation contacts. Tap to call instantly.
              </p>
            </div>
            <div className="text-4xl hidden sm:block">🚨</div>
          </div>
        </div>

        {/* Caregiver view selection bar */}
        {isCaregiver && patients.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-wrap items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Patient:</span>
            <div className="flex gap-2">
              {patients.map((p) => {
                const isSelected = p.patientId === selectedPatientId;
                return (
                  <button
                    key={p.patientId}
                    onClick={() => { setSelectedPatientId(p.patientId); setShowForm(false); setEditingContactId(null); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    {p.firstName} {p.lastName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Contacts Directory */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-900/50 p-4 border border-slate-850 rounded-2xl">
              <h3 className="text-sm font-extrabold text-slate-350 tracking-wide uppercase">
                {currentPatientName} Trusted Contacts ({contacts.length})
              </h3>
              {!showForm && (
                <button
                  onClick={() => { setShowForm(true); setEditingContactId(null); }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-3xs font-extrabold uppercase rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  <FiPlus /> Add Contact
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <span className="animate-spin text-slate-500">🌀</span>
              </div>
            ) : contacts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 text-lg">📁</div>
                <p className="text-xs text-slate-400 font-bold">No emergency contacts registered.</p>
                <p className="text-3xs text-slate-500">Create contacts that caregivers or patient can instantly notify during escalations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.map((c) => (
                  <div
                    key={c._id}
                    className={`bg-slate-900 border rounded-3xl p-5 shadow-lg flex flex-col justify-between gap-4 transition-transform hover:-translate-y-0.5 ${
                      c.isPrimary ? 'border-rose-550/40 bg-gradient-to-b from-rose-950/5 to-slate-900' : 'border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                          <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                            {c.name}
                            {c.isPrimary && (
                              <span className="px-2 py-0.5 bg-rose-600 border border-rose-500 text-white rounded text-3xs font-black uppercase tracking-wider">
                                Primary
                              </span>
                            )}
                          </h4>
                          <span className="text-3xs text-slate-400 mt-0.5 capitalize font-semibold">{c.relation}</span>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(c)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-blue-400 rounded-lg transition cursor-pointer"
                          >
                            <FiEdit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(c._id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-rose-455 rounded-lg transition cursor-pointer"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-4">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-slate-500"><FiPhone className="w-3.5 h-3.5" /></span>
                          <span className="font-bold">{c.phone}</span>
                        </div>
                        {c.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-350">
                            <span className="text-slate-500"><FiMail className="w-3.5 h-3.5" /></span>
                            <span>{c.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Instant Dial/SMS Actions - Highly visible & simplified for Alzheimer's patients */}
                    <div className="flex gap-2.5 border-t border-slate-850 pt-3.5 mt-2">
                      <a
                        href={`tel:${c.phone}`}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-2xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 text-center"
                      >
                        <FiPhone /> Call Now
                      </a>
                      {c.canReceiveAlerts && (
                        <span className="px-3 py-3 bg-rose-600/10 border border-rose-500/20 text-rose-400 text-3xs font-extrabold uppercase rounded-2xl flex items-center justify-center gap-1">
                          <FiMessageSquare /> Alerts On
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Creation / Update Sidebar Form */}
          <div className="lg:col-span-1">
            {showForm ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 sticky top-6">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingContactId ? '✏️ Edit Contact' : '➕ Add Trusted Contact'}
                  </h3>
                  <p className="text-xs text-slate-400">Save a reliable friend, relative, or doctor details.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                  <div>
                    <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Smith"
                      className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Relation</label>
                    <input
                      required
                      type="text"
                      value={relation}
                      onChange={(e) => setRelation(e.target.value)}
                      placeholder="e.g. Daughter, Spouse, Doctor"
                      className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +1 (555) 019-2834"
                      className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sarah@example.com"
                      className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Toggle inputs */}
                  <div className="flex flex-col gap-2.5 bg-slate-950/20 p-3.5 border border-slate-850 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrimary}
                        onChange={(e) => setIsPrimary(e.target.checked)}
                        className="rounded border-slate-750 text-rose-500 focus:ring-rose-550 focus:ring-offset-slate-900 bg-slate-850"
                      />
                      <span className="text-xs text-slate-350 font-bold">Mark as Primary Contact</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canReceiveAlerts}
                        onChange={(e) => setCanReceiveAlerts(e.target.checked)}
                        className="rounded border-slate-750 text-rose-500 focus:ring-rose-550 focus:ring-offset-slate-900 bg-slate-850"
                      />
                      <span className="text-xs text-slate-350 font-semibold">Enable Automated Adherence Alerts</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!name || !relation || !phone}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FiCheck /> {editingContactId ? 'Save Contact' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setEditingContactId(null); }}
                      className="px-4 py-3 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                    >
                      <FiX />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-850 rounded-3xl p-6 flex flex-col gap-4 text-center">
                <h4 className="font-bold text-white text-sm">Need help?</h4>
                <p className="text-3xs text-slate-400">
                  Primary contacts will be notified automatically if there are three consecutive unacknowledged medications or critical behavioral observations logged.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Create New Contact
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
