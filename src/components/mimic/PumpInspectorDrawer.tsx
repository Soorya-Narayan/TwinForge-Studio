import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  X,
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { PumpOperatingCurveCard } from './pump/PumpOperatingCurveCard';
import { HydraulicPressureWalkCard } from './pump/HydraulicPressureWalkCard';
import { NpshAndMotorCard } from './pump/NpshAndMotorCard';
import { PumpControlsCard } from './pump/PumpControlsCard';
import { PumpEquationsCard } from './pump/PumpEquationsCard';

interface PumpInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PumpInspectorDrawer: React.FC<PumpInspectorDrawerProps> = ({ isOpen, onClose }) => {
  const engine = useSimulationStore((s) => s.engine);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CURVES' | 'GRADIENT' | 'ELECTRICAL' | 'CONTROLS'>('ALL');

  if (!isOpen || !engine.rawMilkCircuit) return null;

  const circuit = engine.rawMilkCircuit;
  const outputs = circuit.getOutputs();
  const pumpState = outputs.pumpState;

  // Status Badge Helper
  const renderStatusBadge = () => {
    if (pumpState.tripped) {
      return (
        <span className="badge badge-danger">
          <ShieldAlert size={12} /> MOTOR OVERLOAD TRIP
        </span>
      );
    }
    if (pumpState.dryRun) {
      return (
        <span className="badge badge-danger">
          <RotateCcw size={12} /> DRY RUN STARVATION
        </span>
      );
    }
    if (pumpState.cavitation) {
      return (
        <span className="badge badge-danger">
          <AlertTriangle size={12} /> CAVITATION DEGRADATION
        </span>
      );
    }
    if (pumpState.deadhead) {
      return (
        <span className="badge badge-warning">
          <AlertTriangle size={12} /> DEADHEAD RECIRCULATION
        </span>
      );
    }
    if (pumpState.runout) {
      return (
        <span className="badge badge-warning">
          <Activity size={12} /> RUN-OUT FLOW ALARM (&gt;102% Q_max)
        </span>
      );
    }
    if (pumpState.speedPct > 10) {
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} /> RUNNING OPTIMAL ({outputs.flowLpm.toFixed(0)} L/min)
        </span>
      );
    }
    return <span className="badge badge-neutral">STANDBY / STOPPED</span>;
  };

  return createPortal(
    <div className="scada-drawer-overlay">
      {/* 1. Header Bar */}
      <div className="scada-drawer-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Raw Milk Transfer Pump Diagnostic Suite (P-RAW)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {renderStatusBadge()}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              T={((snapshot?.timeMs ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ padding: '6px 8px', borderRadius: 4 }}
          title="Close Inspector"
        >
          <X size={16} />
        </button>
      </div>

      {/* 2. Section Selector Tabs */}
      <div
        style={{
          display: 'flex',
          background: '#e2e8f0',
          padding: 3,
          gap: 2,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {[
          { id: 'ALL', label: 'FULL DIAGNOSTIC' },
          { id: 'CURVES', label: 'H(Q) CURVE' },
          { id: 'GRADIENT', label: 'PRESSURE WALK' },
          { id: 'ELECTRICAL', label: 'NPSH & MOTOR' },
          { id: 'CONTROLS', label: 'CONTROLS & FAULTS' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: 10,
              fontWeight: 800,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: activeTab === tab.id ? '#ffffff' : 'transparent',
              color: activeTab === tab.id ? '#0284c7' : '#64748b',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Scrollable Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPI Summary Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>FLOW RATE</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>
              {outputs.flowLph.toLocaleString()} L/h
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{outputs.flowLpm.toFixed(1)} L/min</div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>PUMP HEAD</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
              {pumpState.headM.toFixed(1)} m
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              ΔP: {((1032 * 9.80665 * pumpState.headM) / 100000).toFixed(2)} bar
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>MOTOR LOAD</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: pumpState.currentA > 4.8 ? '#dc2626' : '#059669' }}>
              {pumpState.currentA.toFixed(2)} A
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{pumpState.shaftPowerKw.toFixed(2)} kW</div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>SUCTION PRESS</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
              {outputs.suctionPressureBar.toFixed(3)} bar
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              Disch: {outputs.dischargePressureBar.toFixed(3)} bar
            </div>
          </div>
        </div>

        {/* Operating Characteristic Curve */}
        {(activeTab === 'ALL' || activeTab === 'CURVES') && (
          <PumpOperatingCurveCard circuit={circuit} outputs={outputs} />
        )}

        {/* Hydraulic Pressure Walk */}
        {(activeTab === 'ALL' || activeTab === 'GRADIENT') && (
          <HydraulicPressureWalkCard outputs={outputs} />
        )}

        {/* NPSH & Motor Thermal */}
        {(activeTab === 'ALL' || activeTab === 'ELECTRICAL') && (
          <NpshAndMotorCard circuit={circuit} outputs={outputs} />
        )}

        {/* Controls & Destructive FAT Testing */}
        {(activeTab === 'ALL' || activeTab === 'CONTROLS') && (
          <PumpControlsCard circuit={circuit} outputs={outputs} />
        )}

        {/* Governing Equations Accordion */}
        <PumpEquationsCard circuit={circuit} />
      </div>
    </div>,
    document.body
  );
};
