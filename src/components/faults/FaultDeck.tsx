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

  const faultCatalog: { title: string; category: string; desc: string; fault: DeviceFault }[] = [
    {
      title: 'V-101 Seized Closed (Mechanical Failure)',
      category: 'Mechanical',
      desc: 'Simulates mechanical valve jam. Verifies IL-01 pump dry-run lockout.',
      fault: { deviceId: 'V-101', mode: 'stuck_closed' },
    },
    {
      title: 'V-101 Stuck 100% Open (Seat Rupture)',
      category: 'Mechanical',
      desc: 'Simulates seat blow-out or solenoid bypass. Fluid passes unconditionally.',
      fault: { deviceId: 'V-101', mode: 'stuck_open' },
    },
    {
      title: 'P-100 Motor Thermal Overload Trip',
      category: 'Electrical',
      desc: 'Simulates thermal contactor trip. Motor stops and drops running proof.',
      fault: { deviceId: 'P-100', mode: 'pump_trip' },
    },
    {
      title: 'TK-100 Transmitter Calibration Drift (-40%)',
      category: 'Instrumentation',
      desc: 'Simulates sensor drift on level transmitter. Tests low level alarm response.',
      fault: { deviceId: 'TK-100', mode: 'sensor_offset', value: -40 },
    },
    {
      title: 'V-102 Pilot Transit Delay (10 seconds)',
      category: 'Pneumatic',
      desc: 'Simulates restricted air pilot pressure. Tests PLC transit timeout alarm.',
      fault: { deviceId: 'V-102', mode: 'travel_delay', value: 10 },
    },
  ];

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
