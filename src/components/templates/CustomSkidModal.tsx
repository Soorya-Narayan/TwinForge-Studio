/**
 * TwinForge Studio - Custom Skid Template Studio & JSON Importer
 * Interactive live schema editor, file uploader, and instant physics deployment.
 */

import React, { useState, useMemo } from 'react';
import {
  validateCustomSkid,
  SAMPLE_CUSTOM_BOILERPLATE,
  type CustomSkidPackage,
} from '../../core/templates/customTemplateValidator';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Upload,
  Download,
  Code2,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Play,
  RotateCcw,
  X,
  FileCode,
} from 'lucide-react';

interface CustomSkidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploySuccess?: () => void;
}

export const CustomSkidModal: React.FC<CustomSkidModalProps> = ({
  isOpen,
  onClose,
  onDeploySuccess,
}) => {
  const setCustomSkid = useSimulationStore((s) => s.setCustomSkid);

  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE, null, 2)
  );

  // Real-time validation
  const validation = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      return validateCustomSkid(parsed);
    } catch (err: any) {
      return {
        valid: false,
        errors: [`JSON Syntax Error: ${err.message}`],
        warnings: [],
        stats: { tankCount: 0, valveCount: 0, pumpCount: 0, exchangerCount: 0, connectionCount: 0 },
      };
    }
  }, [jsonText]);

  if (!isOpen) return null;

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonText(content);
      }
    };
    reader.readAsText(file);
  };

  // Download Current JSON
  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `twinforge_custom_skid_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset to Sample Boilerplate
  const handleLoadBoilerplate = () => {
    setJsonText(JSON.stringify(SAMPLE_CUSTOM_BOILERPLATE, null, 2));
  };

  // Deploy to Simulator
  const handleDeploy = () => {
    if (!validation.valid) return;

    try {
      const parsed: CustomSkidPackage = JSON.parse(jsonText);
      const meta = parsed.meta ?? {
        id: 'CUSTOM_SKID',
        name: 'Custom Process Skid',
        category: 'Custom Skid Template',
      };
      const topology = parsed.topology ?? (parsed as any);

      setCustomSkid(topology, meta);

      if (onDeploySuccess) {
        onDeploySuccess();
      }
      onClose();
    } catch (err) {
      console.error('Failed to deploy custom skid:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="industrial-card"
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCode size={20} color="var(--color-primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Custom Skid Template Studio & JSON Importer
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                Import or author physical P&ID topologies for instant simulation, hydraulic flow calculation, and I/O tagging.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            padding: '10px 20px',
            background: '#ffffff',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Upload File Input */}
            <label className="btn btn-ghost" style={{ cursor: 'pointer', fontSize: 11 }}>
              <Upload size={13} />
              UPLOAD JSON FILE
              <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            <button onClick={handleDownloadJson} className="btn btn-ghost" style={{ fontSize: 11 }}>
              <Download size={13} />
              DOWNLOAD TEMPLATE
            </button>

            <button onClick={handleLoadBoilerplate} className="btn btn-ghost" style={{ fontSize: 11 }}>
              <RotateCcw size={13} />
              LOAD SAMPLE CIP SKID
            </button>
          </div>

          {/* Validation Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {validation.valid ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}>
                <CheckCircle2 size={12} />
                SCHEMA VALIDATED
              </span>
            ) : (
              <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}>
                <AlertOctagon size={12} />
                {validation.errors.length} SCHEMA ERRORS
              </span>
            )}
          </div>
        </div>

        {/* Main Body: Two Columns */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.4fr 1fr', minHeight: 0, overflow: 'hidden' }}>
          {/* Left Column: Monospace Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-strong)', background: '#f8fafc' }}>
            <div style={{ padding: '6px 14px', background: '#f1f5f9', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Code2 size={13} />
              JSON Plant Definition
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                padding: '14px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: 11.5,
                lineHeight: 1.5,
                background: '#ffffff',
                color: '#0f172a',
                overflowY: 'auto',
              }}
            />
          </div>

          {/* Right Column: Schema Inspector & Topology Diagnostics */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: 14, overflowY: 'auto', background: '#ffffff' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Topology Diagnostics
              </h4>
              <p style={{ margin: '4px 0 10px 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Components detected in active template schema:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Tanks / Vessels:</span>
                  <strong className="mono" style={{ fontSize: 14, color: '#0284c7' }}>{validation.stats.tankCount}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Pumps / Motive:</span>
                  <strong className="mono" style={{ fontSize: 14, color: '#059669' }}>{validation.stats.pumpCount}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Valves:</span>
                  <strong className="mono" style={{ fontSize: 14, color: '#d97706' }}>{validation.stats.valveCount}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Pipe Connections:</span>
                  <strong className="mono" style={{ fontSize: 14, color: '#475569' }}>{validation.stats.connectionCount}</strong>
                </div>
              </div>
            </div>

            {/* Errors List */}
            {validation.errors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  <AlertOctagon size={14} />
                  Validation Errors (Must Fix):
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#991b1b', lineHeight: 1.4 }}>
                  {validation.errors.map((err, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings List */}
            {validation.warnings.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  <AlertTriangle size={14} />
                  Advisory Warnings:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#92400e', lineHeight: 1.4 }}>
                  {validation.warnings.map((w, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Guidance Box */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12, marginTop: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Custom Skid Specification:
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Every pipe in <code>topology.connections</code> connects a source component (<code>fromNode</code>) to a target component (<code>toNode</code>). When started, fluid propagates deterministically through all passable valves and pumps.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px 14px' }}>
            CANCEL
          </button>
          <button
            onClick={handleDeploy}
            disabled={!validation.valid}
            className="btn btn-primary"
            style={{ padding: '6px 16px', opacity: validation.valid ? 1 : 0.5 }}
          >
            <Play size={14} />
            DEPLOY & SIMULATE SKID
          </button>
        </div>
      </div>
    </div>
  );
};
