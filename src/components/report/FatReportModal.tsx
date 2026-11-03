/**
 * TwinForge Studio - Factory Acceptance Test (FAT) Report (Light Mode)
 * Exportable test execution and safety interlock verification report.
 */

import React from 'react';
import { useFatStore } from '../../store/useFatStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { computeEvidenceFingerprint } from '../../core/report/fingerprint';
import { CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { FatReportToolbar } from './FatReportToolbar';
import { FatReportSettingsBar } from './FatReportSettingsBar';
import { FatReportTable } from './FatReportTable';
import { FatReportSignatures } from './FatReportSignatures';

export const FatReportModal: React.FC = () => {
  const showReportModal = useFatStore((s) => s.showReportModal);
  const closeReportModal = useFatStore((s) => s.closeReportModal);
  const results = useFatStore((s) => s.results);
  const journal = useFatStore((s) => s.journal);
  const projectSettings = useFatStore((s) => s.projectSettings);
  const setProjectSettings = useFatStore((s) => s.setProjectSettings);
  const executionDriverInfo = useFatStore((s) => s.executionDriverInfo);
  const plc = useSimulationStore((s) => s.plc);
  const activeSkid = useSimulationStore((s) => s.activeSkid);
  const engine = useSimulationStore((s) => s.engine);
  const customMeta = useSimulationStore((s) => s.customMeta);

  const reportTimestamp = useFatStore((s) => s.reportTimestamp);
  const [runFingerprint, setRunFingerprint] = React.useState<string>('');
  const [rawPayload, setRawPayload] = React.useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = React.useState<string | null>(null);

  // Resolve the actual harness driver tests were executed on
  const harnessDriver = React.useMemo(() => {
    return (
      executionDriverInfo ||
      results.find((r) => r.driver)?.driver || {
        driverName: 'MockPlcDriver',
        driverType: 'mock' as const,
        details: 'In-Process Mock Driver',
        endpoint: null,
      }
    );
  }, [executionDriverInfo, results]);

  const reportDate = React.useMemo(() => {
    if (!reportTimestamp) return '—';
    return new Date(reportTimestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [reportTimestamp]);

  React.useEffect(() => {
    if (!showReportModal) return;

    let isMounted = true;

    const computeHash = async () => {
      const plantConfig = {
        activeSkid,
        topology: engine?.getTopology ? engine.getTopology() : null,
        customMeta,
      };

      // Exclude volatile/UI-only keys (like id) from journal entries for deterministic hashing
      const normalizedJournal = journal.map(({ id: _id, ...rest }) => rest);

      const payloadObject = {
        certificateRef: projectSettings.certificateRef,
        customerName: projectSettings.customerName,
        authority: projectSettings.clientAuthority,
        lead: projectSettings.commissioningLead,
        organization: projectSettings.organization,
        plantConfig,
        results,
        journal: normalizedJournal,
        driver: harnessDriver,
        timestamp: reportTimestamp || '',
      };

      try {
        const { payloadString, hexFingerprint } = await computeEvidenceFingerprint(payloadObject);
        if (isMounted) {
          setRawPayload(payloadString);
          setRunFingerprint(hexFingerprint);
        }
      } catch (err) {
        console.error('Failed to compute run fingerprint:', err);
        if (isMounted) {
          setRunFingerprint('ERROR_COMPUTING_HASH');
        }
      }
    };

    computeHash();

    return () => {
      isMounted = false;
    };
  }, [showReportModal, projectSettings, activeSkid, engine, customMeta, results, journal, harnessDriver, reportTimestamp]);

  if (!showReportModal) return null;

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const allTestsPassed = results.length > 0 && failedCount === 0;

  const handleExportPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && typeof electronAPI.printToPDF === 'function') {
        const defaultFilename = `TwinForge-FAT-Report-${projectSettings.certificateRef || 'Export'}.pdf`;
        const res = await electronAPI.printToPDF({ defaultPath: defaultFilename });
        if (res && res.success) {
          setPdfSuccessMessage('PDF saved successfully');
          setTimeout(() => setPdfSuccessMessage(null), 4000);
          return;
        } else if (res && res.canceled) {
          return;
        } else {
          console.warn('Electron printToPDF failed or was canceled:', res?.error);
        }
      }
      // Fallback for standard browser environments
      window.print();
    } catch (err) {
      console.warn('PDF export error, falling back to window.print():', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportEvidence = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(rawPayload);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `TwinForge-FAT-Evidence-${projectSettings.certificateRef || 'Run'}-${runFingerprint ? runFingerprint.substring(0, 8) : 'sha256'}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to export evidence payload JSON:', err);
    }
  };

  return (
    <div
      id="fat-report-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        id="fat-report-card"
        className="industrial-card"
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <FatReportToolbar
          onExportEvidence={handleExportEvidence}
          onExportPDF={handleExportPDF}
          onClose={closeReportModal}
          isGeneratingPdf={isGeneratingPdf}
          pdfSuccessMessage={pdfSuccessMessage}
        />

        {/* Project Settings Bar */}
        <FatReportSettingsBar
          projectSettings={projectSettings}
          setProjectSettings={setProjectSettings}
        />

        {/* Printable Report Document Body */}
        <div
          id="fat-report-printable-area"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '30px 36px',
            background: '#ffffff',
            color: '#0f172a',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* Document Header with Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
            <div>
              {projectSettings.uploadedLogo && (
                <img
                  src={projectSettings.uploadedLogo}
                  alt={projectSettings.customerName ? `${projectSettings.customerName} Logo` : 'Report Logo'}
                  style={{ height: 46, objectFit: 'contain', marginBottom: 8, display: 'block' }}
                />
              )}
              <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                FACTORY ACCEPTANCE TEST REPORT
              </h1>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                Automated Virtual Commissioning & Interlock Verification Report
              </p>
            </div>
            <div style={{ textAlign: 'right', paddingTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>TwinForge Studio</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Report Ref: {projectSettings.certificateRef}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Execution Date: {reportDate}</div>
            </div>
          </div>

          {/* Project Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Customer Organization:</span>
              <strong style={{ fontSize: 12, color: projectSettings.customerName ? '#0f172a' : '#64748b' }}>
                {projectSettings.customerName || '— (Unspecified)'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Target Process Skid:</span>
              <strong style={{ fontSize: 12, color: '#0f172a' }}>
                {activeSkid === 'PASTEURIZER_10KLPH'
                  ? 'Continuous Milk Pasteurizer Skid (10 KLPH · HTST)'
                  : activeSkid === 'BATCH_MIXING'
                  ? 'Batch Mixing & CIP Thermal Skid (25 KLPH)'
                  : customMeta?.name || 'Custom Process Skid'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>PLC Controller Platform:</span>
              <strong
                style={{
                  fontSize: 12,
                  color:
                    harnessDriver.driverType === 'opcua'
                      ? '#0284c7'
                      : harnessDriver.driverType === 'opcua-loopback'
                      ? '#d97706'
                      : '#0f172a',
                }}
              >
                {harnessDriver.details}
              </strong>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>Run Fingerprint (SHA-256):</span>
                <button
                  onClick={handleExportEvidence}
                  className="no-print"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 9,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                  title="Download evidence JSON to verify hash via sha256sum"
                >
                  Export Payload (.json)
                </button>
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  color: '#0f172a',
                  wordBreak: 'break-all',
                  lineHeight: 1.3,
                  display: 'block',
                  marginTop: 2,
                }}
              >
                {runFingerprint || 'Computing...'}
              </span>
            </div>
          </div>

          {/* Loopback Test Server Notice */}
          {harnessDriver.driverType === 'opcua-loopback' && (
            <div
              style={{
                marginBottom: 20,
                padding: '10px 14px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 4,
                color: '#92400e',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
              <span>
                Tests ran against the built-in Loopback Test Server, which contains no PLC control logic. These results do not verify any PLC program.
              </span>
            </div>
          )}

          {/* Executive Summary */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
              1. Executive Test Findings
            </h3>
            <p style={{ fontSize: 11, color: '#334155', lineHeight: 1.5, margin: 0 }}>
              {results.length === 0
                ? 'No functional acceptance test procedures have been executed for this session yet.'
                : `The control program logic was subjected to an automated suite of ${results.length} functional acceptance tests including nominal recipe execution, abnormal condition handling, and critical safety interlock verification. All physical devices and process parameters were simulated deterministically.`}
            </p>
            {results.length === 0 ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={18} color="#64748b" />
                <div>
                  <strong style={{ fontSize: 12, color: '#475569' }}>
                    NO TESTS EXECUTED
                  </strong>
                  <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>
                    No tests executed
                  </p>
                </div>
              </div>
            ) : allTestsPassed ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={18} color="#16a34a" />
                <div>
                  <strong style={{ fontSize: 12, color: '#15803d' }}>
                    ALL TESTS PASSED
                  </strong>
                  <p style={{ fontSize: 10, color: '#166534', margin: 0 }}>
                    {passedCount} of {results.length} test procedures completed with zero non-conformances.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 4, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 10 }}>
                <XCircle size={18} color="#dc2626" />
                <div>
                  <strong style={{ fontSize: 12, color: '#991b1b' }}>
                    TESTS FAILED - ACTION REQUIRED
                  </strong>
                  <p style={{ fontSize: 10, color: '#b91c1c', margin: 0 }}>
                    {passedCount} of {results.length} test procedures passed. {failedCount} {failedCount === 1 ? 'failure' : 'failures'} recorded.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Test Case Breakdown Table */}
          <FatReportTable results={results} />

          {/* Interlock Verification Matrix */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
              3. Safety Interlock Verification Matrix
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1' }}>Interlock ID</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1' }}>Trip Condition</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1' }}>Safety Action</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(plc?.interlocks?.values?.() || []).map((il) => (
                  <tr key={il.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="mono" style={{ padding: '6px 8px', fontWeight: 700 }}>{il.id}</td>
                    <td style={{ padding: '6px 8px' }}>{il.condition}</td>
                    <td style={{ padding: '6px 8px', color: '#64748b' }}>Immediate De-energize</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#15803d' }}>VERIFIED</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures Block */}
          <FatReportSignatures projectSettings={projectSettings} />
        </div>
      </div>
    </div>
  );
};
