/**
 * TwinForge Studio - High-Performance Plate Heat Exchanger Inspector Drawer
 * Industrial deep-dive diagnostic panel with live temperature profiles,
 * counter-flow cell maps, thermodynamic formulas, and destructive FAT controls.
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  X,
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import { PheOverallMetricsCard } from './phe/PheOverallMetricsCard';
import { PheSectionMetricsCard } from './phe/PheSectionMetricsCard';
import { PheFaultInjectionDeck } from './phe/PheFaultInjectionDeck';
import { PheFormulasAccordion } from './phe/PheFormulasAccordion';

interface PheInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialSectionId?: string;
}

export const PheInspectorDrawer: React.FC<PheInspectorDrawerProps> = ({
  isOpen,
  onClose,
  initialSectionId = 'ALL',
}) => {
  const engine = useSimulationStore((s) => s.engine);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const injectFault = useSimulationStore((s) => s.injectFault);
  const faults = useSimulationStore((s) => s.faults);

  const [selectedSection, setSelectedSection] = useState<string>(initialSectionId);

  const [prevProps, setPrevProps] = useState({ initialSectionId, isOpen });
  if (prevProps.initialSectionId !== initialSectionId || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialSectionId, isOpen });
    if (initialSectionId) {
      setSelectedSection(initialSectionId);
    }
  }

  // Read PHE assembly directly from engine
  const phe = engine.pheAssembly;

  const overall = useMemo(() => {
    if (!snapshot) return null;
    return phe?.getOverallMetrics();
  }, [phe, snapshot]);

  const sectionsMetrics = useMemo(() => {
    if (!snapshot || !phe) return null;
    return {
      'CHILLING': phe.chilling.getMetrics(),
      'REG-01': phe.reg01.getMetrics(),
      'REG-02': phe.reg02.getMetrics(),
      'HEATING': phe.heating.getMetrics(),
    };
  }, [phe, snapshot]);

  if (!isOpen || !phe || !overall || !sectionsMetrics) return null;

  const currentSection = selectedSection !== 'ALL' ? sectionsMetrics[selectedSection as keyof typeof sectionsMetrics] : null;

  // Temperature color helper (4°C deep blue -> 95°C vibrant red)
  const getTempColor = (t: number) => {
    const min = 4.0;
    const max = 95.0;
    const ratio = Math.max(0, Math.min(1, (t - min) / (max - min)));
    
    // HSL interpolation: 215 (blue) -> 0 (red)
    const hue = 215 - ratio * 215;
    return `hsl(${hue}, 85%, ${ratio > 0.6 ? '48%' : '44%'})`;
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    switch (overall.overallStatus) {
      case 'CONTAMINATION_ALERT':
        return <span className="badge badge-danger"><AlertTriangle size={12} /> CONTAMINATION HAZARD (PT2 &gt; PT4)</span>;
      case 'LEAK_WARNING':
        return <span className="badge badge-warning"><ShieldAlert size={12} /> PINHOLE LEAK ACTIVE ({overall.plateLeakFlowRateLpm} L/min)</span>;
      case 'FOULED':
        return <span className="badge badge-warning"><Sliders size={12} /> PLATES FOULED (CIP REQUIRED)</span>;
      case 'UNDER_TEMP_DIVERT':
        return <span className="badge badge-danger"><Activity size={12} /> UNDER-TEMP DIVERT ({overall.holdingTubeExitTempC.toFixed(1)}°C)</span>;
      case 'LOW_FLOW':
        return <span className="badge badge-neutral">STANDBY / LOW FLOW</span>;
      default:
        return <span className="badge badge-success"><CheckCircle2 size={12} /> OPTIMAL (90% REGENERATION)</span>;
    }
  };

  const getSectionPlateCount = (sectionKey: string) => {
    if (sectionKey === 'HEATING') return phe.heating.config.plateCount;
    if (sectionKey === 'CHILLING') return phe.chilling.config.plateCount;
    if (sectionKey === 'REG-01') return phe.reg01.config.plateCount;
    return phe.reg02.config.plateCount;
  };

  return createPortal(
    <div className="scada-drawer-overlay">
      {/* 1. Header Bar */}
      <div className="scada-drawer-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Plate Heat Exchanger Diagnostic Suite
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
        {['ALL', 'CHILLING', 'REG-01', 'REG-02', 'HEATING'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedSection(tab)}
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: 10,
              fontWeight: 800,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: selectedSection === tab ? '#ffffff' : 'transparent',
              color: selectedSection === tab ? '#0284c7' : '#64748b',
              boxShadow: selectedSection === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. Scrollable Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Overall Assembly KPI Cards (Shown on ALL tab) */}
        {selectedSection === 'ALL' && (
          <PheOverallMetricsCard
            overall={overall}
            sectionsMetrics={sectionsMetrics}
            onSelectSection={setSelectedSection}
            getTempColor={getTempColor}
          />
        )}

        {/* Selected Section Deep-Dive (When a section is chosen) */}
        {currentSection && (
          <PheSectionMetricsCard
            currentSection={currentSection}
            plateCount={getSectionPlateCount(selectedSection)}
            getTempColor={getTempColor}
          />
        )}

        {/* 4. Health & Sanitation + 5. Live FAT & Fault Injection Controls */}
        <PheFaultInjectionDeck
          overall={overall}
          sectionsMetrics={sectionsMetrics}
          faults={faults}
          injectFault={injectFault}
          onResetFouling={() => {
            phe.resetAllFouling();
            injectFault({ deviceId: 'PHE-HEATING', mode: 'none' });
          }}
        />

        {/* 6. Formulations & 7. Advanced Solver Config */}
        <PheFormulasAccordion
          currentSection={currentSection}
          phe={phe}
        />
      </div>
    </div>,
    document.body
  );
};
