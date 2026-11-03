import React from 'react';
import { Layers } from 'lucide-react';

export const PasteurizerLegend: React.FC = () => {
  return (
    <div
      className="industrial-card"
      style={{
        padding: '16px 20px',
        borderRadius: 8,
        background: '#ffffff',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Layers size={16} color="var(--color-primary)" />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Process Schematic Legend & Component Directory
        </h4>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {/* Column 1: Pipelines & Streams */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Pipelines & Flow Streams
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 4, background: '#0284c7', borderRadius: 2 }} />
              <span><strong>Raw / Process Milk (Ø 51 mm)</strong>: Main process stream</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 4, background: '#059669', borderRadius: 2 }} />
              <span><strong>Pasteurized Legal Product</strong>: Forward flow to Silo (4.0°C)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 3, borderTop: '3px dashed #dc2626' }} />
              <span><strong>Recirculation Divert Line</strong>: Under-temp return to Balance Tank</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 4, background: '#d97706', borderRadius: 2 }} />
              <span><strong>Heating & Steam Circuit</strong>: 1.5" Steam / 95°C Hot Water loop</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 4, background: '#38bdf8', borderRadius: 2 }} />
              <span><strong>Chilled Water & Utilities</strong>: Ø 63 mm Cooling supply (4°C)</span>
            </div>
          </div>
        </div>

        {/* Column 2: Major Equipment */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Major Processing Units
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
            <div><strong>Balance Tank</strong>: 600L raw infeed float buffer vessel</div>
            <div><strong>PHE (Plate Heat Exchanger)</strong>: 4-stage thermal recovery & heating block</div>
            <div><strong>Cream Separator</strong>: Centrifugal whole-milk fractionator (10,000 LPH)</div>
            <div><strong>Homogenizer</strong>: 2-stage high-shear particle breaker (200 bar)</div>
            <div><strong>Holding Coil</strong>: 20-second sanitary residence tube for pathogen elimination</div>
            <div><strong>Storage Silo</strong>: Finished pasteurized milk buffer reservoir</div>
          </div>
        </div>

        {/* Column 3: Actuators & Valves */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Valves & Actuation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
            <div><strong>PV1 / PV2</strong>: Raw milk infeed & CIP flush valves</div>
            <div><strong>PV4 / PV5</strong>: Cream separator feed & skim return</div>
            <div><strong>PV8</strong>: Homogenizer infeed isolation valve</div>
            <div><strong>PV10</strong>: Chilled water modulating cooling regulator</div>
            <div><strong>PV11 (Forward)</strong>: Legal pasteurization product forward valve</div>
            <div><strong>PV12 (Divert)</strong>: Safety diversion valve routing to Balance Tank</div>
            <div><strong>SCV1</strong>: Modulating steam valve controlling hot water temperature</div>
          </div>
        </div>

        {/* Column 4: Process Sensors & Transmitters */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Sensors & Safety Transmitters
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
            <div><strong className="mono">TT1..TT9</strong>: Process temperature transmitters (Holding: TT5)</div>
            <div><strong className="mono">PT1..PT7</strong>: Process pressure transmitters (Homogenizer: PT3)</div>
            <div><strong className="mono">LT1</strong>: Balance tank hydrostatic continuous level sensor</div>
            <div><strong className="mono">LS1 / LS2</strong>: Dry-run pump cutoff (LS1) & overfill trip (LS2)</div>
            <div><strong className="mono">FM</strong>: Electromagnetic in-line flow meter (0–12,000 LPH)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
