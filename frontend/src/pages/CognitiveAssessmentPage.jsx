import React, { useState, useEffect } from 'react';
import { FiPlus, FiActivity, FiArrowDown, FiArrowUp, FiUser, FiInfo, FiTrendingUp } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import { caregiverDashboardService } from '../api/caregiverDashboard.service';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/caregiver',                icon: '🏠',       label: 'Overview' },
  { to: '/dashboard/caregiver/monitoring',     icon: '👁️',       label: 'Monitoring' },
  { to: '/dashboard/caregiver/notes',          icon: '📝',       label: 'Notes Log' },
  { to: '/dashboard/caregiver/alerts',         icon: '🚨',       label: 'Alerts Hub' },
  { to: '/dashboard/caregiver/reports',        icon: '📊',       label: 'Reports & Risk' },
  { to: '/dashboard/caregiver/cognitive',      icon: '🧠',       label: 'Cognitive Status' }
];

export default function CognitiveAssessmentPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Assessment form state
  const [assessmentType, setAssessmentType] = useState('general');
  const [memoryScore, setMemoryScore] = useState(10);
  const [orientationScore, setOrientationScore] = useState(10);
  const [languageScore, setLanguageScore] = useState(10);
  const [attentionScore, setAttentionScore] = useState(10);
  const [observations, setObservations] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.error('Failed to load patient list.');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchAssessments = async (patientId) => {
    if (!patientId) return;
    setLoadingAssessments(true);
    try {
      const res = await caregiverDashboardService.getCognitiveAssessments(patientId);
      if (res.success) {
        setAssessments(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load cognitive assessments.');
    } finally {
      setLoadingAssessments(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchAssessments(selectedPatientId);
    }
  }, [selectedPatientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setIsSubmitting(true);
    try {
      const score = Number(memoryScore) + Number(orientationScore) + Number(languageScore) + Number(attentionScore);
      const res = await caregiverDashboardService.logCognitiveAssessment({
        patientUserId: selectedPatientId,
        assessmentType,
        memoryScore: Number(memoryScore),
        orientationScore: Number(orientationScore),
        languageScore: Number(languageScore),
        attentionScore: Number(attentionScore),
        score,
        maxScore: 40,
        observations,
        recommendations
      });

      if (res.success) {
        toast.success('Cognitive assessment logged successfully!');
        setObservations('');
        setRecommendations('');
        // Reset scores to default
        setMemoryScore(10);
        setOrientationScore(10);
        setLanguageScore(10);
        setAttentionScore(10);
        setAssessmentType('general');
        fetchAssessments(selectedPatientId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to log assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreClassification = (score) => {
    if (score >= 32) return { text: 'Normal / Mild', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-900' };
    if (score >= 20) return { text: 'Moderate Decline', color: 'text-amber-400 bg-amber-950/40 border-amber-900' };
    return { text: 'Severe Decline', color: 'text-rose-400 bg-rose-950/40 border-rose-900' };
  };

  const currentPatientName = patients.find(p => p.patientId === selectedPatientId)
    ? `${patients.find(p => p.patientId === selectedPatientId).firstName} ${patients.find(p => p.patientId === selectedPatientId).lastName}`
    : 'Patient';

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="🧠 Cognitive Status Monitoring">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto select-none">
        
        {/* Patient selection sidebar */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Patients list</h3>
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
                    onClick={() => { setSelectedPatientId(p.patientId); }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                        : 'bg-slate-950/20 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">{p.firstName} {p.lastName}</div>
                    {p.latestCognitive && (
                      <div className="text-3xs text-slate-400 mt-1">
                        Last Score: {p.latestCognitive.score}/40
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cognitive assessments core workspace */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-5 gap-6">
          
          {/* Left panel: Log assessment form */}
          <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 h-fit">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FiActivity className="text-blue-500" /> Log Cognitive Assessment
              </h3>
              <p className="text-xs text-slate-400">Evaluate {currentPatientName}'s cognitive state across 4 main areas.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Assessment Type</label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none"
                >
                  <option value="general">Daily Cognitive Checkup</option>
                  <option value="mini_mental">MMSE (Mini-Mental State Exam)</option>
                  <option value="clock_drawing">Clock Drawing Test</option>
                  <option value="verbal_fluency">Verbal Fluency Test</option>
                  <option value="memory_recall">Three-Word Recall</option>
                </select>
              </div>

              {/* Slider inputs for the 4 domains */}
              <div className="flex flex-col gap-3.5 bg-slate-950/20 p-4 border border-slate-850 rounded-2xl">
                <h4 className="text-xs font-bold text-slate-300">Domain Performance (0 - 10 Points)</h4>
                
                {/* Memory recall score */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Short-term Memory Recall</span>
                    <span className="text-blue-400 font-bold">{memoryScore}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={memoryScore}
                    onChange={(e) => setMemoryScore(e.target.value)}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-3xs text-slate-500 mt-0.5">Ability to recall recent items, medication purposes, or current events.</p>
                </div>

                {/* Spatial / Temporal Orientation score */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Temporal & Spatial Orientation</span>
                    <span className="text-blue-400 font-bold">{orientationScore}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={orientationScore}
                    onChange={(e) => setOrientationScore(e.target.value)}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-3xs text-slate-500 mt-0.5">Awareness of time (day, month, hour) and place (home, doctor's office).</p>
                </div>

                {/* Language / Comprehension score */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Language & Comprehension</span>
                    <span className="text-blue-400 font-bold">{languageScore}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={languageScore}
                    onChange={(e) => setLanguageScore(e.target.value)}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-3xs text-slate-500 mt-0.5">Understanding instructions, finding correct words, expressing clear thoughts.</p>
                </div>

                {/* Attention / Concentration score */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Concentration & Attention Span</span>
                    <span className="text-blue-400 font-bold">{attentionScore}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={attentionScore}
                    onChange={(e) => setAttentionScore(e.target.value)}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-3xs text-slate-500 mt-0.5">Focusing on simple tasks, counting, spelling backwards, or playing basic puzzles.</p>
                </div>
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Observations / Signs of Confusion</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Notes on verbal repetitions, disorientation signs, behavioral triggers..."
                  rows="3"
                  className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase mb-1">Recommendations / Coping Actions</label>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="e.g. increase visual cue cards, perform structured memory recall games..."
                  rows="2"
                  className="w-full bg-slate-850 border border-slate-700/80 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="bg-blue-600/10 border border-blue-500/20 p-3.5 rounded-2xl flex justify-between items-center">
                <span className="text-xs text-slate-300 font-bold">Total Composite Score:</span>
                <span className="text-lg font-black text-blue-400">
                  {Number(memoryScore) + Number(orientationScore) + Number(languageScore) + Number(attentionScore)} / 40
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedPatientId}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? 'Logging...' : 'Save Assessment Log'}
              </button>
            </form>
          </div>

          {/* Right panel: Assessment Log history list & trends */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FiTrendingUp className="text-teal-400" /> Assessment History
              </h3>
              <p className="text-xs text-slate-400">Track and monitor changes over time.</p>
            </div>

            {loadingAssessments ? (
              <div className="flex justify-center py-10">
                <span className="animate-spin text-slate-500">🌀</span>
              </div>
            ) : assessments.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-10">No assessments logged for this patient.</p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {assessments.map((a) => {
                  const classification = getScoreClassification(a.score);
                  const isDecline = a.declineFromPrevious !== null && a.declineFromPrevious > 0;
                  const isImprovement = a.declineFromPrevious !== null && a.declineFromPrevious < 0;

                  return (
                    <div key={a._id} className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 flex flex-col gap-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-extrabold text-slate-200 capitalize">
                            {a.assessmentType.replace('_', ' ')}
                          </span>
                          <span className="text-3xs text-slate-500">
                            {new Date(a.assessmentDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded border text-3xs font-extrabold uppercase tracking-wide ${classification.color}`}>
                          {a.score}/40
                        </span>
                      </div>

                      {/* Domain score breakout */}
                      <div className="grid grid-cols-4 gap-1.5 bg-slate-950/20 p-2 rounded-xl border border-slate-850">
                        <div className="text-center">
                          <div className="text-3xs text-slate-500">Mem</div>
                          <div className="text-xs font-bold text-slate-300">{a.memoryScore ?? '—'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xs text-slate-500">Ori</div>
                          <div className="text-xs font-bold text-slate-300">{a.orientationScore ?? '—'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xs text-slate-500">Lan</div>
                          <div className="text-xs font-bold text-slate-300">{a.languageScore ?? '—'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xs text-slate-500">Att</div>
                          <div className="text-xs font-bold text-slate-300">{a.attentionScore ?? '—'}</div>
                        </div>
                      </div>

                      {a.observations && (
                        <div>
                          <span className="block text-3xs font-bold text-slate-500 uppercase">Observations</span>
                          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{a.observations}</p>
                        </div>
                      )}

                      {a.recommendations && (
                        <div>
                          <span className="block text-3xs font-bold text-slate-500 uppercase">Recommendations</span>
                          <p className="text-xs text-blue-300 mt-0.5 leading-relaxed">{a.recommendations}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-850 text-3xs text-slate-500">
                        <span>Assessor: {a.assessedBy?.firstName} ({a.assessedByRole})</span>
                        {a.declineFromPrevious !== null && (
                          <span className={`font-bold flex items-center gap-0.5 ${isDecline ? 'text-rose-400' : isImprovement ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {isDecline && <FiArrowDown />}
                            {isImprovement && <FiArrowUp />}
                            {isDecline ? `Decline: ${a.declineFromPrevious}%` : isImprovement ? `Growth: ${Math.abs(a.declineFromPrevious)}%` : 'No Change'}
                          </span>
                        )}
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
