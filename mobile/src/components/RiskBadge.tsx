import { useTheme } from '../context/AccessibilityContext';
import type { RiskLevel } from '../types/models';
import { Pill } from './ui/Card';

const LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  moderate: 'Moderate Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

/** Port of components/ui/RiskBadge.jsx. */
export function RiskBadge({ level = 'low', score }: { level?: RiskLevel | null; score?: number }) {
  const { colors } = useTheme();
  const l: RiskLevel = level && level in LABELS ? level : 'low';
  const color = l === 'low' ? colors.success : l === 'moderate' ? colors.warning : l === 'high' ? colors.orange : colors.danger;
  return <Pill label={`${LABELS[l]}${score ? ` (${score})` : ''}`} color={color} filled={l === 'critical'} />;
}
