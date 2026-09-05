import React from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';

export default function AccessibilityToggle() {
  const {
    highContrast,
    setHighContrast,
    textSize,
    setTextSize,
    audioGuidance,
    setAudioGuidance,
    speakText
  } = useAccessibility();

  const handleTextSizeCycle = () => {
    let nextSize = 'normal';
    if (textSize === 'normal') nextSize = 'large';
    else if (textSize === 'large') nextSize = 'extra-large';
    
    setTextSize(nextSize);
    
    // Announce the setting change if audio guidance is on
    const sizeLabels = { normal: 'Normal font size', large: 'Large font size', 'extra-large': 'Extra large font size' };
    setTimeout(() => {
      speakText(`${sizeLabels[nextSize]} selected.`);
    }, 100);
  };

  const toggleContrast = () => {
    setHighContrast(!highContrast);
    setTimeout(() => {
      speakText(!highContrast ? 'High contrast mode turned on.' : 'High contrast mode turned off.');
    }, 100);
  };

  const toggleAudio = () => {
    // If turning on, speak welcome
    if (!audioGuidance) {
      setAudioGuidance(true);
      setTimeout(() => {
        // Force speak even before state updates locally
        const synth = window.speechSynthesis;
        if (synth) {
          synth.cancel();
          const utterance = new SpeechSynthesisUtterance('Audio guidance and voice prompts are now turned on.');
          utterance.rate = 0.85;
          synth.speak(utterance);
        }
      }, 100);
    } else {
      speakText('Voice reminders turned off.');
      setAudioGuidance(false);
    }
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 backdrop-blur-md shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between accessibility-ignore-contrast">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>🧠</span> Alzheimer Accessibility Controls
        </h4>
        <p className="text-xs text-slate-400">Modify visual and audio options for a more readable, guided interface.</p>
      </div>

      <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
        {/* Text Size Button */}
        <button
          onClick={handleTextSizeCycle}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-700/60 hover:bg-slate-700 text-slate-100 border border-slate-600 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Change text scaling"
        >
          <span>🔍</span> Font Size: <span className="text-blue-400 capitalize">{textSize.replace('-', ' ')}</span>
        </button>

        {/* High Contrast Button */}
        <button
          onClick={toggleContrast}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm active:scale-95 ${
            highContrast
              ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold'
              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-100 border-slate-600'
          }`}
          title="Toggle High Contrast Theme"
        >
          <span>🌓</span> High Contrast: <span className={highContrast ? 'text-slate-950 font-bold' : 'text-amber-400'}>{highContrast ? 'ON' : 'OFF'}</span>
        </button>

        {/* Audio Guidance Button */}
        <button
          onClick={toggleAudio}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm active:scale-95 ${
            audioGuidance
              ? 'bg-blue-600 border-blue-700 text-white font-bold animate-pulse'
              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-100 border-slate-600'
          }`}
          title="Toggle Screen Speech Prompts"
        >
          <span>🔊</span> Voice Prompts: <span>{audioGuidance ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
}
