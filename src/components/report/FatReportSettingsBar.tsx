import React from 'react';
import { Settings2, Upload } from 'lucide-react';
import type { ReportProjectSettings } from '../../store/useFatStore';

interface FatReportSettingsBarProps {
  projectSettings: ReportProjectSettings;
  setProjectSettings: (settings: Partial<ReportProjectSettings>) => void;
}

export const FatReportSettingsBar: React.FC<FatReportSettingsBarProps> = ({
  projectSettings,
  setProjectSettings,
}) => {
  return (
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

      <div className="form-row-inline">
        <label className="form-label-subtle">Customer:</label>
        <input
          type="text"
          value={projectSettings.customerName}
          onChange={(e) => setProjectSettings({ customerName: e.target.value })}
          placeholder="e.g. Acme Industrial Ltd"
          className="form-input-scada"
          style={{ width: 190 }}
        />
      </div>

      <div className="form-row-inline">
        <label className="form-label-subtle">Report Ref:</label>
        <input
          type="text"
          value={projectSettings.certificateRef}
          onChange={(e) => {
            const val = e.target.value;
            setProjectSettings({
              certificateRef: val,
              isCustomRef: val.trim().length > 0,
            });
          }}
          placeholder="e.g. FAT-2026-001"
          className="form-input-scada"
          style={{ width: 150 }}
        />
      </div>

      <div className="form-row-inline">
        <label className="form-label-subtle">Authority:</label>
        <input
          type="text"
          value={projectSettings.clientAuthority || ''}
          onChange={(e) => setProjectSettings({ clientAuthority: e.target.value })}
          placeholder="Client Authority"
          className="form-input-scada"
          style={{ width: 160 }}
        />
      </div>

      <div className="form-row-inline">
        <label className="form-label-subtle">Lead:</label>
        <input
          type="text"
          value={projectSettings.commissioningLead || ''}
          onChange={(e) => setProjectSettings({ commissioningLead: e.target.value })}
          placeholder="Commissioning Lead"
          className="form-input-scada"
          style={{ width: 160 }}
        />
      </div>

      <div className="form-row-inline">
        <label className="form-label-subtle">Organization:</label>
        <input
          type="text"
          value={projectSettings.organization || ''}
          onChange={(e) => setProjectSettings({ organization: e.target.value })}
          placeholder="e.g. Lead Organization"
          className="form-input-scada"
          style={{ width: 160 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ color: '#475569', fontWeight: 600 }}>Logo:</label>
        <label
          className="btn btn-ghost"
          style={{
            padding: '3px 8px',
            fontSize: 11,
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            background: '#ffffff',
            color: '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Upload size={12} />
          {projectSettings.uploadedLogo ? 'Change Logo' : 'Upload Logo'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  setProjectSettings({ uploadedLogo: reader.result as string });
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </label>
        {projectSettings.uploadedLogo && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setProjectSettings({ uploadedLogo: '' })}
            style={{ padding: '2px 5px', fontSize: 10, color: '#ef4444' }}
            title="Remove Logo"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};
