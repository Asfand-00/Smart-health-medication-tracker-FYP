import React, { useState } from 'react';
import { adherenceService } from '../../api/adherence.service';
import toast from 'react-hot-toast';

export default function ExportButton({ patientId, className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleExportCsv = async () => {
    setLoading(true);
    try {
      const data = await adherenceService.exportData({
        patientId,
        format: 'csv'
      });

      // Create downloadable blob
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `adherence_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV report downloaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export CSV report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* CSV Export */}
      <button
        onClick={handleExportCsv}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl shadow transition cursor-pointer"
      >
        <span>📥</span> {loading ? 'Exporting...' : 'Export CSV'}
      </button>

      {/* Browser PDF Print */}
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
      >
        <span>🖨️</span> Print / PDF Report
      </button>
    </div>
  );
}
