import React, { useEffect, useState } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';

export default function VoiceReminderPlayer({ text, autoPlay = true }) {
  const { audioGuidance, speakText } = useAccessibility();
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (autoPlay && audioGuidance && text) {
      handleSpeak();
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text, audioGuidance, autoPlay]);

  const handleSpeak = () => {
    if (!text) return;
    const synth = window.speechSynthesis;
    if (synth && 'speechSynthesis' in window) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.speak(utterance);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  if (!audioGuidance) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-blue-900/40 border border-blue-800/50 rounded-xl max-w-fit">
      <span className="text-xs text-blue-300 font-medium">🔊 Audio Helper:</span>
      {!isSpeaking ? (
        <button
          onClick={handleSpeak}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition active:scale-95"
        >
          🔊 Read Aloud
        </button>
      ) : (
        <button
          onClick={handleStop}
          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition active:scale-95 animate-pulse"
        >
          ⏹️ Stop Reading
        </button>
      )}
    </div>
  );
}
