import React from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import VoiceReminderPlayer from './VoiceReminderPlayer';

export default function ReminderPopup({ reminder, onConfirm, onDelay, onSkip, onClose }) {
  const { speakText } = useAccessibility();

  if (!reminder) return null;

  const medicineName = reminder.medicationId?.medicineName || 'Medication';
  const dosage = reminder.medicationId?.dosage || 'prescribed amount';
  const notes = reminder.medicationId?.notes || '';
  const reminderId = reminder._id;

  const speechText = `Attention. It is time to take your medication: ${medicineName}, ${dosage}. ${
    notes ? `Instructions: ${notes}.` : ''
  } Please choose one of the buttons below to log your dose.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border-4 border-blue-500 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 text-center max-h-[90vh] overflow-y-auto">
        
        {/* Header Alert */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 bg-blue-600/20 border-2 border-blue-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
            🔔
          </div>
          <span className="text-sm font-bold tracking-wider text-blue-400 uppercase">Medication Alert</span>
        </div>

        {/* Medication Display */}
        <div className="flex flex-col gap-3 py-4 border-y border-slate-800">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            {medicineName}
          </h2>
          <p className="text-xl md:text-2xl font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-900/60 py-2.5 px-6 rounded-2xl max-w-max mx-auto">
            Dosage: {dosage}
          </p>
          {notes && (
            <div className="mt-2 p-4 bg-slate-800/80 border border-slate-700 rounded-2xl max-w-lg mx-auto">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Special Instructions</span>
              <p className="text-base text-slate-200 font-medium mt-1">{notes}</p>
            </div>
          )}
        </div>

        {/* Audio Helper */}
        <div className="flex justify-center">
          <VoiceReminderPlayer text={speechText} autoPlay={true} />
        </div>

        {/* Giant Tactile Confirm/Skip Buttons */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Taken Button - Giant Green */}
          <button
            onClick={() => onConfirm(reminderId, 'taken')}
            className="w-full py-6 md:py-8 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-2xl md:text-4xl rounded-2xl shadow-xl transition cursor-pointer border-b-8 border-emerald-700 flex items-center justify-center gap-3"
          >
            <span>✅</span> YES, I TOOK IT
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delay Button - Large Yellow */}
            <button
              onClick={() => onConfirm(reminderId, 'delayed')}
              className="py-4 md:py-6 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-lg md:text-2xl rounded-2xl shadow-md transition cursor-pointer border-b-6 border-amber-700 flex items-center justify-center gap-2"
            >
              <span>⏱️</span> TAKE LATER
            </button>

            {/* Skip Button - Large Red/Gray */}
            <button
              onClick={() => onConfirm(reminderId, 'skipped')}
              className="py-4 md:py-6 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-lg md:text-2xl rounded-2xl shadow-md transition cursor-pointer border-b-6 border-rose-800 flex items-center justify-center gap-2"
            >
              <span>❌</span> SKIP DOSE
            </button>
          </div>
        </div>

        {/* Close without action */}
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-sm font-semibold mt-2 underline cursor-pointer"
        >
          Dismiss reminder temporarily
        </button>
      </div>
    </div>
  );
}
