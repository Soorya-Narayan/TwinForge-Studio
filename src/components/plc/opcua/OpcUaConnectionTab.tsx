import React from 'react';
import {
  Plug,
  Unplug,
  Shield,
  User,
  Lock,
  FolderOpen,
  Play,
  Square,
} from 'lucide-react';
import type {
  OpcUaSecurityMode,
  OpcUaSecurityPolicy,
  OpcUaAuthMode,
} from '../../../core/driver/OpcUaPlcDriver';

export interface OpcUaConnectionTabProps {
  isConnected: boolean;
  latencyMs: number;
  endpointInput: string;
  setCustomEndpoint: (url: string) => void;
  connecting: boolean;
  handleConnect: () => void;
  handleDisconnect: () => void;
  securityMode: OpcUaSecurityMode;
  setSecurityMode: (mode: OpcUaSecurityMode) => void;
  securityPolicy: OpcUaSecurityPolicy;
  setSecurityPolicy: (policy: OpcUaSecurityPolicy) => void;
  authMode: OpcUaAuthMode;
  setAuthMode: (mode: OpcUaAuthMode) => void;
  username: string;
  setUsername: (u: string) => void;
  password: string;
  setPassword: (p: string) => void;
  certificatePath: string;
  setCertificatePath: (p: string) => void;
  privateKeyPath: string;
  setPrivateKeyPath: (p: string) => void;
  handleBrowseCert: () => void;
  handleBrowseKey: () => void;
  isServerRunning: boolean;
  serverStarting: boolean;
  handleStartLocalServer: () => void;
  handleStopLocalServer: () => void;
}

export const OpcUaConnectionTab: React.FC<OpcUaConnectionTabProps> = ({
  isConnected,
  latencyMs,
  endpointInput,
  setCustomEndpoint,
  connecting,
  handleConnect,
  handleDisconnect,
  securityMode,
  setSecurityMode,
  securityPolicy,
  setSecurityPolicy,
  authMode,
  setAuthMode,
  username,
  setUsername,
  password,
  setPassword,
  certificatePath,
  setCertificatePath,
  privateKeyPath,
  setPrivateKeyPath,
  handleBrowseCert,
  handleBrowseKey,
  isServerRunning,
  serverStarting,
  handleStartLocalServer,
  handleStopLocalServer,
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
  );
};
