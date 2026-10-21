/**
 * Charts — ports of the web's hand-drawn SVG (AdherenceChart.jsx and the
 * ProgressRing in PatientDashboard.jsx) using react-native-svg.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

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

/**
 * Simple line chart for a time series (vitals trends, adherence over time).
 * Optional normal-range band and every point labelled for touch (no hover).
 */
export function LineChart({
  points,
  color,
  unit = '',
  low,
  high,
  height = 180,
}: {
  points: { label: string; value: number }[];
  color: string;
  unit?: string;
  low?: number | null;
  high?: number | null;
  height?: number;
}) {
  const { colors, highContrast } = useTheme();
  if (points.length === 0) {
    return (
      <AppText tone="faint" align="center">
        No data in this period.
      </AppText>
    );
  }
  const width = 340;
  const padL = 38;
  const padR = 10;
  const padT = 14;
  const padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const values = points.map((p) => p.value);
  let min = Math.min(...values, low ?? Infinity);
  let max = Math.max(...values, high ?? -Infinity);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const x = (i: number) => padL + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const y = (v: number) => padT + chartH - ((v - min) / (max - min)) * chartH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const summary = points.map((p) => `${p.label} ${p.value}${unit}`).join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Trend: ${summary}`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {low != null && high != null ? (
          <Rect x={padL} y={y(high)} width={chartW} height={Math.max(0, y(low) - y(high))} fill={highContrast ? 'transparent' : `${colors.success}22`} stroke={highContrast ? colors.success : 'none'} strokeDasharray="3 3" />
        ) : null}
        {ticks.map((t, i) => (
          <G key={i}>
            <Line x1={padL} y1={y(t)} x2={width - padR} y2={y(t)} stroke={colors.border} strokeDasharray="4 4" />
            <SvgText x={padL - 6} y={y(t) + 4} fill={colors.textFaint} fontSize={10} textAnchor="end">
              {Math.round(t * 10) / 10}
            </SvgText>
          </G>
        ))}
        <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <G key={i}>
            <Circle cx={x(i)} cy={y(p.value)} r={3.5} fill={color} stroke={highContrast ? '#fff' : 'none'} />
            {i % labelEvery === 0 || i === points.length - 1 ? (
              <SvgText x={x(i)} y={padT + chartH + 16} fill={colors.textMuted} fontSize={10} textAnchor="middle">
                {p.label}
              </SvgText>
            ) : null}
          </G>
        ))}
      </Svg>
    </View>
  );
}

/** Compact vertical bars with labels (monthly performance, weekday patterns). */
export function BarChart({ data, color, max = 100, suffix = '%' }: { data: { label: string; value: number | null; sub?: string }[]; color: string | ((v: number) => string); max?: number; suffix?: string }) {
  const { colors, highContrast } = useTheme();
  if (!data.length) {
    return (
      <AppText tone="faint" align="center">
        No data.
      </AppText>
    );
  }
  const width = 340;
  const height = 190;
  const padL = 30;
  const padR = 8;
  const padT = 18;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const slot = chartW / data.length;
  const barW = Math.min(30, slot - 8);
  const colorFor = typeof color === 'function' ? color : () => color;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={data.map((d) => `${d.label} ${d.value ?? 'no data'}${d.value != null ? suffix : ''}`).join(', ')}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, max / 2, max].map((v) => {
          const yy = padT + chartH - (v / max) * chartH;
          return (
            <G key={v}>
              <Line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke={colors.border} strokeDasharray="4 4" />
              <SvgText x={padL - 5} y={yy + 4} fill={colors.textFaint} fontSize={10} textAnchor="end">
                {v}
              </SvgText>
            </G>
          );
        })}
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const h = d.value == null ? 0 : Math.max(3, (Math.min(max, v) / max) * chartH);
          const xx = padL + i * slot + (slot - barW) / 2;
          const yy = padT + chartH - h;
          return (
            <G key={i}>
              <Rect x={xx} y={yy} width={barW} height={h} rx={4} fill={d.value == null ? colors.surfaceAlt : colorFor(v)} stroke={highContrast ? '#fff' : 'none'} />
              <SvgText x={xx + barW / 2} y={yy - 4} fill={colors.text} fontSize={10} fontWeight="bold" textAnchor="middle">
                {d.value == null ? '–' : `${Math.round(v)}${suffix}`}
              </SvgText>
              <SvgText x={xx + barW / 2} y={padT + chartH + 15} fill={colors.textMuted} fontSize={10} textAnchor="middle">
                {d.label}
              </SvgText>
              {d.sub ? (
                <SvgText x={xx + barW / 2} y={padT + chartH + 28} fill={colors.textFaint} fontSize={9} textAnchor="middle">
                  {d.sub}
                </SvgText>
              ) : null}
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
