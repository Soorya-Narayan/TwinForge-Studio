/**
 * TwinForge Studio - Real PLC Driver & OPC UA Connection Modal
 * Configures connection to real external PLCs via OPC UA (node-opcua) or embedded test server.
 */

import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  OpcUaPlcDriver,
  type OpcUaSecurityMode,
  type OpcUaSecurityPolicy,
  type OpcUaAuthMode,
  type OpcUaConnectionOptions,
} from '../../core/driver/OpcUaPlcDriver';
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
  Shield,
  Lock,
  User,
  FolderOpen,
} from 'lucide-react';

interface OpcUaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpcUaModal: React.FC<OpcUaModalProps> = ({ isOpen, onClose }) => {
  const driverMode = useSimulationStore((s) => s.driverMode);
  const plc = useSimulationStore((s) => s.plc);
  const opcuaEndpoint = useSimulationStore((s) => s.opcuaEndpoint);
  const opcuaSecurityOptions = useSimulationStore((s) => s.opcuaSecurityOptions);
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

  // Security & Authentication options state
  const savedOpts = opcuaSecurityOptions || opcDriver?.securityOptions;
  const [securityMode, setSecurityMode] = useState<OpcUaSecurityMode>(savedOpts?.securityMode ?? 'None');
  const [securityPolicy, setSecurityPolicy] = useState<OpcUaSecurityPolicy>(savedOpts?.securityPolicy ?? 'None');
  const [authMode, setAuthMode] = useState<OpcUaAuthMode>(savedOpts?.authMode ?? 'Anonymous');
  const [username, setUsername] = useState<string>(savedOpts?.username ?? '');
  const [password, setPassword] = useState<string>(savedOpts?.password ?? '');
  const [certificatePath, setCertificatePath] = useState<string>(savedOpts?.certificatePath ?? '');
  const [privateKeyPath, setPrivateKeyPath] = useState<string>(savedOpts?.privateKeyPath ?? '');

  if (!isOpen) return null;

  const buildConnectionOptions = (): OpcUaConnectionOptions => ({
    endpointUrl: endpointInput,
    securityMode,
    securityPolicy,
    authMode,
    username: authMode === 'Username' ? username : undefined,
    password: authMode === 'Username' ? password : undefined,
    certificatePath: authMode === 'Certificate' ? certificatePath : undefined,
    privateKeyPath: authMode === 'Certificate' ? privateKeyPath : undefined,
  });

