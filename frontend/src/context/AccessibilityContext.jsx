/**
 * ACCESSIBILITY CONTEXT — AccessibilityContext.jsx
 * ===================================================
 * Alzheimer-friendly UX adjustments: High contrast, large fonts, and text-to-speech audio guidance.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

export const AccessibilityProvider = ({ children }) => {
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem('accessibility-contrast') === 'true';
  });

  const [textSize, setTextSize] = useState(() => {
    return localStorage.getItem('accessibility-text-size') || 'normal'; // normal, large, extra-large
  });

  const [audioGuidance, setAudioGuidance] = useState(() => {
    return localStorage.getItem('accessibility-audio') === 'true';
  });

  // Apply CSS class modifiers on document root
  useEffect(() => {
    const root = document.documentElement;

    // Apply high contrast
    if (highContrast) {
      root.classList.add('accessibility-contrast');
    } else {
      root.classList.remove('accessibility-contrast');
    }
    localStorage.setItem('accessibility-contrast', highContrast);
  }, [highContrast]);

  useEffect(() => {
    const root = document.documentElement;
    
    // Reset font size classes
    root.classList.remove('text-size-large', 'text-size-extra-large');

    // Apply text size
    if (textSize === 'large') {
      root.classList.add('text-size-large');
    } else if (textSize === 'extra-large') {
      root.classList.add('text-size-extra-large');
    }
    localStorage.setItem('accessibility-text-size', textSize);
  }, [textSize]);

  useEffect(() => {
    localStorage.setItem('accessibility-audio', audioGuidance);
  }, [audioGuidance]);

  /**
   * TTS helper: Speaks text if audio guidance is enabled
   */
  const speakText = (text) => {
    if (!audioGuidance) return;
    const synth = window.speechSynthesis;
    if (synth && 'speechSynthesis' in window) {
      synth.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85; // Speak slightly slower for cognitive accessibility
      synth.speak(utterance);
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        highContrast,
        setHighContrast,
        textSize,
        setTextSize,
        audioGuidance,
        setAudioGuidance,
        speakText
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export default AccessibilityContext;
