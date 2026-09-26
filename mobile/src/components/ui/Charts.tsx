/**
 * Charts — ports of the web's hand-drawn SVG (AdherenceChart.jsx and the
 * ProgressRing in PatientDashboard.jsx) using react-native-svg.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../../context/AccessibilityContext';
import type { DailyAdherencePoint } from '../../types/models';
import { AppText } from './AppText';

export function ProgressRing({
  percent,
  color,
  size = 84,
  stroke = 9,
  label,
  sub,
}: {
  percent: number;
  color: string;
  size?: number;
  stroke?: number;
  label: string;
  sub?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  return (
    <View
      style={styles.ringWrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}: ${clamped} percent${sub ? `, ${sub}` : ''}`}
    >
      <View style={{ width: size, height: size }}>
        {/* Rotated with a view transform: SVG `origin` is not a valid DOM attribute on web. */}
        <Svg width={size} height={size} style={styles.rotate}>
          <G>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surfaceAlt} strokeWidth={stroke} />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
          <AppText variant="heading" weight="800">
            {clamped}%
          </AppText>
        </View>
      </View>
      <AppText variant="caption" tone="muted" align="center" weight="600">
        {label}
      </AppText>
      {sub ? (
        <AppText variant="caption" tone="faint" align="center">
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

/** 7-day completion bars (AdherenceChart type="daily"). Values are always shown — no hover on touch. */
export function AdherenceBarChart({ data }: { data: DailyAdherencePoint[] }) {
  const { colors, highContrast } = useTheme();
  if (!data.length) {
    return (
      <AppText tone="faint" align="center">
        No chart data available for this range.
      </AppText>
    );
  }

  const width = 340;
  const height = 210;
  const padL = 34;
  const padR = 8;
  const padT = 20;
  const padB = 42;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const slot = chartW / data.length;
  const barW = Math.min(28, slot - 12);

  const colorFor = (rate: number) => (rate >= 80 ? colors.success : rate >= 50 ? colors.warning : colors.danger);
  const summary = data.map((d) => `${d.dayName} ${d.adherencePercent} percent`).join(', ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Seven day adherence: ${summary}`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 50, 100].map((v) => {
          const y = padT + chartH - (v / 100) * chartH;
          return (
            <G key={v}>
              <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={colors.border} strokeDasharray="4 4" />
              <SvgText x={padL - 6} y={y + 4} fill={colors.textFaint} fontSize={10} textAnchor="end">
                {`${v}%`}
              </SvgText>
            </G>
          );
        })}
        {data.map((d, i) => {
          const rate = d.adherencePercent || 0;
          const h = Math.max(4, (rate / 100) * chartH);
          const x = padL + i * slot + (slot - barW) / 2;
          const y = padT + chartH - h;
          return (
            <G key={d.date}>
              <Rect x={x} y={y} width={barW} height={h} rx={4} fill={colorFor(rate)} stroke={highContrast ? '#fff' : 'none'} />
              <SvgText x={x + barW / 2} y={y - 5} fill={colors.text} fontSize={10} fontWeight="bold" textAnchor="middle">
                {`${rate}%`}
              </SvgText>
              <SvgText x={x + barW / 2} y={padT + chartH + 16} fill={colors.textMuted} fontSize={11} textAnchor="middle">
                {d.dayName}
              </SvgText>
              <SvgText x={x + barW / 2} y={padT + chartH + 30} fill={colors.textFaint} fontSize={9} textAnchor="middle">
                {`${d.taken}/${d.total}`}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/** Horizontal percentage meter (risk breakdown bars). */
export function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View accessible accessibilityLabel={`${label}: ${v} percent`} style={styles.meter}>
      <View style={styles.meterHead}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        <AppText variant="caption" weight="700">
          {v}%
        </AppText>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.meterFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center', gap: 4, minWidth: 110, flex: 1 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  rotate: { transform: [{ rotate: '-90deg' }] },
  meter: { gap: 6 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  meterTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
});
