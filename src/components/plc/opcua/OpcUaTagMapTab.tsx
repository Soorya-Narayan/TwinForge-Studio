import React from 'react';
import {
  Activity,
  Database,
  RotateCcw,
  Search,
  X,
  Plus,
} from 'lucide-react';
import {
  type TagDefinition,
  type TagDataType,
  getDefaultTagTypeMap,
} from '../../../core/driver/opcuaTagMap';

export interface OpcUaTagMapTabProps {
  activeSkid: string;
  outputTagsCount?: number;
  opcuaTagMap: Record<string, string>;
  setOpcuaTagType: (tag: string, type: TagDataType) => void;
  handleTagNodeIdChange: (tag: string, newNodeId: string) => void;
  handleResetSingleTag: (tag: string) => void;
  handleResetAllTags: () => void;
  handleApplySiemensPreset: () => void;
  handleApplyRockwellPreset: () => void;
  handleApplyCodesysPreset: () => void;
  siemensDbName: string;
  setSiemensDbName: (name: string) => void;
  siemensNamespace: number;
  setSiemensNamespace: (ns: number) => void;
  tagSearch: string;
  setTagSearch: (q: string) => void;
  tagSkidFilter: 'ALL' | 'PASTEURIZER_10KLPH' | 'BATCH_MIXING';
  setTagSkidFilter: (filter: 'ALL' | 'PASTEURIZER_10KLPH' | 'BATCH_MIXING') => void;
  tagDirectionFilter: 'ALL' | 'INPUT' | 'OUTPUT';
  setTagDirectionFilter: (filter: 'ALL' | 'INPUT' | 'OUTPUT') => void;
  showAddTag: boolean;
  setShowAddTag: (show: boolean) => void;
  newTagForm: {
    tag: string;
    description: string;
    direction: 'INPUT' | 'OUTPUT';
    dataType: TagDataType;
    nodeId: string;
  };
  setNewTagForm: React.Dispatch<
    React.SetStateAction<{
      tag: string;
      description: string;
      direction: 'INPUT' | 'OUTPUT';
      dataType: TagDataType;
      nodeId: string;
    }>
  >;
  handleAddCustomTag: () => void;
  allTagDefs: (TagDefinition & { isCustom?: boolean })[];
  filteredTags: (TagDefinition & { isCustom?: boolean })[];
}

