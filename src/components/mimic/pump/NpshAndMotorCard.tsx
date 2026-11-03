import React from 'react';
import type { CircuitOutputs } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import type { RawMilkSupplyCircuit } from '../../../core/engine/circuits/RawMilkSupplyCircuit';
import { ShieldAlert, Zap, Waves, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NpshAndMotorCardProps {
  circuit: RawMilkSupplyCircuit;
  outputs: CircuitOutputs;
}

export const NpshAndMotorCard: React.FC<NpshAndMotorCardProps> = ({ circuit, outputs }) => {
  const pumpState = outputs.pumpState;
  const pump = circuit.pump;

  // NPSH metrics
  const npsha = pumpState.npshaM;
  const npshr = pumpState.npshrM;
  const npshMargin = npsha - npshr;
  const isCavitating = pumpState.cavitation;
  const cavitationPenalty = isCavitating && npshr > 0
    ? Math.max(0, 1 - 1.5 * ((npshr - npsha) / Math.max(0.1, npshr)))
    : 1.0;

  // Motor metrics
  const currentA = pumpState.currentA;
  const ratedCurrentA = pump.config.motor.ratedCurrentA.value;
  const currentLoadPct = (currentA / Math.max(0.1, ratedCurrentA)) * 100;
  const powerKw = pumpState.shaftPowerKw;
  const ratedPowerKw = pump.config.motor.ratedPowerKw.value;
  const thermalAccumulatorPct = pump.getOverloadPct();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* 1. NPSH & Cavitation Assessment Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Waves size={16} color={isCavitating ? '#dc2626' : '#0284c7'} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Cavitation & NPSH
            </span>
          </div>
          {isCavitating ? (
            <span className="badge badge-danger" style={{ fontSize: 10 }}>
              <AlertTriangle size={10} /> CAVITATING
            </span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: 10 }}>
              <CheckCircle2 size={10} /> SAFE ({npshMargin.toFixed(1)}m)
            </span>
          )}
        </div>

        {/* NPSH Comparison Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>NPSHa (Available):</span>
              <span className="mono" style={{ fontWeight: 800, color: '#0284c7' }}>
                {npsha.toFixed(2)} m
              </span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (npsha / 15) * 100)}%`,
                  height: '100%',
                  background: npsha > npshr ? '#0284c7' : '#dc2626',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>NPSHr (Required):</span>
              <span className="mono" style={{ fontWeight: 800, color: '#64748b' }}>
                {npshr.toFixed(2)} m
              </span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (npshr / 15) * 100)}%`,
                  height: '100%',
                  background: '#64748b',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 4, fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Cavitation Penalty Factor:</span>
            <span className="mono" style={{ fontWeight: 700, color: cavitationPenalty < 1 ? '#dc2626' : '#059669' }}>
              {(cavitationPenalty * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Fluid Temperature:</span>
            <span className="mono" style={{ fontWeight: 700 }}>
              {circuit.siloTemperatureC.toFixed(1)}°C (Raw Chilled Milk)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Motor Electrical & Thermal Overload Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={16} color={pumpState.tripped ? '#dc2626' : '#f59e0b'} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Motor Electrical & I²t
            </span>
          </div>
          {pumpState.tripped ? (
            <span className="badge badge-danger" style={{ fontSize: 10 }}>
              <ShieldAlert size={10} /> TRIPPED
            </span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: 10 }}>
              {currentLoadPct.toFixed(0)}% LOAD
            </span>
          )}
        </div>

        {/* Current & Thermal Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Motor Current:</span>
              <span className="mono" style={{ fontWeight: 800, color: currentA > ratedCurrentA ? '#dc2626' : 'var(--text-primary)' }}>
                {currentA.toFixed(2)} A <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>/ {ratedCurrentA} A</span>
              </span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, currentLoadPct)}%`,
                  height: '100%',
                  background: currentLoadPct > 105 ? '#dc2626' : '#f59e0b',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Thermal Accumulator (I²t):</span>
              <span className="mono" style={{ fontWeight: 800, color: thermalAccumulatorPct > 80 ? '#dc2626' : '#059669' }}>
                {thermalAccumulatorPct.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, thermalAccumulatorPct)}%`,
                  height: '100%',
                  background: thermalAccumulatorPct > 80 ? '#dc2626' : '#059669',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 4, fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Shaft Power:</span>
            <span className="mono" style={{ fontWeight: 700 }}>
              {powerKw.toFixed(2)} kW / {ratedPowerKw} kW rated
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Motor Speed:</span>
            <span className="mono" style={{ fontWeight: 700 }}>
              {(pumpState.speedPct * 29).toFixed(0)} RPM ({pumpState.speedPct.toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
