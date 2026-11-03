import React from 'react';
import type { CustomSkidMeta } from '../../core/templates/customTemplateValidator';
import type { PlantTopology } from '../../core/engine/PhysicsEngine';
import {
  CheckCircle2,
  ArrowRight,
  Shield,
  Edit3,
  Trash2,
  UploadCloud,
  Plus,
} from 'lucide-react';

interface CustomSkidCardProps {
  customMeta: CustomSkidMeta | null;
  customTopology: PlantTopology | null;
  isActive: boolean;
  isDragging: boolean;
  onOpenBuilder: () => void;
  onConfirmDelete: () => void;
  onActivate: () => void;
  onNavigate?: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const CustomSkidCard: React.FC<CustomSkidCardProps> = ({
  customMeta,
  customTopology,
  isActive,
  isDragging,
  onOpenBuilder,
  onConfirmDelete,
  onActivate,
  onNavigate,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  if (customMeta && customTopology) {
    return (
      <div
        className="industrial-card"
        style={{
          borderRadius: 8,
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: isActive ? '2px solid #059669' : '1px solid var(--border-subtle)',
          background: isActive ? '#f0fdf4' : '#ffffff',
          boxShadow: isActive ? '0 4px 14px rgba(5, 150, 105, 0.12)' : 'var(--shadow-sm)',
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
                    background: '#059669',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                  }}
                >
                  {customMeta.category || 'CUSTOM PLANT'}
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {customMeta.standard || 'Customer Specification'}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                {customMeta.name}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {customMeta.tagline}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={onOpenBuilder}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  color: '#475569',
                }}
                title="Edit or re-upload JSON schema"
              >
                <Edit3 size={12} />
                <span>EDIT JSON</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmDelete();
                }}
                className="btn btn-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  cursor: 'pointer',
                }}
                title="Delete this custom skid template"
              >
                <Trash2 size={12} />
                <span>DELETE</span>
              </button>

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
                  IMPORTED
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '10px 0 16px 0' }}>
            {customMeta.description}
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
                {customMeta.throughput || 'Dynamic Fluid Solver'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                PLC IO Configuration
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', marginTop: 2 }}>
                {customMeta.ioCount || `${customTopology.valves.length} Valves · ${customTopology.pumps.length} Pumps · ${customTopology.tanks.length} Vessels`}
              </div>
            </div>
          </div>

          {/* Technical Highlights */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, textTransform: 'uppercase' }}>
              Topology Components
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(customMeta.highlights || []).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>

          {/* Equipment Tags */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, textTransform: 'uppercase' }}>
              Live Actuators & Nodes
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(customMeta.keyTags || []).map((tag) => (
                <span
                  key={tag}
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: isActive ? '#d1fae5' : '#f1f5f9',
                    border: '1px solid var(--border-subtle)',
                    color: '#065f46',
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
            <Shield size={13} color="#059669" />
            Live Ingested Custom Physical Skid
          </div>

          {isActive ? (
            <button
              onClick={onNavigate}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 700,
                background: '#059669',
                borderColor: '#059669',
              }}
            >
              <span>OPEN CUSTOM MIMIC</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={onActivate}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 700,
                background: '#059669',
                color: '#ffffff',
                borderColor: '#059669',
              }}
            >
              <span>ACTIVATE CUSTOM SKID</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Empty State / Custom Ingestion Card with Drag and Drop */
  return (
    <div
      onClick={onOpenBuilder}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        borderRadius: 8,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        border: isDragging ? '2px dashed #0284c7' : '2px dashed #94a3b8',
        background: isDragging ? '#eff6ff' : '#f8fafc',
        boxShadow: isDragging ? '0 8px 24px rgba(2, 132, 199, 0.2)' : 'none',
        cursor: 'pointer',
        minHeight: 380,
        transition: 'all 0.2s ease',
        transform: isDragging ? 'scale(1.01)' : 'none',
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: isDragging ? '#dbeafe' : '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          transition: 'all 0.2s ease',
        }}
      >
        <UploadCloud size={30} color="#0284c7" />
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
        {isDragging ? 'Drop Custom Skid JSON Here!' : 'Drag & Drop or Import Custom Skid Topology'}
      </h3>
      <p style={{ margin: '8px 0 20px 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
        {isDragging
          ? 'Release file now to automatically parse, validate, and simulate your bespoke plant.'
          : 'Drag & drop any .json P&ID schema directly onto this card, or click to launch the builder with live hydraulic validation.'}
      </p>
      <button
        className="btn btn-primary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 18px',
          fontSize: 12,
          fontWeight: 700,
          background: '#0284c7',
          color: '#ffffff',
        }}
      >
        <Plus size={14} />
        <span>{isDragging ? 'DROP TO LOAD' : 'LAUNCH JSON SKID BUILDER'}</span>
      </button>
    </div>
  );
};
