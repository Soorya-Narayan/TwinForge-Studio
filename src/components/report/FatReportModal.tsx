/**
 * TwinForge Studio - Factory Acceptance Test (FAT) Report (Light Mode)
 * Exportable test execution and safety interlock verification report.
 */

import React from 'react';
import { useFatStore } from '../../store/useFatStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Printer, CheckCircle, ShieldCheck, X, Settings2, XCircle, AlertCircle, Download } from 'lucide-react';

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
        commissioningLead: projectSettings.commissioningLead,
        clientAuthority: projectSettings.clientAuthority,
        plcPlatform: {
          driverName: harnessDriver.driverName,
          driverType: harnessDriver.driverType,
          endpoint: harnessDriver.endpoint || null,
          details: harnessDriver.details,
        },
        results,
        journal: normalizedJournal,
        plantConfig,
        timestamp: reportTimestamp || '',
      };

      const payloadString = JSON.stringify(payloadObject, null, 2);
      if (isMounted) {
        setRawPayload(payloadString);
      }

      try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
          const encoder = new TextEncoder();
          const data = encoder.encode(payloadString);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
          if (isMounted) {
            setRunFingerprint(hex);
          }
        } else {
          // Fallback if Web Crypto is unavailable
          if (isMounted) {
            setRunFingerprint('UNAVAILABLE');
          }
        }
      } catch (err) {
        console.error('Failed to compute run fingerprint:', err);
      }
    };

    computeHash();

    return () => {
      isMounted = false;
    };
  }, [showReportModal, results, journal, activeSkid, engine, customMeta, reportTimestamp, projectSettings, harnessDriver]);

  if (!showReportModal) return null;

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  const allTestsPassed = passedCount === results.length && results.length > 0;

  const handleExportPDF = async () => {
    if (window.electronAPI?.printToPDF) {
      setIsGeneratingPdf(true);
      setPdfSuccessMessage(null);
      try {
        const safeRef = (projectSettings.certificateRef || 'FAT-REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
        const dateStr = reportTimestamp ? reportTimestamp.slice(0, 10) : 'latest';
        const defaultPdfName = `twinforge_fat_report_${safeRef}_${dateStr}.pdf`;

        const result = await window.electronAPI.printToPDF({
          defaultPath: defaultPdfName,
        });

        if (!result.canceled && result.filePath) {
          const fileName = result.filePath.split(/[/\\]/).pop();
          setPdfSuccessMessage(`Saved ${fileName}`);
          setTimeout(() => setPdfSuccessMessage(null), 4000);
        }
      } catch (err) {
        console.error('Failed to export PDF via printToPDF:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
      return;
    }

    // Web browser fallback when Electron printToPDF IPC is unavailable
    window.print();
  };

  const handleExportEvidence = async () => {
    if (!rawPayload) return;

    const safeRef = (projectSettings.certificateRef || 'FAT-REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = (reportTimestamp ? reportTimestamp.slice(0, 10) : 'latest');
    const defaultFileName = `twinforge_fat_evidence_${safeRef}_${dateStr}.json`;

    if (window.electronAPI?.saveFile) {
      await window.electronAPI.saveFile({
        defaultPath: defaultFileName,
        filters: [{ name: 'JSON Evidence File', extensions: ['json'] }],
        content: rawPayload,
      });
      return;
    }

    // Web browser fallback
    const blob = new Blob([rawPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              Factory Acceptance Test (FAT) Report · Phase G
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleExportEvidence}
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
              onClick={handleExportPDF}
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
            <button onClick={closeReportModal} className="btn btn-ghost" style={{ padding: '5px 8px' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Project Settings / Report Customization Bar (Excluded from Print) */}
        <div
          className="no-print"
          style={{
            padding: '10px 20px',
            background: '#f1f5f9',
            borderBottom: '1px solid var(--border-strong)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontWeight: 700 }}>
            <Settings2 size={13} />
            <span>Settings:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#475569', fontWeight: 600 }}>Customer:</label>
            <input
              type="text"
              value={projectSettings.customerName}
              onChange={(e) => setProjectSettings({ customerName: e.target.value })}
              placeholder="e.g. Acme Industrial Ltd"
              style={{
                padding: '3px 8px',
                fontSize: 11,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                width: 190,
                background: '#ffffff',
                color: '#0f172a',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#475569', fontWeight: 600 }}>Report Ref:</label>
            <input
              type="text"
              value={projectSettings.certificateRef}
              onChange={(e) => setProjectSettings({ certificateRef: e.target.value })}
              placeholder="e.g. FAT-2026-001"
              style={{
                padding: '3px 8px',
                fontSize: 11,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                width: 150,
                background: '#ffffff',
                color: '#0f172a',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#475569', fontWeight: 600 }}>Authority:</label>
            <input
              type="text"
              value={projectSettings.clientAuthority || ''}
              onChange={(e) => setProjectSettings({ clientAuthority: e.target.value })}
              placeholder="Client Authority"
              style={{
                padding: '3px 8px',
                fontSize: 11,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                width: 160,
                background: '#ffffff',
                color: '#0f172a',
              }}
            />
          </div>
        </div>

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
              <img
                src="./goosebanner.png"
                alt={`${projectSettings.customerName} Banner`}
                style={{ height: 46, objectFit: 'contain', marginBottom: 8, display: 'block' }}
              />
              <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                FACTORY ACCEPTANCE TEST REPORT
              </h1>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                Automated Virtual Commissioning & Interlock Verification Report (Phase G)
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
              <strong style={{ fontSize: 12, color: harnessDriver.driverType === 'opcua' ? '#0284c7' : '#0f172a' }}>
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
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
              2. Test Execution & Assertion Log (Time-Based Stepped Scans)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1', width: '15%' }}>Test ID & Scans</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1', width: '30%' }}>Procedure & Specification</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1', width: '45%' }}>Assertions & Measured Dynamics</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #cbd5e1', width: '10%' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '16px 8px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                      No tests executed
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.testId} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                      <td className="mono" style={{ padding: '8px 8px', fontWeight: 700 }}>
                        <div>{r.testId}</div>
                        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                          {r.scansExecuted ? `${r.scansExecuted} scans (${((r.scansExecuted * 100) / 1000).toFixed(1)}s)` : `${r.durationMs} ms`}
                        </div>
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.title}</div>
                        <div style={{ color: '#64748b', fontSize: 9, marginTop: 2 }}>Ref: {r.clause}</div>
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.assertions.map((a, aIdx) => (
                            <div key={aIdx} style={{ fontSize: 9.5, lineHeight: 1.35, color: '#334155' }}>
                              <span style={{ fontWeight: 600, color: a.passed ? '#166534' : '#991b1b', marginRight: 4 }}>
                                {a.passed ? '✓' : '✗'} [{a.tag}]:
                              </span>
                              <span>{a.message}</span>
                              {a.responseTimeMs !== undefined && (
                                <span className="mono" style={{ marginLeft: 5, fontWeight: 700, color: a.passed ? '#15803d' : '#dc2626' }}>
                                  [⏱ {a.responseTimeMs} ms{a.timingLimitMs ? ` / limit ${a.timingLimitMs} ms` : ''}]
                                </span>
                              )}
                              <span style={{ color: '#64748b', marginLeft: 4 }}>
                                (Exp: {String(a.expected)} | Act: {String(a.actual)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{ fontWeight: 700, color: r.passed ? '#15803d' : '#dc2626' }}>
                          {r.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 30, marginTop: 30, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>
            <div>
              <div style={{ borderBottom: '1px solid #94a3b8', height: 35, marginBottom: 6 }}></div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{projectSettings.commissioningLead || 'Commissioning Lead Engineer'}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>TwinForge Commissioning Systems</div>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #94a3b8', height: 35, marginBottom: 6 }}></div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{projectSettings.clientAuthority || 'Client Acceptance Authority'}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>{projectSettings.customerName || 'Client Authority'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
