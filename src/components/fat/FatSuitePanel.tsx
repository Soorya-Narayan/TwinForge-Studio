/**
 * TwinForge Studio - Automated FAT Suite & Scan Journal (Light Mode)
 * Engineered for Factory Acceptance Testing verification and compliance audits.
 */

import React from 'react';
import { useFatStore } from '../../store/useFatStore';
import { Play, CheckCircle2, XCircle, FileText, Activity } from 'lucide-react';

export const FatSuitePanel: React.FC = () => {
  const scenarios = useFatStore((s) => s.scenarios);
  const results = useFatStore((s) => s.results);
  const currentTestIndex = useFatStore((s) => s.currentTestIndex);
  const isRunningSuite = useFatStore((s) => s.isRunningSuite);
  const journal = useFatStore((s) => s.journal);
  const runAllTests = useFatStore((s) => s.runAllTests);
  const runSingleTest = useFatStore((s) => s.runSingleTest);
  const openReportModal = useFatStore((s) => s.openReportModal);

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = scenarios.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, height: '100%' }}>
      {/* Left Column: Automated Test Procedures */}
      <div className="industrial-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Automated FAT Execution Station
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
              Deterministic test sequence generator mapped to Functional Design Specification (FDS).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={runAllTests}
              className="btn btn-primary"
              disabled={isRunningSuite}
            >
              <Play size={14} />
              {isRunningSuite ? 'EXECUTING SUITE...' : 'RUN FULL FAT SUITE'}
            </button>
            {results.length > 0 && (
              <button onClick={openReportModal} className="btn btn-success">
                <FileText size={14} />
                FAT REPORT
              </button>
            )}
          </div>
        </div>

        {/* Verification Summary Score */}
        {results.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-strong)', borderRadius: 4, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Verification Conformance:</span>
              <span className="mono" style={{ fontWeight: 700, color: passedCount === totalCount ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {passedCount} / {totalCount} PASSED ({(passedCount / totalCount * 100).toFixed(0)} %)
              </span>
            </div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(passedCount / totalCount) * 100}%`,
                  background: 'var(--color-success)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Test Scenarios List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scenarios.map((tc, idx) => {
            const result = results.find((r) => r.testId === tc.id);
            const isCurrent = currentTestIndex === idx;

            return (
              <div
                key={tc.id}
                style={{
                  padding: 12,
                  borderRadius: 4,
                  background: isCurrent ? '#f0f9ff' : '#ffffff',
                  border: `1px solid ${isCurrent ? '#0284c7' : result?.passed ? '#bbf7d0' : result?.passed === false ? '#fecaca' : 'var(--border-strong)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span className="mono badge badge-neutral" style={{ fontSize: 10 }}>
                      {tc.id}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {tc.title}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      [{tc.clause}]
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {tc.description}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result ? (
                    result.passed ? (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>
                        <CheckCircle2 size={12} /> PASS
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: 10 }}>
                        <XCircle size={12} /> FAIL
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => runSingleTest(tc.id)}
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      disabled={isRunningSuite}
                    >
                      EXECUTE
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Scan Journal & Event Evidence Timeline */}
      <div className="industrial-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--color-primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Scan-by-Scan Evidence Timeline
            </h3>
          </div>
          <span className="mono badge badge-neutral" style={{ fontSize: 10 }}>
            {journal.length} RECORDS
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
          {journal.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Execute a test procedure to view timestamped signal transitions, commands, and interlock assertions.
            </div>
          ) : (
            journal.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 4,
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `3px solid ${item.status === 'PASS' ? '#059669' : item.status === 'FAIL' ? '#dc2626' : '#0284c7'}`,
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 10 }}>
                  <span className="mono">SCAN #{item.scan} · {item.timeFormatted}</span>
                  <span className="mono" style={{ fontWeight: 700, color: item.source === 'PLC' ? '#4f46e5' : '#0284c7' }}>
                    [{item.source}]
                  </span>
                </div>
                <div style={{ color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {item.description}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
