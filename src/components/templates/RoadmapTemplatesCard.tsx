import React from 'react';
import { Cpu } from 'lucide-react';

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

export const RoadmapTemplatesCard: React.FC = () => {
  return (
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
  );
};
