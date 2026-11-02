/**
 * TwinForge Studio - Real PLC Driver & OPC UA Connection Modal
 * Configures connection to real external PLCs via OPC UA (node-opcua) or embedded test server.
 */

import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { OpcUaPlcDriver } from '../../core/driver/OpcUaPlcDriver';
import {
  Server,
  Cpu,
  Plug,
  Unplug,
  Activity,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
} from 'lucide-react';

interface OpcUaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpcUaModal: React.FC<OpcUaModalProps> = ({ isOpen, onClose }) => {
  const driverMode = useSimulationStore((s) => s.driverMode);
  const plc = useSimulationStore((s) => s.plc);
  const opcuaEndpoint = useSimulationStore((s) => s.opcuaEndpoint);
  const setDriverMode = useSimulationStore((s) => s.setDriverMode);
  const connectOpcUa = useSimulationStore((s) => s.connectOpcUa);
  const disconnectOpcUa = useSimulationStore((s) => s.disconnectOpcUa);
  const startLocalOpcUaServer = useSimulationStore((s) => s.startLocalOpcUaServer);
  const stopLocalOpcUaServer = useSimulationStore((s) => s.stopLocalOpcUaServer);

  const [customEndpoint, setCustomEndpoint] = useState<string | null>(null);
  const endpointInput = customEndpoint ?? opcuaEndpoint;
  const [connecting, setConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [serverStarting, setServerStarting] = useState(false);

  const isOpcUa = driverMode === 'OPCUA';
  const opcDriver = plc instanceof OpcUaPlcDriver ? plc : null;
  const isConnected = isOpcUa && (opcDriver?.status.connected ?? false);
  const isServerRunning = opcDriver?.serverRunning ?? false;
  const latencyMs = opcDriver?.status.latencyMs ?? 0;

  if (!isOpen) return null;

  const handleSelectMode = async (mode: 'MOCK' | 'OPCUA') => {
    setStatusMsg(null);
    try {
      await setDriverMode(mode, endpointInput);
      setStatusMsg({
        type: 'success',
        text: mode === 'OPCUA' ? 'Switched to Real PLC Driver (OPC UA)' : 'Switched to In-Process Mock PLC Driver',
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to switch driver' });
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setStatusMsg(null);
    try {
      await connectOpcUa(endpointInput);
      setStatusMsg({ type: 'success', text: `Connected to OPC UA Server: ${endpointInput}` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Connection failed. Verify endpoint and PLC network reachability.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectOpcUa();
      setStatusMsg({ type: 'info', text: 'Disconnected from OPC UA Server.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to disconnect' });
    }
  };

  const handleStartLocalServer = async () => {
    setServerStarting(true);
    setStatusMsg(null);
    try {
      const url = await startLocalOpcUaServer(4840);
      setCustomEndpoint(url);
      setStatusMsg({ type: 'success', text: `Embedded OPC UA Test Server active on ${url}` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Could not start embedded server' });
    } finally {
      setServerStarting(false);
    }
  };

  const handleStopLocalServer = async () => {
    try {
      await stopLocalOpcUaServer();
      setStatusMsg({ type: 'info', text: 'Embedded OPC UA server stopped.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Could not stop server' });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="industrial-card"
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '680px',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={18} color="var(--color-primary)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                PLC Driver Configuration · OPC UA (IEC 62541)
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Hardware-in-the-Loop simulation & real industrial PLC FAT verification
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Status Alert Banner */}
          {statusMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background:
                  statusMsg.type === 'success'
                    ? '#ecfdf5'
                    : statusMsg.type === 'error'
                    ? '#fef2f2'
                    : '#f0f9ff',
                color:
                  statusMsg.type === 'success'
                    ? '#065f46'
                    : statusMsg.type === 'error'
                    ? '#991b1b'
                    : '#0369a1',
                border: `1px solid ${
                  statusMsg.type === 'success'
                    ? '#a7f3d0'
                    : statusMsg.type === 'error'
                    ? '#fecaca'
                    : '#bae6fd'
                }`,
              }}
            >
              {statusMsg.type === 'success' && <CheckCircle2 size={14} />}
              {statusMsg.type === 'error' && <AlertTriangle size={14} />}
              {statusMsg.type === 'info' && <Activity size={14} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Driver Mode Selection */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
              Select Active PLC Driver:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Mock Driver Card */}
              <div
                onClick={() => handleSelectMode('MOCK')}
                style={{
                  border: `2px solid ${!isOpcUa ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                  background: !isOpcUa ? '#f0f9ff' : '#ffffff',
                  padding: '12px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Cpu size={16} color={!isOpcUa ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    In-Process Mock Driver
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Fast local simulation logic executed in-memory. Ideal for offline demo and initial design.
                </div>
              </div>

              {/* Real OPC UA Driver Card */}
              <div
                onClick={() => handleSelectMode('OPCUA')}
                style={{
                  border: `2px solid ${isOpcUa ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                  background: isOpcUa ? '#f0f9ff' : '#ffffff',
                  padding: '12px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Server size={16} color={isOpcUa ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Real PLC · OPC UA Driver
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Communicates with live physical PLC or software controller via <strong>node-opcua</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* OPC UA Connection Parameters (Shown when OPC UA selected) */}
          {isOpcUa && (
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  OPC UA Server Connection
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`led ${isConnected ? 'led-normal' : 'led-alarm'}`} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: isConnected ? '#059669' : '#dc2626' }}>
                    {isConnected ? `CONNECTED (${latencyMs}ms)` : 'NOT CONNECTED'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  OPC UA Server Endpoint URL:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="opc.tcp://192.168.1.100:4840"
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: '#ffffff',
                    }}
                  />
                  {!isConnected ? (
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="btn btn-primary"
                      style={{ padding: '7px 14px', fontSize: 11 }}
                    >
                      <Plug size={13} />
                      {connecting ? 'CONNECTING...' : 'CONNECT'}
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnect}
                      className="btn btn-danger"
                      style={{ padding: '7px 14px', fontSize: 11 }}
                    >
                      <Unplug size={13} />
                      DISCONNECT
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  Compatible with standard OPC UA (IEC 62541) servers over opc.tcp:// protocol.
                </div>
              </div>

              {/* Embedded Test Server Option */}
              <div
                style={{
                  borderTop: '1px dashed var(--border-subtle)',
                  paddingTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                    Embedded Test OPC UA Server (Local Loopback)
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Runs an in-process OPC UA server on port 4840 with all skid I/O pre-configured for verification.
                  </div>
                </div>
                {!isServerRunning ? (
                  <button
                    onClick={handleStartLocalServer}
                    disabled={serverStarting}
                    className="btn btn-ghost"
                    style={{
                      padding: '5px 12px',
                      fontSize: 11,
                      border: '1px solid var(--border-strong)',
                      background: '#ffffff',
                    }}
                  >
                    <Play size={12} color="var(--color-primary)" />
                    {serverStarting ? 'STARTING...' : 'START TEST SERVER'}
                  </button>
                ) : (
                  <button
                    onClick={handleStopLocalServer}
                    className="btn btn-ghost"
                    style={{
                      padding: '5px 12px',
                      fontSize: 11,
                      border: '1px solid #fca5a5',
                      background: '#fef2f2',
                      color: '#dc2626',
                    }}
                  >
                    <Square size={12} />
                    STOP TEST SERVER
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Info & Help */}
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5, background: '#f8fafc', padding: 10, borderRadius: 4 }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={11} />
              FAT Verification Notice:
            </div>
            When OPC UA Driver is active, the Automated FAT Suite executes test stimulus directly against the connected PLC and asserts scan-by-scan tags read over the wire. Test evidence logs and the generated FAT report document the live OPC UA endpoint for full audit traceability.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid var(--border-strong)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '6px 18px', fontSize: 11 }}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
