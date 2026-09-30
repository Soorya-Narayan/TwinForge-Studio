import React, { useState } from 'react';
import { useSimulationStore, type SkidId } from '../../store/useSimulationStore';
import { useFatStore } from '../../store/useFatStore';
import { CheckCircle2, Factory, ArrowRight, Cpu, Shield, Plus, UploadCloud, Edit3 } from 'lucide-react';
import { CustomSkidModal } from './CustomSkidModal';

interface SiteTemplatesViewProps {
  onSelectAndNavigate?: () => void;
}

interface TemplateMeta {
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

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'PASTEURIZER_10KLPH',
    name: 'Milk Pasteurizer 10 KLPH',
    tagline: 'Continuous HTST: 4-Section PHE, Cream Separator, Homogenizer & Dual Flow Diversion',
    category: 'Thermal Dairy Processing',
    standard: '3-A Sanitary / PMO Standards',
    throughput: '10,000 LPH (Liters Per Hour)',
    ioCount: '13 Valves · 9 TT · 7 PT · 4 Pumps · FM · LT1',
    description:
      'Standard high-fidelity digital twin of a continuous HTST (High Temperature Short Time) dairy pasteurization plant. Features a 4-section PHE (Chilling 4°C, REG-01 45°C, REG-02 70°C, Heating 90°C), in-line 10 KLPH Cream Separator with bypass PV7, 10 KLPH Homogenizer (200 bar, seal water proved), Booster Pump, 20-second Holding Coil, dual diversion valves (PV11/PV12), and closed hot water generation loop with steam valve SCV1.',
    highlights: [
      '4-Section PHE: Chilling (4°C), REG-01 (45°C), REG-02 (70°C), and Heating (90°C)',
      'In-Line Processing: Cream Separator (PV4..PV7) + Homogenizer (PV8..PV9 with seal water interlock)',
      'Dual Flow Diversion: PV11 forward flow + PV12 legal diversion line "FROM DIVERSION TO BALANCE TANK"',
      'Complete Instrumentation: 9 Temp Transmitters (TT1..TT9), 7 Pressure Transmitters (PT1..PT7), FM Flowmeter, LT1/LS1/LS2',
      'Hot Water Skid: 1.5" Steam line with SCV1, PG1, PT7, and 3 HP Hot Water Pump P-HW',
    ],
    keyTags: ['PV1', 'PV2', 'PV4', 'PV5', 'PV7', 'PV8', 'PV9', 'PV10', 'PV11', 'PV12', 'SCV1', 'TT5', 'PT3', 'PT4', 'FM'],
    status: 'PRODUCTION',
  },
  {
    id: 'BATCH_MIXING',
    name: 'Three-Solution Batch Mixing Skid',
    tagline: 'Multi-Stream In-Line Chemical Blending & Agitated Tank Reactor',
    category: 'Formulation & Blending',
    standard: 'ISA-88 Batch Standards',
    throughput: '25,000 LPH Combined Output',
    ioCount: '8 DI · 10 DO · 4 AI',
    description:
      'Multi-ingredient automated batch formulation skid. Delivers raw liquids from Tank 100 (Solution A), Tank 200 (Solution B), and Tank 300 (Neutralizer C) into Tank 400 with high-shear agitation, volumetric dosing recipes, and automated flush cycles.',
    highlights: [
      '4 Process Vessels: 3x raw dosing reservoirs + 1x final blending tank with AG-400 agitator',
      'Pneumatic Actuation: Automated fill valves (XV-101..XV-301) and drain isolation (XV-401)',
      'Deterministic Dynamics: Hydraulic cross-flow solver calculating live level and hydrostatic pressure',
      'Sequential Batch State Machine: Idle -> Filling -> Agitating -> Transferring -> Cleanout',
    ],
    keyTags: ['TK-100', 'TK-200', 'TK-300', 'TK-400', 'P-100', 'P-200', 'P-300', 'AG-400', 'XV-401'],
    status: 'PRODUCTION',
  },
];

const UPCOMING_TEMPLATES = [
  {
    name: 'Dual-Circuit CIP Kitchen Skid',
    category: 'Sanitary CIP / SIP Cleaning',
    specs: 'Caustic (75°C), Acid (65°C), Fresh Rinse, Conductivity Controller',
    status: 'ROADMAP · Q4',
  },
  {
    name: 'Continuous Carbonation & Deaeration',
    category: 'Brewing & Carbonated Soft Drinks',
    specs: 'Vacuum Strip Column, Mass-Flow CO2 Ratio Injection, In-line DO < 10 ppb',
    status: 'ROADMAP · Q4',
  },
];

