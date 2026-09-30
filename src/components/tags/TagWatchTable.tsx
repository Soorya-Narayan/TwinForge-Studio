/**
 * TwinForge Studio - High-Frequency Industrial Tag Watch Table (Light Mode)
 * Real-time inspection and manual force/override of all PLC I/O tags.
 */

import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Search, ToggleLeft, ToggleRight } from 'lucide-react';

export const TagWatchTable: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const manualOverrideOutput = useSimulationStore((s) => s.manualOverrideOutput);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INPUTS' | 'OUTPUTS'>('ALL');

  const inputs = snapshot?.tags.inputs ?? {};
  const outputs = snapshot?.tags.outputs ?? {};

  // Combine into unified tag list
  const tagList: { name: string; direction: 'INPUT (SIM->PLC)' | 'OUTPUT (PLC->SIM)'; value: boolean | number }[] = [];

  if (filterType === 'ALL' || filterType === 'INPUTS') {
    for (const [key, val] of Object.entries(inputs)) {
      tagList.push({ name: key, direction: 'INPUT (SIM->PLC)', value: val });
    }
  }

  if (filterType === 'ALL' || filterType === 'OUTPUTS') {
    for (const [key, val] of Object.entries(outputs)) {
      tagList.push({ name: key, direction: 'OUTPUT (PLC->SIM)', value: val });
    }
  }

  const filteredTags = tagList.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="industrial-card" style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search & Filter Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search tags (e.g. V101, P100, LT, ZSO)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 32px',
              borderRadius: 4,
              border: '1px solid var(--border-strong)',
              background: '#ffffff',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'INPUTS', 'OUTPUTS'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterType(mode)}
              className={`btn ${filterType === mode ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '5px 12px' }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Industrial Tag Table */}
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 4, border: '1px solid var(--border-strong)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Tag Identifier</th>
              <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Signal Direction</th>
              <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Data Type</th>
              <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Current Value</th>
              <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Manual Force</th>
            </tr>
          </thead>
          <tbody>
            {filteredTags.map((tag) => {
              const isBool = typeof tag.value === 'boolean';
              const isOutput = tag.direction.startsWith('OUTPUT');

              return (
                <tr key={tag.name} style={{ borderBottom: '1px solid var(--border-subtle)', background: '#ffffff' }}>
                  <td className="mono" style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {tag.name}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span className={`badge ${isOutput ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: 9 }}>
                      {isOutput ? 'OUTPUT (PLC->SIM)' : 'INPUT (SIM->PLC)'}
                    </span>
                  </td>
                  <td className="mono" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                    {isBool ? 'BOOL' : 'REAL'}
                  </td>
                  <td className="mono" style={{ padding: '8px 12px' }}>
                    {isBool ? (
                      <span className={`badge ${tag.value ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                        {tag.value ? 'TRUE' : 'FALSE'}
                      </span>
                    ) : (
                      <span style={{ fontWeight: 700, color: '#0369a1' }}>
                        {Number(tag.value).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {isOutput && isBool ? (
                      <button
                        onClick={() => manualOverrideOutput(tag.name, !tag.value)}
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 10 }}
                      >
                        {tag.value ? <ToggleRight size={14} color="#059669" /> : <ToggleLeft size={14} color="#94a3b8" />}
                        {tag.value ? 'FORCE OFF' : 'FORCE ON'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Automatic</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
