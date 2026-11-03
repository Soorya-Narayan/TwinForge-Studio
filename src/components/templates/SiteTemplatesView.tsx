import React, { useState } from 'react';
import { useSimulationStore, type SkidId } from '../../store/useSimulationStore';
import { useFatStore } from '../../store/useFatStore';
import { Factory, Plus, AlertTriangle, X, Trash2, FolderOpen } from 'lucide-react';
import { CustomSkidModal } from './CustomSkidModal';
import { ClientProjectModal } from '../project/ClientProjectModal';
import { TemplateCard, type TemplateMeta } from './TemplateCard';
import { CustomSkidCard } from './CustomSkidCard';
import { RoadmapTemplatesCard } from './RoadmapTemplatesCard';

interface SiteTemplatesViewProps {
  onSelectAndNavigate?: () => void;
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

export const SiteTemplatesView: React.FC<SiteTemplatesViewProps> = ({ onSelectAndNavigate }) => {
  const activeSkid = useSimulationStore((s) => s.activeSkid);
  const setSkid = useSimulationStore((s) => s.setSkid);
  const customMeta = useSimulationStore((s) => s.customMeta);
  const customTopology = useSimulationStore((s) => s.customTopology);
  const deleteCustomSkid = useSimulationStore((s) => s.deleteCustomSkid);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
            onClick={() => setIsProjectModalOpen(true)}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              background: '#047857',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)',
              cursor: 'pointer',
              border: 'none',
              borderRadius: 4,
            }}
          >
            <FolderOpen size={15} />
            <span>OPEN CLIENT PROJECT FOLDER</span>
          </button>

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

      {/* Production & Custom Skids Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 18 }}>
        {TEMPLATES.map((tmpl) => (
          <TemplateCard
            key={tmpl.id}
            template={tmpl}
            isActive={activeSkid === tmpl.id}
            onActivate={handleActivate}
            onNavigate={onSelectAndNavigate}
          />
        ))}

        <CustomSkidCard
          customMeta={customMeta}
          customTopology={customTopology}
          isActive={activeSkid === 'CUSTOM'}
          isDragging={isDragging}
          onOpenBuilder={() => setIsModalOpen(true)}
          onConfirmDelete={() => setShowDeleteModal(true)}
          onActivate={() => handleActivate('CUSTOM')}
          onNavigate={onSelectAndNavigate}
          onDragOver={handleCardDragOver}
          onDragLeave={handleCardDragLeave}
          onDrop={handleCardDrop}
        />
      </div>

      {/* Upcoming Plant Library Section */}
      <RoadmapTemplatesCard />

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

      {/* In-App Skid Deletion Confirmation Dialog */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="industrial-card"
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: 480,
              borderRadius: 8,
              border: '1px solid #fca5a5',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#fff1f2',
                borderBottom: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={18} color="#dc2626" />
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#991b1b' }}>
                  Confirm Skid Deletion
                </h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-ghost"
                style={{ padding: '4px 6px', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                Are you sure you want to delete the custom skid template{' '}
                <strong style={{ color: '#0f172a' }}>"{customMeta?.name ?? 'Custom Skid'}"</strong>?
              </p>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                • The custom P&ID topology will be unloaded from memory.<br />
                • If currently running, the simulation will safely revert to the default standard plant.<br />
                • You can always re-import or drop another JSON schema at any time.
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                padding: '14px 20px',
                background: '#f8fafc',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600 }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  deleteCustomSkid();
                  setShowDeleteModal(false);
                }}
                className="btn btn-danger"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 18px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                }}
              >
                <Trash2 size={13} />
                <span>YES, DELETE TEMPLATE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Project Folder Modal */}
      <ClientProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onDeployed={() => {
          if (onSelectAndNavigate) onSelectAndNavigate();
        }}
      />
    </div>
  );
};