  const handleSelectMode = async (mode: 'MOCK' | 'OPCUA') => {
    setStatusMsg(null);
    try {
      const opts = buildConnectionOptions();
      await setDriverMode(mode, opts);
      setStatusMsg({
        type: 'success',
        text: mode === 'OPCUA' ? 'Switched to Real PLC Driver (OPC UA)' : 'Switched to In-Process Mock PLC Driver',
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to switch driver' });
    }
  };

  const handleBrowseCert = async () => {
    if (!window.electronAPI?.openFile) return;
    try {
      const res = await window.electronAPI.openFile({
        filters: [
          { name: 'X.509 Certificates', extensions: ['der', 'pem', 'crt', 'cer'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!res.canceled && res.filePath) {
        setCertificatePath(res.filePath);
      }
    } catch (err: any) {
      console.warn('Certificate browse failed:', err);
    }
  };

  const handleBrowseKey = async () => {
    if (!window.electronAPI?.openFile) return;
    try {
      const res = await window.electronAPI.openFile({
        filters: [
          { name: 'Private Keys', extensions: ['pem', 'key', 'der'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!res.canceled && res.filePath) {
        setPrivateKeyPath(res.filePath);
      }
    } catch (err: any) {
      console.warn('Private key browse failed:', err);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setStatusMsg(null);
    try {
      const opts = buildConnectionOptions();
      await connectOpcUa(opts);
      const secInfo = securityMode !== 'None' ? ` [${securityMode} / ${securityPolicy}]` : '';
      const authInfo = authMode !== 'Anonymous' ? ` (${authMode})` : '';
      setStatusMsg({ type: 'success', text: `Connected to OPC UA Server: ${endpointInput}${secInfo}${authInfo}` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Connection failed. Verify endpoint, security mode, credentials, and PLC network reachability.' });
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
      setSecurityMode('None');
      setSecurityPolicy('None');
      setAuthMode('Username');
      setUsername('admin');
      setPassword('admin');
      setStatusMsg({ type: 'success', text: `Embedded OPC UA Test Server active on ${url} (127.0.0.1) · Authenticated as admin (anonymous writes restricted)` });
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
          maxWidth: '720px',
          maxHeight: '90vh',
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
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
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

              {/* Security & Authentication Options */}
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  background: '#ffffff',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={14} color="var(--color-primary)" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Security Mode, Policy & Authentication (IEC 62541)
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: securityMode !== 'None' ? '#ecfdf5' : '#f1f5f9',
                      color: securityMode !== 'None' ? '#065f46' : '#64748b',
                      border: securityMode !== 'None' ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                    }}
                  >
                    {securityMode !== 'None' ? `${securityMode} · ${securityPolicy}` : 'PLAINTEXT (NONE)'}
                  </span>
                </div>

                {/* Security Mode & Security Policy Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Security Mode:
                    </label>
                    <select
                      value={securityMode}
                      onChange={(e) => {
                        const val = e.target.value as OpcUaSecurityMode;
                        setSecurityMode(val);
                        if (val === 'None') {
                          setSecurityPolicy('None');
                        } else if (securityPolicy === 'None') {
                          setSecurityPolicy('Basic256Sha256');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid var(--border-strong)',
                        background: '#ffffff',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="None">None (Unencrypted / Local Dev)</option>
                      <option value="Sign">Sign (Cryptographic Integrity)</option>
                      <option value="SignAndEncrypt">SignAndEncrypt (Full Confidentiality)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Security Policy:
                    </label>
                    <select
                      value={securityPolicy}
                      onChange={(e) => setSecurityPolicy(e.target.value as OpcUaSecurityPolicy)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid var(--border-strong)',
                        background: '#ffffff',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="None">None</option>
                      <option value="Basic256Sha256">Basic256Sha256 (Industry Standard)</option>
                      <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
                      <option value="Basic256">Basic256</option>
                      <option value="Basic128Rsa15">Basic128Rsa15 (Legacy PLC)</option>
                    </select>
                  </div>
                </div>

                {/* Authentication Identity Tokens */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                    User Authentication (Identity Token):
                  </label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {(['Anonymous', 'Username', 'Certificate'] as OpcUaAuthMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAuthMode(mode)}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          fontSize: 10,
                          fontWeight: authMode === mode ? 700 : 500,
                          borderRadius: 4,
                          border: authMode === mode ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                          background: authMode === mode ? '#f0f9ff' : '#ffffff',
                          color: authMode === mode ? 'var(--color-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {mode === 'Anonymous' ? 'Anonymous' : mode === 'Username' ? 'Username & Password' : 'User Certificate (X.509)'}
                      </button>
                    ))}
                  </div>

                  {/* Username & Password Inputs */}
                  {authMode === 'Username' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 2 }}>
                          Username:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. opcadmin"
                            style={{
                              width: '100%',
                              padding: '5px 8px 5px 24px',
                              fontSize: 11,
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: '#ffffff',
                            }}
                          />
                          <User size={12} color="#94a3b8" style={{ position: 'absolute', left: 7 }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 2 }}>
                          Password:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{
                              width: '100%',
                              padding: '5px 8px 5px 24px',
                              fontSize: 11,
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: '#ffffff',
                            }}
                          />
                          <Lock size={12} color="#94a3b8" style={{ position: 'absolute', left: 7 }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Certificate Inputs */}
                  {authMode === 'Certificate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 2 }}>
                          X.509 Client Certificate File (.der / .pem / .crt):
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={certificatePath}
                            onChange={(e) => setCertificatePath(e.target.value)}
                            placeholder="/path/to/client_certificate.pem"
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              fontSize: 11,
                              fontFamily: 'monospace',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: '#ffffff',
                            }}
                          />
                          {window.electronAPI?.openFile && (
                            <button
                              type="button"
                              onClick={handleBrowseCert}
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 10, border: '1px solid var(--border-strong)', background: '#ffffff' }}
                            >
                              <FolderOpen size={11} /> Browse...
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 2 }}>
                          Private Key File (.pem / .key):
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="password"
                            value={privateKeyPath}
                            onChange={(e) => setPrivateKeyPath(e.target.value)}
                            placeholder="/path/to/client_private_key.pem"
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              fontSize: 11,
                              fontFamily: 'monospace',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: '#ffffff',
                            }}
                          />
                          {window.electronAPI?.openFile && (
                            <button
                              type="button"
                              onClick={handleBrowseKey}
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 10, border: '1px solid var(--border-strong)', background: '#ffffff' }}
                            >
                              <FolderOpen size={11} /> Browse...
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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
                    Embedded Test OPC UA Server (Local Loopback 127.0.0.1)
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Bound to 127.0.0.1:4840. Anonymous read allowed; anonymous writes restricted (authenticated as admin/operator).
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
