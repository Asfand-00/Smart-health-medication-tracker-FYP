import { useTheme } from '../context/AccessibilityContext';
import type { PrescriptionStatus } from '../types/models';
import { Pill } from './ui/Card';

export function PrescriptionStatusPill({ status }: { status: PrescriptionStatus }) {
  const { colors } = useTheme();
  const color = status === 'verified' ? colors.success : status === 'rejected' ? colors.danger : status === 'expired' ? colors.textFaint : colors.warning;
  const label = status === 'pending' ? 'Awaiting verification' : status;
  return <Pill label={label} color={color} />;
}
