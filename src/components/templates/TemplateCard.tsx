import React from 'react';
import type { SkidId } from '../../store/useSimulationStore';
import { CheckCircle2, ArrowRight, Shield } from 'lucide-react';

export interface TemplateMeta {
  id: SkidId;
  name: string;
  tagline: string;
  category: string;
  standard: string;
  throughput: string;
  ioCount: string;
  description: string;
  highlights: string[];
  keyTags: string[];
  status: 'PRODUCTION' | 'EXPERIMENTAL';
}

interface TemplateCardProps {
  template: TemplateMeta;
  isActive: boolean;
  onActivate: (id: SkidId) => void;
  onNavigate?: () => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template: tmpl,
  isActive,
  onActivate,
  onNavigate,
}) => {
  return (
    <div
      className="industrial-card"
      style={{
        borderRadius: 8,
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
        background: isActive ? '#f0f9ff' : '#ffffff',
        boxShadow: isActive ? '0 4px 14px rgba(2, 132, 199, 0.12)' : 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: isActive ? '#0284c7' : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#475569',
                  textTransform: 'uppercase',
                }}
              >
                {tmpl.category}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                {tmpl.standard}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
              {tmpl.name}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {tmpl.tagline}
            </div>
          </div>

          {isActive ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#dcfce7',
                border: '1px solid #86efac',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                color: '#15803d',
              }}
            >
              <CheckCircle2 size={13} />
              LOADED & ACTIVE
            </div>
          ) : (
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}
            >
              AVAILABLE
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '10px 0 16px 0' }}>
          {tmpl.description}
        </p>

        {/* Specs Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            background: isActive ? '#ffffff' : '#f8fafc',
            border: '1px solid var(--border-subtle)',
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Rated Throughput
            </div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {tmpl.throughput}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              PLC IO Configuration
            </div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', marginTop: 2 }}>
              {tmpl.ioCount}
            </div>
          </div>
        </div>

        {/* Technical Highlights */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, textTransform: 'uppercase' }}>
            Engineering Specifications
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tmpl.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>

        {/* Equipment Tags */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, textTransform: 'uppercase' }}>
            P&ID Tag Instruments
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tmpl.keyTags.map((tag) => (
              <span
                key={tag}
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: isActive ? '#e0f2fe' : '#f1f5f9',
                  border: '1px solid var(--border-subtle)',
                  color: isActive ? '#0369a1' : 'var(--text-secondary)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <Shield size={13} color="var(--color-primary)" />
          Hardware-In-The-Loop FAT Suite Enabled
        </div>

        {isActive ? (
          <button
            onClick={onNavigate}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700 }}
          >
            <span>OPEN SCADA MIMIC</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={() => onActivate(tmpl.id)}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700 }}
          >
            <span>LOAD PROCESS MODEL</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
