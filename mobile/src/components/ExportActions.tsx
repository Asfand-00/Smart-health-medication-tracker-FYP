/**
 * Mobile replacement for components/ui/ExportButton.jsx.
 *
 *  - "Export CSV": the web builds a Blob and clicks a download link. On a phone
 *    the CSV from GET /adherence/export?format=csv is written to the cache
 *    directory and handed to the OS share sheet (Files, Drive, email, ...).
 *  - "PDF report": the web calls window.print() on the page. On a phone we
 *    build a printable HTML report from the existing GET /reports/export/pdf
 *    endpoint (which exists for exactly this) and render it with expo-print.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { errorMessage } from '../api/client';
import { adherenceApi, reportsApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import type { PdfReadyReport } from '../types/models';
import { formatDate, humanise, toDateKey } from '../utils/format';
import { Button } from './ui/Button';

export function ExportActions({ patientId }: { patientId?: string }) {
  const toast = useToast();
  const [csvBusy, setCsvBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const exportCsv = async () => {
    setCsvBusy(true);
    try {
      const csv = await adherenceApi.exportCsv(patientId);
      const filename = `adherence_report_${toDateKey(new Date())}.csv`;

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV report downloaded');
        return;
      }

      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share adherence report', UTI: 'public.comma-separated-values-text' });
      } else {
        toast.info(`Saved to ${file.uri}`);
      }
    } catch (e) {
      toast.error(`Failed to export CSV report. ${errorMessage(e)}`);
    } finally {
      setCsvBusy(false);
    }
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const report = await reportsApi.getPdfReady(patientId);
      const html = buildReportHtml(report);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share health report', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      toast.error(`Failed to create PDF report. ${errorMessage(e)}`);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Button title="Export CSV" icon="download-outline" variant="secondary" onPress={exportCsv} loading={csvBusy} style={styles.flex} />
      <Button title="PDF report" icon="document-text-outline" onPress={exportPdf} loading={pdfBusy} style={styles.flex} />
    </View>
  );
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReportHtml(r: PdfReadyReport): string {
  const rows = (items: string[][]) =>
    items.map((cells) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
 body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;padding:24px;font-size:12px}
 h1{font-size:20px;margin:0 0 4px;color:#1e3a8a} h2{font-size:14px;margin:20px 0 6px;border-bottom:2px solid #3b82f6;padding-bottom:4px}
 table{width:100%;border-collapse:collapse} td,th{border:1px solid #cbd5e1;padding:6px;text-align:left} th{background:#eff6ff}
 .muted{color:#64748b} .grid{display:flex;gap:12px} .box{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px}
 .big{font-size:18px;font-weight:700}
</style></head><body>
<h1>${esc(r.reportTitle)}</h1>
<div class="muted">Generated ${esc(formatDate(r.generatedAt, { dateStyle: 'long' }))}</div>
<h2>Patient</h2>
<table>${rows([
    ['Name', r.patientInfo.fullName],
    ['Age', String(r.patientInfo.age)],
    ['Gender', humanise(r.patientInfo.gender ?? '—')],
    ['Blood group', r.patientInfo.bloodGroup],
  ])}</table>
<h2>Adherence (last 30 days)</h2>
<div class="grid">
 <div class="box"><div class="muted">Adherence</div><div class="big">${esc(r.adherenceSummary.adherenceRate30Days)}%</div></div>
 <div class="box"><div class="muted">Scheduled</div><div class="big">${esc(r.adherenceSummary.totalScheduled)}</div></div>
 <div class="box"><div class="muted">Taken</div><div class="big">${esc(r.adherenceSummary.taken)}</div></div>
 <div class="box"><div class="muted">Missed</div><div class="big">${esc(r.adherenceSummary.missed)}</div></div>
 <div class="box"><div class="muted">Skipped</div><div class="big">${esc(r.adherenceSummary.skipped)}</div></div>
</div>
<h2>Risk assessment</h2>
<p><b>${esc(humanise(r.riskAssessment.overallRisk))}</b> (composite score ${esc(r.riskAssessment.compositeScore)})</p>
${r.riskAssessment.factors.length ? `<ul>${r.riskAssessment.factors.map((f) => `<li>${esc(f.factor)} — ${esc(f.description)}</li>`).join('')}</ul>` : '<p class="muted">No contributing risk factors.</p>'}
<h2>Current medications</h2>
${r.currentMedications.length ? `<table><tr><th>Name</th><th>Dosage</th><th>Frequency</th><th>Times</th></tr>${rows(r.currentMedications.map((m) => [m.name, m.dosage, m.frequency, m.times]))}</table>` : '<p class="muted">None.</p>'}
<h2>Recent vitals</h2>
${r.vitalsSummary.length ? `<table><tr><th>Date</th><th>BP</th><th>Heart rate</th><th>Temp</th></tr>${rows(r.vitalsSummary.map((v) => [formatDate(v.date), v.bp, v.heartRate != null ? String(v.heartRate) : '—', v.temp != null ? String(v.temp) : '—']))}</table>` : '<p class="muted">None recorded.</p>'}
<h2>Recent moods</h2>
${r.moodSummary.length ? `<table><tr><th>Date</th><th>Mood</th><th>Energy</th></tr>${rows(r.moodSummary.map((m) => [formatDate(m.date), humanise(m.mood), `${m.energy}/5`]))}</table>` : '<p class="muted">None recorded.</p>'}
</body></html>`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
