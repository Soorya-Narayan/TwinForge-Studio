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
import { SiteTemplatesView } from './components/templates/SiteTemplatesView';
import { SplashScreen } from './components/loading/SplashScreen';
import { useSimulationStore } from './store/useSimulationStore';
import { useFatStore } from './store/useFatStore';
import { Factory } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'MIMIC' | 'TRENDS' | 'FAT' | 'FAULTS' | 'TAGS' | 'MODELER' | 'TEMPLATES'>('MIMIC');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const activeSkid = useSimulationStore((s) => s.activeSkid);
  const customMeta = useSimulationStore((s) => s.customMeta);
  const plc = useSimulationStore((s) => s.plc);
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
        {/* Brand & Identity */}
        <div
          onClick={() => setIsInitialLoading(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          title="Click to replay Goose startup sequence"
        >
          <img
            src="./gooselogo.png"
            alt="Goose Logo"
            style={{
              width: 36,
              height: 36,
              objectFit: 'contain',
            }}
          />

          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              TwinForge Studio
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
            PROCESS MIMIC
          </button>
          <button
            onClick={() => setActiveTab('TRENDS')}
            className={`btn ${activeTab === 'TRENDS' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            TREND RECORDER
          </button>
          <button
            onClick={() => setActiveTab('FAT')}
            className={`btn ${activeTab === 'FAT' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            FAT SUITE {results.length > 0 && `(${results.filter((r) => r.passed).length}/${results.length})`}
          </button>
          <button
            onClick={() => setActiveTab('FAULTS')}
            className={`btn ${activeTab === 'FAULTS' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            FAULT DECK {faults.length > 0 && `(${faults.length})`}
          </button>
          <button
            onClick={() => setActiveTab('TAGS')}
            className={`btn ${activeTab === 'TAGS' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            TAG WATCH
          </button>
          <button
            onClick={() => setActiveTab('MODELER')}
            className={`btn ${activeTab === 'MODELER' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            P&ID MODELER
          </button>
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`btn ${activeTab === 'TEMPLATES' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            SITE TEMPLATES
          </button>
        </div>

        {/* Diagnostics & Plant Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Active Plant Chip (Clickable to switch) */}
          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className="btn btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: 11,
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            title="Click to view and switch plant templates"
          >
            <Factory size={13} color="var(--color-primary)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Plant:</span>
            <span style={{ fontWeight: 700, color: '#0369a1' }}>
              {activeSkid === 'PASTEURIZER_10KLPH'
                ? 'Pasteurizer 10 KLPH'
                : activeSkid === 'BATCH_MIXING'
                ? 'Batch Mixing (25 KLPH)'
                : customMeta?.name || 'Custom Skid (Active)'}
            </span>
          </button>

          {hasTrippedInterlock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: '#fee2e2', padding: '4px 8px', borderRadius: 4, border: '1px solid #fca5a5' }}>
              <span className="led led-alarm" />
              <span className="mono" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                INTERLOCK TRIP
              </span>
            </div>
          )}

          {results.length > 0 && (
            <button onClick={openReportModal} className="btn btn-success" style={{ fontSize: 11, padding: '5px 10px' }}>
              FAT REPORT
            </button>
          )}
        </div>
      </header>

      {/* Main SCADA Workspace */}
      <main style={{ flex: 1, padding: '10px 14px 14px 14px', overflow: 'hidden' }}>
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

      {/* Certified FAT Compliance Report Modal */}
      <FatReportModal />
    </div>
  );
}

export default App;
