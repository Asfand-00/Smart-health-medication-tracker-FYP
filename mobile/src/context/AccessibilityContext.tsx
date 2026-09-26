/**
 * Alzheimer-friendly accessibility controls — port of
 * frontend/src/context/AccessibilityContext.jsx.
 *
 *  - highContrast  → swaps the palette (web: `.accessibility-contrast` class)
 *  - textSize      → scales every AppText (web: `.text-size-*` classes)
 *  - audioGuidance → text-to-speech via expo-speech (web: window.speechSynthesis)
 *
 * Persisted with AsyncStorage under the same keys the web app uses in localStorage.
 */
import * as Speech from 'expo-speech';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { buildTheme, TextSize, Theme } from '../theme';
import { prefsStorage, STORAGE_KEYS } from '../utils/storage';

/** The web app speaks at rate 0.85 "for cognitive accessibility". */
const SPEECH_RATE = 0.85;

interface AccessibilityValue {
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  textSize: TextSize;
  setTextSize: (v: TextSize) => void;
  audioGuidance: boolean;
  setAudioGuidance: (v: boolean) => void;
  /** Speaks only when audio guidance is on. */
  speakText: (text: string) => void;
  /** Speaks regardless of the setting (used where the web app does the same). */
  speakAlways: (text: string) => void;
  stopSpeaking: () => void;
  theme: Theme;
}

const AccessibilityContext = createContext<AccessibilityValue | null>(null);

const TEXT_SIZES: TextSize[] = ['normal', 'large', 'extra-large'];

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrastState] = useState(false);
  const [textSize, setTextSizeState] = useState<TextSize>('normal');
  const [audioGuidance, setAudioGuidanceState] = useState(false);

  useEffect(() => {
    (async () => {
      const [contrast, size, audio] = await Promise.all([
        prefsStorage.get(STORAGE_KEYS.contrast),
        prefsStorage.get(STORAGE_KEYS.textSize),
        prefsStorage.get(STORAGE_KEYS.audio),
      ]);
      setHighContrastState(contrast === 'true');
      if (size && (TEXT_SIZES as string[]).includes(size)) setTextSizeState(size as TextSize);
      setAudioGuidanceState(audio === 'true');
    })();
  }, []);

  const setHighContrast = useCallback((v: boolean) => {
    setHighContrastState(v);
    prefsStorage.set(STORAGE_KEYS.contrast, String(v));
  }, []);

  const setTextSize = useCallback((v: TextSize) => {
    setTextSizeState(v);
    prefsStorage.set(STORAGE_KEYS.textSize, v);
  }, []);

  const setAudioGuidance = useCallback((v: boolean) => {
    setAudioGuidanceState(v);
    prefsStorage.set(STORAGE_KEYS.audio, String(v));
  }, []);

  const speakAlways = useCallback((text: string) => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { rate: SPEECH_RATE });
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (audioGuidance) speakAlways(text);
    },
    [audioGuidance, speakAlways],
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
  }, []);

  const theme = useMemo(() => buildTheme(highContrast, textSize), [highContrast, textSize]);

  const value = useMemo(
    () => ({
      highContrast,
      setHighContrast,
      textSize,
      setTextSize,
      audioGuidance,
      setAudioGuidance,
      speakText,
      speakAlways,
      stopSpeaking,
      theme,
    }),
    [highContrast, setHighContrast, textSize, setTextSize, audioGuidance, setAudioGuidance, speakText, speakAlways, stopSpeaking, theme],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}

export function useTheme(): Theme {
  return useAccessibility().theme;
}

export function nextTextSize(current: TextSize): TextSize {
  const i = TEXT_SIZES.indexOf(current);
  return TEXT_SIZES[(i + 1) % TEXT_SIZES.length];
}