export const SiteTemplatesView: React.FC<SiteTemplatesViewProps> = ({ onSelectAndNavigate }) => {
  const activeSkid = useSimulationStore((s) => s.activeSkid);
  const setSkid = useSimulationStore((s) => s.setSkid);
  const customMeta = useSimulationStore((s) => s.customMeta);
  const customTopology = useSimulationStore((s) => s.customTopology);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedJson, setDroppedJson] = useState<string | undefined>(undefined);

  const handleActivate = (id: SkidId) => {
    setSkid(id);
    useFatStore.getState().syncScenarios(id);
    if (onSelectAndNavigate) {
      onSelectAndNavigate();
    }
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== 'text/plain') {
      alert('Please drop a valid .json custom skid template file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setDroppedJson(content);
        setIsModalOpen(true);
      }
    };
    reader.readAsText(file);
  };

  const getActiveSkidDisplayName = () => {
    if (activeSkid === 'PASTEURIZER_10KLPH') return 'Milk Pasteurizer 10 KLPH';
    if (activeSkid === 'BATCH_MIXING') return 'Three-Solution Batch Mixing';
    return customMeta?.name || 'Custom Skid (Active)';
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner */}
      <div
        className="industrial-card"
        style={{
          padding: '20px 24px',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderLeft: '4px solid var(--color-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Factory size={22} color="var(--color-primary)" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Plant Skid & Site Templates
            </h2>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 720 }}>
            Select an industrial skid template to instantiate its physical topology, fluid equations, IO tags, PLC control logic, and automated FAT procedures. Or upload your own custom plant JSON schema to test any proprietary skid.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              background: '#0284c7',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            <span>IMPORT / BUILD CUSTOM SKID</span>
          </button>

          <div style={{ padding: '6px 14px', borderRadius: 6, background: '#f1f5f9', border: '1px solid var(--border-subtle)', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Environment
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)' }}>
              {getActiveSkidDisplayName()}
            </div>
          </div>
        </div>
      </div>

      {/* Production Skids Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 18 }}>
        {TEMPLATES.map((tmpl) => {
          const isActive = activeSkid === tmpl.id;

          return (
            <div
              key={tmpl.id}
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
                          color: '#0369a1',
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
                  ISA-101 Compliant Simulation Model
                </div>

                {isActive ? (
                  <button
                    onClick={onSelectAndNavigate}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span>OPEN PROCESS MIMIC</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(tmpl.id)}
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#0284c7',
                      color: '#ffffff',
                      borderColor: '#0284c7',
                    }}
                  >
                    <span>ACTIVATE THIS SKID</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Custom Skid Card (Active or Stored) */}
        {customTopology && customMeta ? (
          <div
            className="industrial-card"
            style={{
              borderRadius: 8,
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: activeSkid === 'CUSTOM' ? '2px solid #059669' : '1px solid var(--border-subtle)',
              background: activeSkid === 'CUSTOM' ? '#f0fdf4' : '#ffffff',
              boxShadow: activeSkid === 'CUSTOM' ? '0 4px 14px rgba(5, 150, 105, 0.12)' : 'var(--shadow-sm)',
              position: 'relative',
            }}
          >
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
                    onClick={() => setIsModalOpen(true)}
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

                  {activeSkid === 'CUSTOM' ? (
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
                  background: activeSkid === 'CUSTOM' ? '#ffffff' : '#f8fafc',
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
                        background: activeSkid === 'CUSTOM' ? '#d1fae5' : '#f1f5f9',
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

              {activeSkid === 'CUSTOM' ? (
                <button
                  onClick={onSelectAndNavigate}
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
                  onClick={() => handleActivate('CUSTOM')}
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
        ) : (
          /* Empty State / Custom Ingestion Card with Drag and Drop */
          <div
            onClick={() => setIsModalOpen(true)}
            onDragOver={handleCardDragOver}
            onDragLeave={handleCardDragLeave}
            onDrop={handleCardDrop}
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
        )}
      </div>

      {/* Upcoming Plant Library Section */}
      <div className="industrial-card" style={{ padding: '16px 20px', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Cpu size={16} color="var(--text-muted)" />
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Enterprise Plant Library (Upcoming Expansion)
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {UPCOMING_TEMPLATES.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 14px',
                borderRadius: 6,
                background: '#f8fafc',
                border: '1px dashed var(--border-strong)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.category}</div>
                <div className="mono" style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{item.specs}</div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: '#e2e8f0',
                  color: '#475569',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Skid Importer & Builder Modal */}
      <CustomSkidModal
        isOpen={isModalOpen}
        initialJson={droppedJson}
        onClose={() => {
          setIsModalOpen(false);
          setDroppedJson(undefined);
        }}
        onDeploySuccess={() => {
          if (onSelectAndNavigate) {
            onSelectAndNavigate();
          }
        }}
      />
    </div>
  );
};
