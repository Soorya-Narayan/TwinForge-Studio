import React from 'react';
import type { ReportProjectSettings } from '../../store/useFatStore';

interface FatReportSignaturesProps {
  projectSettings: ReportProjectSettings;
}

export const FatReportSignatures: React.FC<FatReportSignaturesProps> = ({ projectSettings }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 30, marginTop: 30, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>
      <div>
        <div style={{ borderBottom: '1px solid #94a3b8', height: 35, marginBottom: 6 }}></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
          {projectSettings.commissioningLead || 'Commissioning Lead Engineer'}
        </div>
        {projectSettings.organization && (
          <div style={{ fontSize: 9, color: '#64748b' }}>{projectSettings.organization}</div>
        )}
      </div>
      <div>
        <div style={{ borderBottom: '1px solid #94a3b8', height: 35, marginBottom: 6 }}></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
          {projectSettings.clientAuthority || 'Client Acceptance Authority'}
        </div>
        <div style={{ fontSize: 9, color: '#64748b' }}>{projectSettings.customerName || 'Client Authority'}</div>
      </div>
    </div>
  );
};
