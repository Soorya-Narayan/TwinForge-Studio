import React from 'react';
import { Search, Plus, RotateCcw, Shield } from 'lucide-react';
import {
  type InterlockDefinition,
  DEFAULT_INTERLOCK_DEFINITIONS,
} from '../../../core/driver/interlockConfig';

export interface OpcUaInterlocksTabProps {
  interlockSearch: string;
  setInterlockSearch: (q: string) => void;
  interlockSkidFilter: 'ALL' | 'PASTEURIZER_10KLPH' | 'BATCH_MIXING';
  setInterlockSkidFilter: (filter: 'ALL' | 'PASTEURIZER_10KLPH' | 'BATCH_MIXING') => void;
  showAddInterlock: boolean;
  setShowAddInterlock: (show: boolean) => void;
  newInterlockForm: {
    id: string;
    name: string;
    condition: string;
    skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'COMMON';
  };
  setNewInterlockForm: React.Dispatch<
    React.SetStateAction<{
      id: string;
      name: string;
      condition: string;
      skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'COMMON';
    }>
  >;
  handleAddInterlock: () => void;
  resetInterlockDefinitions: () => void;
  handleInterlockFieldChange: (id: string, field: 'name' | 'condition', val: string) => void;
  handleResetSingleInterlock: (id: string) => void;
  filteredInterlocks: InterlockDefinition[];
}

