import React from 'react';
import { useSimulationStore, type SkidId } from '../../store/useSimulationStore';
import { useFatStore } from '../../store/useFatStore';
import { CheckCircle2, Factory, ArrowRight, Cpu, Shield } from 'lucide-react';

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

  const handleActivate = (id: SkidId) => {
    setSkid(id);
    useFatStore.getState().syncScenarios(id);
    if (onSelectAndNavigate) {
      onSelectAndNavigate();
    }
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
            Select an industrial skid template to instantiate its physical topology, fluid equations, IO tags, PLC control logic, and automated FAT procedures.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: '6px 14px', borderRadius: 6, background: '#f1f5f9', border: '1px solid var(--border-subtle)', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Environment
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)' }}>
              {activeSkid === 'PASTEURIZER_10KLPH' ? 'Milk Pasteurizer 10 KLPH' : 'Three-Solution Batch Mixing'}
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
    </div>
  );
};
