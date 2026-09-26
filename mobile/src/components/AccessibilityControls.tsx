import { View } from 'react-native';

import { nextTextSize, useAccessibility } from '../context/AccessibilityContext';
import { humanise } from '../utils/format';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ToggleRow } from './ui/Form';

/** Port of components/ui/AccessibilityToggle.jsx ("Alzheimer Accessibility Controls"). */
export function AccessibilityControls({ compact = false }: { compact?: boolean }) {
  const { highContrast, setHighContrast, textSize, setTextSize, audioGuidance, setAudioGuidance, speakText, speakAlways } =
    useAccessibility();

  const cycleSize = () => {
    const next = nextTextSize(textSize);
    setTextSize(next);
    speakText(`${humanise(next.replace('-', ' '))} font size selected.`);
  };

  const toggleContrast = (v: boolean) => {
    setHighContrast(v);
    speakText(v ? 'High contrast mode turned on.' : 'High contrast mode turned off.');
  };

  const toggleAudio = (v: boolean) => {
    if (v) {
      setAudioGuidance(true);
      speakAlways('Audio guidance and voice prompts are now turned on.');
    } else {
      speakText('Voice reminders turned off.');
      setAudioGuidance(false);
    }
  };

  return (
    <Card>
      {!compact && (
        <View>
          <AppText variant="heading">🧠 Alzheimer Accessibility Controls</AppText>
          <AppText variant="caption" tone="faint">
            Modify visual and audio options for a more readable, guided interface.
          </AppText>
        </View>
      )}
      <Button
        title={`Font size: ${humanise(textSize.replace('-', ' '))}`}
        icon="text"
        variant="secondary"
        onPress={cycleSize}
        accessibilityHint="Cycles between normal, large and extra large text"
      />
      <ToggleRow label="High contrast" description="Black background, white borders, bright accents" value={highContrast} onChange={toggleContrast} />
      <ToggleRow label="Voice prompts" description="Reads reminders and confirmations aloud" value={audioGuidance} onChange={toggleAudio} />
    </Card>
  );
}

