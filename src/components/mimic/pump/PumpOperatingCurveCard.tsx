import React from 'react';
import type { CircuitOutputs } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import type { RawMilkSupplyCircuit } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import { Activity, Info } from 'lucide-react';

interface PumpOperatingCurveCardProps {
  circuit: RawMilkSupplyCircuit;
  outputs: CircuitOutputs;
}

export const PumpOperatingCurveCard: React.FC<PumpOperatingCurveCardProps> = ({ circuit, outputs }) => {
  const pump = circuit.pump;
  const pumpState = outputs.pumpState;
  const flowLph = outputs.flowLph;
  const headM = pumpState.headM;

  // SVG coordinate system mapping
  // X: Flow from 0 to 24,000 L/h -> 40 to 360 px
  // Y: Head from 0 to 40 m -> 200 to 20 px
  const svgWidth = 380;
  const svgHeight = 220;
  const margin = { left: 45, right: 20, top: 20, bottom: 30 };
  const graphWidth = svgWidth - margin.left - margin.right;
  const graphHeight = svgHeight - margin.top - margin.bottom;

  const maxPlotFlow = 22000;
  const maxPlotHead = 38;

  const mapX = (q: number) => margin.left + (Math.max(0, Math.min(maxPlotFlow, q)) / maxPlotFlow) * graphWidth;
  const mapY = (h: number) => margin.top + graphHeight - (Math.max(0, Math.min(maxPlotHead, h)) / maxPlotHead) * graphHeight;

  // Generate pump head curve points
  const pumpPoints: string[] = [];
  const systemPoints: string[] = [];

  // Pump curve: H(q) at current speed ratio
  const speedRatio = Math.max(0.1, pumpState.speedRatio);
  for (let q = 0; q <= 20000; q += 500) {
    const h = pump.getHeadM(q, speedRatio);
    pumpPoints.push(`${mapX(q)},${mapY(h)}`);
  }

  // System resistance curve: H_sys = H_static + K * Q^2
  // Static head: balanceTankInletElevationM - siloLevelM (or downstreamHeadM - siloLevelM)
  const staticHeadM = Math.max(0, circuit.balanceTankInletElevationM - circuit.siloLevelM);
  for (let q = 0; q <= 20000; q += 500) {
    // Approx system loss in m based on operating point resistance
    const lossHeadM = (flowLph > 500 && headM > staticHeadM)
      ? (headM - staticHeadM) * Math.pow(q / Math.max(1, flowLph), 2)
      : (12.0) * Math.pow(q / 16000, 2);
    const totalSysHead = staticHeadM + lossHeadM;
    systemPoints.push(`${mapX(q)},${mapY(totalSysHead)}`);
  }

  const opX = mapX(flowLph);
  const opY = mapY(headM);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            Pump Operating Characteristic H(Q)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="badge badge-primary mono" style={{ fontSize: 11 }}>
            Q* = {flowLph.toLocaleString()} L/h ({outputs.flowLpm.toFixed(1)} L/min)
          </span>
          <span className="badge badge-neutral mono" style={{ fontSize: 11 }}>
            H* = {headM.toFixed(1)} m
          </span>
        </div>
      </div>

      {/* SVG Graph Canvas */}
      <div style={{ width: '100%', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          {[0, 10, 20, 30].map((h) => (
            <g key={h}>
              <line x1={margin.left} y1={mapY(h)} x2={svgWidth - margin.right} y2={mapY(h)} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={margin.left - 6} y={mapY(h) + 4} textAnchor="end" fill="#64748b" fontSize="9" className="mono">
                {h}m
              </text>
            </g>
          ))}

          {[0, 5000, 10000, 15000, 20000].map((q) => (
            <g key={q}>
              <line x1={mapX(q)} y1={margin.top} x2={mapX(q)} y2={svgHeight - margin.bottom} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={mapX(q)} y={svgHeight - margin.bottom + 14} textAnchor="middle" fill="#64748b" fontSize="8" className="mono">
                {q / 1000}k
              </text>
            </g>
          ))}

          {/* Run-out region background strip (> 16,320 L/h) */}
          <rect
            x={mapX(16320)}
            y={margin.top}
            width={mapX(maxPlotFlow) - mapX(16320)}
            height={graphHeight}
            fill="#fee2e2"
            opacity={0.45}
          />
          <text x={(mapX(16320) + mapX(maxPlotFlow)) / 2} y={margin.top + 14} textAnchor="middle" fill="#dc2626" fontSize="8" fontWeight="bold">
            RUN-OUT ZONE
          </text>

          {/* System Resistance Curve */}
          <polyline points={systemPoints.join(' ')} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4 2" />

          {/* Pump H(Q) Curve */}
          <polyline points={pumpPoints.join(' ')} fill="none" stroke="#0284c7" strokeWidth="3" />

          {/* Operating Point Crosshairs & Marker */}
          {flowLph > 0 && (
            <g>
              <line x1={margin.left} y1={opY} x2={opX} y2={opY} stroke="#059669" strokeDasharray="2 2" strokeWidth="1.2" />
              <line x1={opX} y1={opY} x2={opX} y2={svgHeight - margin.bottom} stroke="#059669" strokeDasharray="2 2" strokeWidth="1.2" />
              <circle cx={opX} cy={opY} r="6" fill="#059669" stroke="#ffffff" strokeWidth="2" />
              <circle cx={opX} cy={opY} r="10" fill="none" stroke="#059669" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* Axis Labels */}
          <text x={svgWidth / 2} y={svgHeight - 4} textAnchor="middle" fill="#475569" fontSize="10" fontWeight="bold">
            Flow Rate Q (L/h)
          </text>
          <text
            x={-svgHeight / 2}
            y="12"
            transform="rotate(-90)"
            textAnchor="middle"
            fill="#475569"
            fontSize="10"
            fontWeight="bold"
          >
            Head H (m)
          </text>
        </svg>
      </div>

      {/* Legend & KPI Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
        <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>RATED OPERATING POINT</div>
          <div style={{ fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
            {pump.ratedFlowLph.toLocaleString()} L/h @ {pump.ratedHeadM} m
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>SHUT-OFF HEAD (Q=0)</div>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
            {pump.a.toFixed(1)} m ({((1032 * 9.80665 * pump.a) / 100000).toFixed(2)} bar)
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>PUMP EFFICIENCY (η)</div>
          <div style={{ fontWeight: 800, color: '#059669', marginTop: 2 }}>
            {pumpState.efficiencyPct.toFixed(1)}% (Peak: {pump.config.efficiencyPeak.efficiencyPct.value}%)
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', background: '#eff6ff', padding: '6px 10px', borderRadius: 4 }}>
        <Info size={14} color="#0284c7" />
        <span>
          Intersection of the blue pump curve and amber system curve determines the solved operating point.
        </span>
      </div>
    </div>
  );
};
