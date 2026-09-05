import React, { useState } from 'react';

const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy', color: 'hover:bg-emerald-950/40 hover:border-emerald-500' },
  { id: 'calm', emoji: '😌', label: 'Calm', color: 'hover:bg-teal-950/40 hover:border-teal-500' },
  { id: 'anxious', emoji: '😰', label: 'Anxious', color: 'hover:bg-yellow-950/40 hover:border-yellow-500' },
  { id: 'confused', emoji: '😕', label: 'Confused', color: 'hover:bg-amber-950/40 hover:border-amber-500' },
  { id: 'agitated', emoji: '😠', label: 'Agitated', color: 'hover:bg-orange-950/40 hover:border-orange-500' },
  { id: 'sad', emoji: '😢', label: 'Sad', color: 'hover:bg-blue-950/40 hover:border-blue-500' },
  { id: 'frustrated', emoji: '😣', label: 'Frustrated', color: 'hover:bg-rose-950/40 hover:border-rose-500' }
];

export default function MoodSelector({ onSelect, isLoading = false }) {
  const [selectedMood, setSelectedMood] = useState('');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedMood) return;
    onSelect({ mood: selectedMood, energyLevel, notes });
    // Reset
    setSelectedMood('');
    setNotes('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center md:text-left">
        <h3 className="text-xl md:text-2xl font-bold text-white">How are you feeling today?</h3>
        <p className="text-xs md:text-sm text-slate-400">Select the emoji that matches your mood right now.</p>
      </div>

      {/* Giant Emoji Grid */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        {MOODS.map((m) => {
          const isSelected = selectedMood === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMood(m.id)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-600/30 border-blue-500 scale-105'
                  : 'bg-slate-800/40 border-slate-800/80 ' + m.color
              }`}
            >
              <span className="text-4xl md:text-5xl mb-2">{m.emoji}</span>
              <span className={`text-xs md:text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Energy Level Selector */}
      <div className="flex flex-col gap-3 py-4 border-t border-slate-800">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-200">What is your energy level?</span>
          <span className="text-lg font-black text-blue-400">{energyLevel} / 5</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((level) => {
            const isActive = energyLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setEnergyLevel(level)}
                className={`flex-1 py-3 rounded-xl border-2 text-base font-black transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional text input */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-slate-200">Optional Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write anything you want your caregiver or doctor to know..."
          rows="2"
          className="w-full bg-slate-800 border border-slate-700/80 rounded-xl p-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={!selectedMood || isLoading}
        className={`w-full py-4 rounded-xl font-bold text-base transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
          selectedMood && !isLoading
            ? 'bg-blue-600 hover:bg-blue-500 text-white border-b-4 border-blue-800'
            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Saving Mood...' : 'Save Mood Log 💖'}
      </button>
    </form>
  );
}