export const OpcUaInterlocksTab: React.FC<OpcUaInterlocksTabProps> = ({
  interlockSearch,
  setInterlockSearch,
  interlockSkidFilter,
  setInterlockSkidFilter,
  showAddInterlock,
  setShowAddInterlock,
  newInterlockForm,
  setNewInterlockForm,
  handleAddInterlock,
  resetInterlockDefinitions,
  handleInterlockFieldChange,
  handleResetSingleInterlock,
  filteredInterlocks,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header Controls: Filters, Search, Add, Reset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          background: '#f8fafc',
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: 8, color: '#94a3b8' }} />
          <input
            type="text"
            value={interlockSearch}
            onChange={(e) => setInterlockSearch(e.target.value)}
            placeholder="Search by ID, name, or condition..."
            style={{
              width: '100%',
              padding: '5px 8px 5px 28px',
              fontSize: 11,
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: '#ffffff',
            }}
          />
        </div>

        {/* Skid Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Skid:</span>
          {(['ALL', 'PASTEURIZER_10KLPH', 'BATCH_MIXING'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInterlockSkidFilter(s)}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 3,
                border: 'none',
                background: interlockSkidFilter === s ? 'var(--color-primary)' : '#e2e8f0',
                color: interlockSkidFilter === s ? '#ffffff' : '#334155',
                cursor: 'pointer',
              }}
            >
              {s === 'ALL' ? 'All Skids' : s === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : 'Batch Mixing'}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setShowAddInterlock(!showAddInterlock)}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={12} />
            New Interlock
          </button>

          <button
            type="button"
            onClick={() => resetInterlockDefinitions()}
            className="btn btn-ghost"
            title="Reset all interlock definitions to standard PMO/3A defaults"
            style={{ padding: '4px 8px', fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RotateCcw size={12} />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Add New Interlock Drawer */}
      {showAddInterlock && (
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 6,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1' }}>
            Define Custom Safety Interlock
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr auto', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="ID (e.g. IL-06)"
              value={newInterlockForm.id}
              onChange={(e) => setNewInterlockForm({ ...newInterlockForm, id: e.target.value })}
              style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
            />
            <select
              value={newInterlockForm.skid}
              onChange={(e) => setNewInterlockForm({ ...newInterlockForm, skid: e.target.value as any })}
              style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
            >
              <option value="PASTEURIZER_10KLPH">Pasteurizer Skid</option>
              <option value="BATCH_MIXING">Batch Mixing Skid</option>
              <option value="COMMON">Common (All Skids)</option>
            </select>
            <input
              type="text"
              placeholder="Interlock Title / Name"
              value={newInterlockForm.name}
              onChange={(e) => setNewInterlockForm({ ...newInterlockForm, name: e.target.value })}
              style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
            />
            <button
              type="button"
              onClick={handleAddInterlock}
              className="btn btn-primary"
              style={{ padding: '5px 12px', fontSize: 11 }}
            >
              Add
            </button>
          </div>
          <div>
            <input
              type="text"
              placeholder="Safety trip rule & physical condition condition description..."
              value={newInterlockForm.condition}
              onChange={(e) => setNewInterlockForm({ ...newInterlockForm, condition: e.target.value })}
              style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
            />
          </div>
        </div>
      )}

      {/* Interlocks Matrix Table */}
      <div
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          maxHeight: '380px',
          overflowY: 'auto',
          background: '#ffffff',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-strong)', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '110px' }}>ID</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '110px' }}>Skid</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '220px' }}>Name / Designation</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Safety Condition & Trip Rule</th>
              <th style={{ padding: '8px 8px', fontWeight: 700, color: '#475569', width: '50px', textAlign: 'center' }}>Reset</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterlocks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                  No interlocks matched search filter
                </td>
              </tr>
            ) : (
              filteredInterlocks.map((def) => {
                const defaultDef = DEFAULT_INTERLOCK_DEFINITIONS.find((d) => d.id === def.id);
                const isModified = !defaultDef || defaultDef.name !== def.name || defaultDef.condition !== def.condition;

                return (
                  <tr
                    key={def.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isModified ? '#f0fdf4' : '#ffffff',
                    }}
                  >
                    {/* Interlock ID Badge */}
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: '#f1f5f9',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        {def.id}
                      </span>
                    </td>

                    {/* Skid */}
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background:
                            def.skid === 'PASTEURIZER_10KLPH'
                              ? '#ecfdf5'
                              : def.skid === 'BATCH_MIXING'
                              ? '#f0f9ff'
                              : '#f8fafc',
                          color:
                            def.skid === 'PASTEURIZER_10KLPH'
                              ? '#065f46'
                              : def.skid === 'BATCH_MIXING'
                              ? '#0369a1'
                              : '#475569',
                          border: `1px solid ${
                            def.skid === 'PASTEURIZER_10KLPH'
                              ? '#a7f3d0'
                              : def.skid === 'BATCH_MIXING'
                              ? '#bae6fd'
                              : '#e2e8f0'
                          }`,
                        }}
                      >
                        {def.skid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : def.skid === 'BATCH_MIXING' ? 'Batch Mixing' : 'Common'}
                      </span>
                    </td>

                    {/* Editable Name */}
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <input
                        type="text"
                        value={def.name}
                        onChange={(e) => handleInterlockFieldChange(def.id, 'name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: 11,
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          background: isModified ? '#ffffff' : '#f8fafc',
                        }}
                      />
                    </td>

                    {/* Editable Condition */}
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <input
                        type="text"
                        value={def.condition}
                        onChange={(e) => handleInterlockFieldChange(def.id, 'condition', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          background: isModified ? '#ffffff' : '#f8fafc',
                          color: '#334155',
                        }}
                      />
                    </td>

                    {/* Reset / Delete Action */}
                    <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                      {isModified ? (
                        <button
                          type="button"
                          onClick={() => handleResetSingleInterlock(def.id)}
                          title="Reset to default definition"
                          className="btn btn-ghost"
                          style={{ padding: '4px 6px', color: '#64748b' }}
                        >
                          <RotateCcw size={12} />
                        </button>
                      ) : (
                        <span style={{ fontSize: 9, color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Interlock Guidance */}
      <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Shield size={12} color="#0369a1" />
        <span>
          Interlock names and conditions are loaded dynamically from configuration instead of hardcoded in driver code. Changes persist locally and immediately update active PLC driver evaluation and FAT reports.
        </span>
      </div>
    </div>
  );
};
