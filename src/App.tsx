import { useState } from 'react';
import { PlantMimic } from './components/mimic/PlantMimic';
import { PasteurizerMimic } from './components/mimic/PasteurizerMimic';
import { CustomSkidMimic } from './components/mimic/CustomSkidMimic';
import { FatSuitePanel } from './components/fat/FatSuitePanel';
import { FaultDeck } from './components/faults/FaultDeck';
import { TagWatchTable } from './components/tags/TagWatchTable';
import { PidCanvas } from './components/canvas/PidCanvas';
import { TrendOscilloscope } from './components/trend/TrendOscilloscope';
import { FatReportModal } from './components/report/FatReportModal';
import { OpcUaModal } from './components/plc/OpcUaModal';
import { SiteTemplatesView } from './components/templates/SiteTemplatesView';
import { SplashScreen } from './components/loading/SplashScreen';
import { useSimulationStore } from './store/useSimulationStore';
import { useFatStore } from './store/useFatStore';
import { Factory, Server } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'MIMIC' | 'TRENDS' | 'FAT' | 'FAULTS' | 'TAGS' | 'MODELER' | 'TEMPLATES'>('MIMIC');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showOpcUaModal, setShowOpcUaModal] = useState(false);

  const activeSkid = useSimulationStore((s) => s.activeSkid);
  const customMeta = useSimulationStore((s) => s.customMeta);
  const plc = useSimulationStore((s) => s.plc);
  const driverMode = useSimulationStore((s) => s.driverMode);
  const faults = useSimulationStore((s) => s.faults);
  const openReportModal = useFatStore((s) => s.openReportModal);
  const results = useFatStore((s) => s.results);

  const hasTrippedInterlock = Array.from(plc?.interlocks?.values?.() ?? []).some((il) => il.tripped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-main)' }}>
      {/* Industrial Goose Loading Splash Screen */}
      {isInitialLoading && (
        <SplashScreen onComplete={() => setIsInitialLoading(false)} />
      )}

      {/* Industrial HMI Header Bar */}
      <header
        className="industrial-card no-print"
        style={{
          margin: '8px 14px 0 14px',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 6,
          gap: 8,
          overflow: 'hidden',
        }}
      >
        {/* Brand & Identity */}
        <div
          onClick={() => setIsInitialLoading(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}
          title="Click to replay Goose startup sequence"
        >
          <img
            src="./gooselogo.png"
            alt="Goose Logo"
            style={{
              width: 30,
              height: 30,
              objectFit: 'contain',
            }}
          />

          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              TwinForge Studio
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-segmented-tabs" aria-label="Main Navigation" style={{ flexShrink: 1 }}>
          <button
            onClick={() => setActiveTab('MIMIC')}
            className={`nav-tab-btn ${activeTab === 'MIMIC' ? 'active' : ''}`}
          >
            MIMIC
          </button>
          <button
            onClick={() => setActiveTab('TRENDS')}
            className={`nav-tab-btn ${activeTab === 'TRENDS' ? 'active' : ''}`}
          >
            TRENDS
          </button>
          <button
            onClick={() => setActiveTab('FAT')}
            className={`nav-tab-btn ${activeTab === 'FAT' ? 'active' : ''}`}
          >
            FAT SUITE {results.length > 0 && `(${results.filter((r) => r.passed).length}/${results.length})`}
          </button>
          <button
            onClick={() => setActiveTab('FAULTS')}
            className={`nav-tab-btn ${activeTab === 'FAULTS' ? 'active' : ''}`}
          >
            FAULTS {faults.length > 0 && `(${faults.length})`}
          </button>
          <button
            onClick={() => setActiveTab('TAGS')}
            className={`nav-tab-btn ${activeTab === 'TAGS' ? 'active' : ''}`}
          >
            TAG WATCH
          </button>
          <button
            onClick={() => setActiveTab('MODELER')}
            className={`nav-tab-btn ${activeTab === 'MODELER' ? 'active' : ''}`}
          >
            P&ID MODELER
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`nav-tab-btn ${activeTab === 'TEMPLATES' ? 'active' : ''}`}
          >
            TEMPLATES
          </button>
        </nav>

        {/* Diagnostics & Plant Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Active Plant Chip (Clickable to switch) */}
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className="header-action-btn"
            title="Click to view and switch plant templates"
          >
            <Factory size={12} color="var(--color-primary)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Plant:</span>
            <span style={{ fontWeight: 700, color: '#0369a1', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSkid === 'PASTEURIZER_10KLPH'
                ? 'Pasteurizer 10k'
                : activeSkid === 'BATCH_MIXING'
                ? 'Batch Mixing'
                : customMeta?.name || 'Custom Skid'}
            </span>
          </button>

          {/* PLC Driver & OPC UA Status Chip */}
          <button
            onClick={() => setShowOpcUaModal(true)}
            className="header-action-btn"
            style={{
              background: driverMode === 'OPCUA' ? '#f0fdf4' : '#ffffff',
              borderColor: driverMode === 'OPCUA' ? '#bbf7d0' : 'var(--border-strong)',
            }}
            title="Configure PLC Driver & OPC UA Hardware Connection"
          >
            <Server size={12} color={driverMode === 'OPCUA' ? 'var(--color-success)' : 'var(--text-secondary)'} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>PLC:</span>
            <span style={{ fontWeight: 700, color: driverMode === 'OPCUA' ? '#15803d' : '#334155' }}>
              {driverMode === 'OPCUA' ? 'OPC UA' : 'Mock'}
            </span>
          </button>

          {hasTrippedInterlock && (
            <div
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '0 8px',
                borderRadius: 4,
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-danger)',
                whiteSpace: 'nowrap',
              }}
              title="Safety Interlock Tripped"
            >
              <span className="led led-alarm" style={{ width: 6, height: 6 }} />
              <span className="mono">INTERLOCK TRIP</span>
            </div>
          )}

          {results.length > 0 && (
            <button
              onClick={openReportModal}
              className="btn btn-success"
              style={{ height: 28, padding: '0 10px', fontSize: 11, fontWeight: 700 }}
            >
              FAT REPORT
            </button>
          )}
        </div>
      </header>

      {/* Main SCADA Workspace */}
      <main className="no-print" style={{ flex: 1, padding: '10px 14px 14px 14px', overflow: 'hidden' }}>
        {activeTab === 'MIMIC' && (
          activeSkid === 'PASTEURIZER_10KLPH' ? (
            <PasteurizerMimic />
          ) : activeSkid === 'BATCH_MIXING' ? (
            <PlantMimic />
          ) : (
            <CustomSkidMimic />
          )
        )}
        {activeTab === 'TRENDS' && <TrendOscilloscope />}
        {activeTab === 'FAT' && <FatSuitePanel />}
        {activeTab === 'FAULTS' && <FaultDeck />}
        {activeTab === 'TAGS' && <TagWatchTable />}
        {activeTab === 'MODELER' && <PidCanvas />}
        {activeTab === 'TEMPLATES' && <SiteTemplatesView onSelectAndNavigate={() => setActiveTab('MIMIC')} />}
      </main>

      {/* FAT Verification & Compliance Report Modal */}
      <FatReportModal />

      {/* PLC Driver & OPC UA Hardware Connection Modal */}
      <OpcUaModal isOpen={showOpcUaModal} onClose={() => setShowOpcUaModal(false)} />
    </div>
  );
}

export default App;