export const OpcUaTagMapTab: React.FC<OpcUaTagMapTabProps> = ({
  activeSkid,
  outputTagsCount,
  opcuaTagMap,
  setOpcuaTagType,
  handleTagNodeIdChange,
  handleResetSingleTag,
  handleResetAllTags,
  handleApplySiemensPreset,
  handleApplyRockwellPreset,
  handleApplyCodesysPreset,
  siemensDbName,
  setSiemensDbName,
  siemensNamespace,
  setSiemensNamespace,
  tagSearch,
  setTagSearch,
  tagSkidFilter,
  setTagSkidFilter,
  tagDirectionFilter,
  setTagDirectionFilter,
  showAddTag,
  setShowAddTag,
  newTagForm,
  setNewTagForm,
  handleAddCustomTag,
  allTagDefs,
  filteredTags,
}) => {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        padding: '16px',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Skid Scan Isolation Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 6,
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          fontSize: 11,
          color: '#0369a1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={13} color="#0284c7" />
          <span>
            Current Scan Isolation: Polling <strong>{outputTagsCount ?? (activeSkid === 'PASTEURIZER_10KLPH' ? 8 : 10)} tags</strong> for <strong>{activeSkid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer Skid (10k LPH)' : activeSkid === 'BATCH_MIXING' ? 'Batch Mixing Skid' : 'Custom Skid'}</strong>
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 600 }}>
          Per-Skid Tag Splitting Active
        </span>
      </div>

      {/* Presets and Quick Actions */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={13} color="var(--color-primary)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
              PLC Addressing Presets (Instant Map)
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetAllTags}
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: '3px 8px', color: '#64748b' }}
          >
            <RotateCcw size={11} /> Reset All to Default (ns=1;s=TAG)
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {/* Siemens DB Preset with custom inputs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#f1f5f9',
              padding: '3px 6px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>Siemens DB:</span>
            <span style={{ fontSize: 9, color: '#64748b' }}>ns=</span>
            <input
              type="number"
              min={1}
              max={20}
              value={siemensNamespace}
              onChange={(e) => setSiemensNamespace(parseInt(e.target.value) || 3)}
              style={{
                width: '32px',
                padding: '2px 4px',
                fontSize: 10,
                fontFamily: 'monospace',
                border: '1px solid #94a3b8',
                borderRadius: 3,
                textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 9, color: '#64748b' }}>;s="</span>
            <input
              type="text"
              value={siemensDbName}
              onChange={(e) => setSiemensDbName(e.target.value)}
              placeholder="DB_Process"
              style={{
                width: '84px',
                padding: '2px 6px',
                fontSize: 10,
                fontFamily: 'monospace',
                border: '1px solid #94a3b8',
                borderRadius: 3,
              }}
            />
            <span style={{ fontSize: 9, color: '#64748b' }}>"."TAG"</span>
            <button
              type="button"
              onClick={handleApplySiemensPreset}
              className="btn btn-primary"
              style={{ padding: '3px 8px', fontSize: 10, marginLeft: 2 }}
            >
              Apply
            </button>
          </div>

          {/* Rockwell Allen-Bradley Preset */}
          <button
            type="button"
            onClick={handleApplyRockwellPreset}
            className="btn btn-ghost"
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              border: '1px solid var(--border-strong)',
              background: '#ffffff',
            }}
          >
            Rockwell Logix (ns=1;s=Program:MainProgram.TAG)
          </button>

          {/* CODESYS / TwinCAT Preset */}
          <button
            type="button"
            onClick={handleApplyCodesysPreset}
            className="btn btn-ghost"
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              border: '1px solid var(--border-strong)',
              background: '#ffffff',
            }}
          >
            CODESYS / TwinCAT (ns=2;s=MAIN.TAG)
          </button>
        </div>
      </div>

      {/* Filters and Add Custom Tag toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
          />
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Search internal tag, description, or PLC NodeId (e.g. TT5, DB_Process)..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 28px',
              fontSize: 11,
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: '#ffffff',
            }}
          />
          {tagSearch && (
            <button
              type="button"
              onClick={() => setTagSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Skid Filter */}
        <select
          value={tagSkidFilter}
          onChange={(e) => setTagSkidFilter(e.target.value as any)}
          style={{
            padding: '6px 10px',
            fontSize: 11,
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: '#ffffff',
          }}
        >
          <option value="ALL">All Skids ({allTagDefs.length})</option>
          <option value="PASTEURIZER_10KLPH">Pasteurizer 10k LPH</option>
          <option value="BATCH_MIXING">Batch Mixing Skid</option>
        </select>

        {/* Direction Filter */}
        <select
          value={tagDirectionFilter}
          onChange={(e) => setTagDirectionFilter(e.target.value as any)}
          style={{
            padding: '6px 10px',
            fontSize: 11,
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: '#ffffff',
          }}
        >
          <option value="ALL">All I/O</option>
          <option value="INPUT">Inputs (Sensors → PLC)</option>
          <option value="OUTPUT">Outputs (PLC → Actuators)</option>
        </select>

        {/* Add Custom Tag Button */}
        <button
          type="button"
          onClick={() => setShowAddTag(!showAddTag)}
          className="btn btn-ghost"
          style={{
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid var(--border-strong)',
            background: showAddTag ? '#e0f2fe' : '#ffffff',
            color: showAddTag ? '#0369a1' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Plus size={12} /> Add Tag
        </button>
      </div>

      {/* Add Custom Tag Drawer Form */}
      {showAddTag && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr 0.9fr 0.9fr 1.8fr auto',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
              Tag Name (Key):
            </label>
            <input
              type="text"
              placeholder="e.g. TT_HOLDING_2"
              value={newTagForm.tag}
              onChange={(e) => setNewTagForm({ ...newTagForm, tag: e.target.value })}
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
              Direction:
            </label>
            <select
              value={newTagForm.direction}
              onChange={(e) => setNewTagForm({ ...newTagForm, direction: e.target.value as any })}
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 11,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: '#ffffff',
              }}
            >
              <option value="INPUT">INPUT (Sensor → PLC)</option>
              <option value="OUTPUT">OUTPUT (PLC → Actuator)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
              Data Type:
            </label>
            <select
              value={newTagForm.dataType}
              onChange={(e) => setNewTagForm({ ...newTagForm, dataType: e.target.value as TagDataType })}
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 11,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: '#ffffff',
              }}
            >
              <option value="Float">Float (32-bit REAL)</option>
              <option value="Double">Double (64-bit)</option>
              <option value="Int16">Int16 (16-bit INT)</option>
              <option value="Int32">Int32 (32-bit DINT)</option>
              <option value="Boolean">Boolean (BOOL)</option>
              <option value="String">String</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
              PLC NodeId:
            </label>
            <input
              type="text"
              placeholder='ns=3;s="DB_Process"."TT_HOLDING_2"'
              value={newTagForm.nodeId}
              onChange={(e) => setNewTagForm({ ...newTagForm, nodeId: e.target.value })}
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={handleAddCustomTag}
              className="btn btn-primary"
              style={{ padding: '5px 12px', fontSize: 11 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAddTag(false)}
              className="btn btn-ghost"
              style={{ padding: '5px 10px', fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tag Mapping Table */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          maxHeight: '380px',
          overflowY: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11 }}>
          <thead
            style={{
              background: '#f1f5f9',
              borderBottom: '1px solid var(--border-strong)',
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}
          >
            <tr>
              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', width: '28%' }}>
                Internal Simulator Tag
              </th>
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#334155', width: '22%' }}>
                Direction / Type
              </th>
              <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', width: '42%' }}>
                PLC NodeId (Addressing)
              </th>
              <th style={{ padding: '8px 8px', fontWeight: 700, color: '#334155', width: '8%', textAlign: 'center' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTags.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                  No tags match the current search or filter.
                </td>
              </tr>
            ) : (
              filteredTags.map((def) => {
                const currentAddress = opcuaTagMap[def.tag] ?? def.defaultNodeId;
                const defaultTypes = getDefaultTagTypeMap();
                const isAddressModified = currentAddress !== def.defaultNodeId;
                const isTypeModified = def.dataType !== (defaultTypes[def.tag] ?? (def.direction === 'INPUT' && def.tag.startsWith('DI_') ? 'Boolean' : 'Float'));
                const isModified = isAddressModified || isTypeModified;

                return (
                  <tr
                    key={def.tag}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isModified ? '#f0fdf4' : '#ffffff',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Internal Tag Name & Description */}
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                          {def.tag}
                        </span>
                        {isModified && (
                          <span
                            style={{
                              fontSize: 8,
                              padding: '1px 4px',
                              borderRadius: 2,
                              background: '#bbf7d0',
                              color: '#14532d',
                              fontWeight: 700,
                            }}
                          >
                            MODIFIED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                        {def.name} · {def.description}
                      </div>
                    </td>

                    {/* Direction & Data Type */}
                    <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: def.direction === 'INPUT' ? '#eff6ff' : '#fef3c7',
                              color: def.direction === 'INPUT' ? '#1e40af' : '#92400e',
                              border: `1px solid ${def.direction === 'INPUT' ? '#bfdbfe' : '#fde68a'}`,
                            }}
                          >
                            {def.direction === 'INPUT' ? 'INPUT' : 'OUTPUT'}
                          </span>
                          <select
                            value={def.dataType}
                            onChange={(e) => setOpcuaTagType(def.tag, e.target.value as TagDataType)}
                            style={{
                              fontSize: 10,
                              fontFamily: 'monospace',
                              padding: '1px 4px',
                              border: `1px solid ${isTypeModified ? '#86efac' : 'var(--border-strong)'}`,
                              borderRadius: 3,
                              background: isTypeModified ? '#ecfdf5' : '#ffffff',
                              color: '#0f172a',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="Float">Float (32-bit REAL)</option>
                            <option value="Double">Double (64-bit)</option>
                            <option value="Int16">Int16 (16-bit INT)</option>
                            <option value="Int32">Int32 (32-bit DINT)</option>
                            <option value="Boolean">Boolean (BOOL)</option>
                            <option value="String">String</option>
                          </select>
                        </div>
                        <span style={{ fontSize: 9, color: '#64748b' }}>
                          {def.skid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : def.skid === 'BATCH_MIXING' ? 'Batch Mixing' : 'Custom'}
                        </span>
                      </div>
                    </td>

                    {/* PLC NodeId Editable Input */}
                    <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                      <input
                        type="text"
                        value={currentAddress}
                        onChange={(e) => handleTagNodeIdChange(def.tag, e.target.value)}
                        placeholder={def.defaultNodeId}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          border: `1px solid ${isModified ? '#86efac' : 'var(--border-strong)'}`,
                          borderRadius: 4,
                          background: isModified ? '#ffffff' : '#f8fafc',
                          color: '#0f172a',
                        }}
                      />
                    </td>

                    {/* Action / Reset */}
                    <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                      {isModified ? (
                        <button
                          type="button"
                          onClick={() => handleResetSingleTag(def.tag)}
                          title="Reset to default NodeId and data type"
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

      {/* Addressing Guide Tip */}
      <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: '#334155' }}>NodeId Syntax:</span>
        <span>Siemens: <code style={{ color: '#0369a1' }}>ns=3;s="DB_Process"."TT5"</code></span>
        <span>·</span>
        <span>Rockwell: <code style={{ color: '#0369a1' }}>ns=1;s=Program:MainProgram.TT5</code></span>
        <span>·</span>
        <span>CODESYS: <code style={{ color: '#0369a1' }}>ns=2;s=MAIN.TT5</code></span>
        <span>·</span>
        <span>Numeric: <code style={{ color: '#0369a1' }}>ns=2;i=1005</code></span>
      </div>
    </div>
  );
};
