import React from 'react';
import { ShieldCheck, Download, Printer, CheckCircle, X } from 'lucide-react';

interface FatReportToolbarProps {
  onExportEvidence: () => void;
  onExportPDF: () => void;
  onClose: () => void;
  isGeneratingPdf: boolean;
  pdfSuccessMessage: string | null;
}

export const FatReportToolbar: React.FC<FatReportToolbarProps> = ({
  onExportEvidence,
  onExportPDF,
  onClose,
  isGeneratingPdf,
  pdfSuccessMessage,
}) => {
  return (
    <div
      className="no-print"
      style={{
        padding: '12px 20px',
        background: '#f8fafc',
        borderBottom: '1px solid var(--border-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={18} color="var(--color-success)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          Factory Acceptance Test (FAT) Report
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onExportEvidence}
          className="btn btn-ghost"
          style={{
            padding: '5px 12px',
            fontSize: 11,
            border: '1px solid var(--border-strong)',
            background: '#ffffff',
            color: 'var(--text-primary)',
          }}
          title="Export serialized JSON payload to verify SHA-256 checksum independently"
        >
          <Download size={13} />
          EXPORT EVIDENCE JSON
        </button>
        {pdfSuccessMessage && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-success)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginRight: 4,
            }}
          >
            <CheckCircle size={12} />
            {pdfSuccessMessage}
          </span>
        )}
        <button
          onClick={onExportPDF}
          disabled={isGeneratingPdf}
          className="btn btn-primary"
          style={{
            padding: '5px 12px',
            fontSize: 11,
            opacity: isGeneratingPdf ? 0.75 : 1,
            cursor: isGeneratingPdf ? 'wait' : 'pointer',
          }}
          title="Generate a real PDF report using Electron webContents.printToPDF"
        >
          <Printer size={13} />
          {isGeneratingPdf ? 'GENERATING PDF...' : 'EXPORT PDF'}
        </button>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
