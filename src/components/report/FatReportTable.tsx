import React from 'react';
import type { TestResult } from '../../core/testgen/types';

interface FatReportTableProps {
  results: TestResult[];
}

export const FatReportTable: React.FC<FatReportTableProps> = ({ results }) => {
  return (
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
                    {r.timeDriftMs !== undefined && r.timeDriftMs > 0 && (
                      <div style={{ fontSize: 8.5, color: '#0284c7', marginTop: 1 }}>
                        +{r.timeDriftMs}ms drift ({r.timeAdvanceMode === 'measured' ? 'sync' : 'nominal'})
                      </div>
                    )}
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
                            [⏱ {a.responseTimeMs} ms{a.timingLimitMs ? ` / limit ${a.timingLimitMs} ms` : ''}{a.timingToleranceMs ? ` (tol +${a.timingToleranceMs}ms)` : ''}]
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
  );
};
