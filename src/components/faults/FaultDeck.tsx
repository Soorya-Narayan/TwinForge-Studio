/**
 * TwinForge Studio - Industrial Fault Injection Station (Light Mode)
 * Engineered for factory acceptance and destructive safety interlock testing.
 */

import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { ShieldAlert, ZapOff } from 'lucide-react';
import type { DeviceFault } from '../../core/engine/types';

export const FaultDeck: React.FC = () => {
  const faults = useSimulationStore((s) => s.faults);
  const injectFault = useSimulationStore((s) => s.injectFault);
  const clearFaults = useSimulationStore((s) => s.clearFaults);

  const activeSkid = useSimulationStore((s) => s.activeSkid);

  const isFaultActive = (deviceId: string, mode: string) => {
    return faults.some((f) => f.deviceId === deviceId && f.mode === mode);
  };

  const toggleFault = (fault: DeviceFault) => {
    if (isFaultActive(fault.deviceId, fault.mode)) {
      injectFault({ deviceId: fault.deviceId, mode: 'none' });
    } else {
      injectFault(fault);
    }
  };

  const pasteurizerFaults = [
    {
      title: 'PHE-HEATING Thermal Anomaly (-15°C Offset)',
      category: 'Thermal / Instrumentation',
      desc: 'Drops holding tube temp TT5 below 88.0°C. Verifies legal diversion trip IL-FDV (PV11 closes, PV12 opens).',
      fault: { deviceId: 'PHE-HEATING', mode: 'sensor_offset' as const, value: -15 },
    },
    {
      title: 'PV-11 Forward Valve Seized Closed (Mechanical)',
      category: 'Mechanical Valve',
      desc: 'Simulates pneumatic seat failure on product delivery valve PV11. Tests rapid diversion response.',
      fault: { deviceId: 'PV-11', mode: 'stuck_closed' as const },
    },
    {
      title: 'PV-12 Divert Valve Jammed Open (Seat Leakage)',
      category: 'Mechanical Valve',
      desc: 'Simulates diversion valve stuck 100% open, recirculating product to Balance Tank.',
      fault: { deviceId: 'PV-12', mode: 'stuck_open' as const },
    },
    {
      title: 'P-FEED Feed Pump VFD Thermal Overload Trip',
      category: 'Electrical Drive',
      desc: 'Simulates motor thermal contactor trip on 5 HP main feed pump. Verifies line shutdown.',
      fault: { deviceId: 'P-FEED', mode: 'pump_trip' as const },
    },
    {
      title: 'P-BOOSTER Booster Pump Failure (DP Trip)',
      category: 'Electrical Drive',
      desc: 'Trips booster pump, dropping differential pressure PT4 - PT2 < 0.5 bar to trigger IL-DP safety interlock.',
      fault: { deviceId: 'P-BOOSTER', mode: 'pump_trip' as const },
    },
    {
      title: 'TK-BALANCE Transmitter Calibration Drift (-40%)',
      category: 'Instrumentation',
      desc: 'Simulates sensor drift on Balance Tank transmitter LT1. Tests low level lockout IL-BAL-LOW (LS1).',
      fault: { deviceId: 'TK-BALANCE', mode: 'sensor_offset' as const, value: -40 },
    },
    {
      title: 'PHE Plate Defect / Gasket Rupture (Plate Leak)',
      category: 'Plate Heat Exchanger',
      desc: 'Simulates a perforated plate between streams. Tests sanitary cross-contamination differential pressure rule (PT4 > PT2).',
      fault: { deviceId: 'PHE-HEATING', mode: 'plate_leak' as const, value: 65 },
    },
    {
      title: 'PHE Severe Thermal Fouling (Protein Burn-On)',
      category: 'Plate Heat Exchanger',
      desc: 'Accelerates plate mineral/protein fouling (5x rate multiplier), degrading overall U-value and raising section pressure drop.',
      fault: { deviceId: 'PHE-HEATING', mode: 'fouling' as const, value: 5.0 },
    },
    {
      title: 'Total Loss of Hot Water Supply (Heater Cutoff)',
      category: 'Thermal Utility',
      desc: 'Cuts steam/hot water circulation to HEATING section. Observes holding tube transit delay and automated diversion response.',
      fault: { deviceId: 'PHE-HEATING', mode: 'loss_of_hot_water' as const },
    },
  ];

  const batchMixingFaults = [
    {
      title: 'V-101 Seized Closed (Mechanical Failure)',
      category: 'Mechanical',
      desc: 'Simulates mechanical valve jam. Verifies IL-01 pump dry-run lockout.',
      fault: { deviceId: 'V-101', mode: 'stuck_closed' as const },
    },
    {
      title: 'V-101 Stuck 100% Open (Seat Rupture)',
      category: 'Mechanical',
      desc: 'Simulates seat blow-out or solenoid bypass. Fluid passes unconditionally.',
      fault: { deviceId: 'V-101', mode: 'stuck_open' as const },
    },
    {
      title: 'P-100 Motor Thermal Overload Trip',
      category: 'Electrical',
      desc: 'Simulates thermal contactor trip. Motor stops and drops running proof.',
      fault: { deviceId: 'P-100', mode: 'pump_trip' as const },
    },
    {
      title: 'TK-100 Transmitter Calibration Drift (-40%)',
      category: 'Instrumentation',
      desc: 'Simulates sensor drift on level transmitter. Tests low level alarm response.',
      fault: { deviceId: 'TK-100', mode: 'sensor_offset' as const, value: -40 },
    },
    {
      title: 'V-102 Pilot Transit Delay (10 seconds)',
      category: 'Pneumatic',
      desc: 'Simulates restricted air pilot pressure. Tests PLC transit timeout alarm.',
      fault: { deviceId: 'V-102', mode: 'travel_delay' as const, value: 10 },
    },
  ];

  const faultCatalog = activeSkid === 'PASTEURIZER_10KLPH' ? pasteurizerFaults : batchMixingFaults;

  return (
    <div className="industrial-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={20} color="var(--color-danger)" />
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Industrial Fault Injection Deck (Phase F)
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
              Inject controlled mechanical, electrical, and process disturbances to validate safety interlocks.
            </p>
          </div>
        </div>

        {faults.length > 0 && (
          <button onClick={clearFaults} className="btn btn-ghost" style={{ fontSize: 11 }}>
            <ZapOff size={13} />
            RESET ALL FAULTS ({faults.length})
          </button>
        )}
      </div>

      {/* Fault Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {faultCatalog.map((item, idx) => {
          const active = isFaultActive(item.fault.deviceId, item.fault.mode);
          return (
            <div
              key={idx}
              onClick={() => toggleFault(item.fault)}
              style={{
                background: active ? '#fef2f2' : '#ffffff',
                border: `1px solid ${active ? '#fca5a5' : 'var(--border-strong)'}`,
                borderRadius: 6,
                padding: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10,
                boxShadow: active ? '0 1px 3px rgba(220, 38, 38, 0.1)' : 'var(--shadow-sm)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#b91c1c' : 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  <span className={`badge ${active ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                    {item.category}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  TARGET: {item.fault.deviceId}
                </span>
                <span
                  className={`badge ${active ? 'badge-danger' : 'badge-neutral'}`}
                  style={{ fontSize: 10, fontWeight: 700 }}
                >
                  {active ? 'ACTIVE FAULT' : 'INJECT FAULT'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
