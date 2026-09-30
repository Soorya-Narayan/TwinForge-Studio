import { useState } from 'react';
import { PlantMimic } from './components/mimic/PlantMimic';
import { FatSuitePanel } from './components/fat/FatSuitePanel';
import { FaultDeck } from './components/faults/FaultDeck';
import { TagWatchTable } from './components/tags/TagWatchTable';
import { PidCanvas } from './components/canvas/PidCanvas';
import { TrendOscilloscope } from './components/trend/TrendOscilloscope';
import { FatReportModal } from './components/report/FatReportModal';
import { useSimulationStore } from './store/useSimulationStore';
import { useFatStore } from './store/useFatStore';
import {
  Activity,
  ShieldCheck,
  Sliders,
  Network,
  Zap,
  TrendingUp,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'MIMIC' | 'TRENDS' | 'FAT' | 'FAULTS' | 'TAGS' | 'MODELER'>('MIMIC');

  const plc = useSimulationStore((s) => s.plc);
  const faults = useSimulationStore((s) => s.faults);
  const openReportModal = useFatStore((s) => s.openReportModal);
  const results = useFatStore((s) => s.results);

  const hasTrippedInterlock = Array.from(plc.interlocks.values()).some((il) => il.tripped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-main)' }}>
      {/* Industrial HMI Header Bar */}
      <header
        className="industrial-card"
        style={{
          margin: '10px 14px 0 14px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 6,
        }}
      >
        {/* Brand & Plant Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/gooselogo.png"
            alt="Goose Logo"
            style={{
              width: 36,
              height: 36,
              objectFit: 'contain',
            }}
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                TwinForge Studio
              </span>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                FAT Virtual Commissioning System
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Plant Skid: GIS-CIP-25KLPH · Goose Industrial Solutions
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 6, gap: 2 }}>
          <button
            onClick={() => setActiveTab('MIMIC')}
            className={`btn ${activeTab === 'MIMIC' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            <Activity size={14} />
            PROCESS MIMIC
          </button>
          <button
            onClick={() => setActiveTab('TRENDS')}
            className={`btn ${activeTab === 'TRENDS' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            <TrendingUp size={14} />
            TREND RECORDER
          </button>
          <button
            onClick={() => setActiveTab('FAT')}
            className={`btn ${activeTab === 'FAT' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            <ShieldCheck size={14} />
            FAT SUITE {results.length > 0 && `(${results.filter((r) => r.passed).length}/${results.length})`}
          </button>
          <button
            onClick={() => setActiveTab('FAULTS')}
            className={`btn ${activeTab === 'FAULTS' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            <Zap size={14} />
            FAULT DECK {faults.length > 0 && `(${faults.length})`}
          </button>
          <button
            onClick={() => setActiveTab('TAGS')}
            className={`btn ${activeTab === 'TAGS' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            <Sliders size={14} />
            TAG WATCH
          </button>
          <button
            onClick={() => setActiveTab('MODELER')}
            className={`btn ${activeTab === 'MODELER' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            <Network size={14} />
            P&ID MODELER
          </button>
        </div>

        {/* Diagnostics & Interlock Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasTrippedInterlock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: '#fee2e2', padding: '4px 8px', borderRadius: 4, border: '1px solid #fca5a5' }}>
              <span className="led led-alarm" />
              <span className="mono" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                INTERLOCK TRIP
              </span>
            </div>
          )}

          <div style={{ padding: '4px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid var(--border-subtle)', fontSize: 11 }}>
            <span className="mono" style={{ color: 'var(--text-secondary)' }}>MOCK PLC · 100ms FIXED SCAN</span>
          </div>

          {results.length > 0 && (
            <button onClick={openReportModal} className="btn btn-success" style={{ fontSize: 11, padding: '5px 10px' }}>
              FAT REPORT
            </button>
          )}
        </div>
      </header>

      {/* Main SCADA Workspace */}
      <main style={{ flex: 1, padding: '10px 14px 14px 14px', overflow: 'hidden' }}>
        {activeTab === 'MIMIC' && <PlantMimic />}
        {activeTab === 'TRENDS' && <TrendOscilloscope />}
        {activeTab === 'FAT' && <FatSuitePanel />}
        {activeTab === 'FAULTS' && <FaultDeck />}
        {activeTab === 'TAGS' && <TagWatchTable />}
        {activeTab === 'MODELER' && <PidCanvas />}
      </main>

      {/* Certified FAT Compliance Report Modal */}
      <FatReportModal />
    </div>
  );
}

export default App;
