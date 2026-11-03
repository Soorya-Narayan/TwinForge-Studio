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
  Tags,
  Search,
  RotateCcw,
  Plus,
  Database,
} from 'lucide-react';
import {
  DEFAULT_OPCUA_TAGS,
  getDefaultTagMap,
  generateSiemensDbTagMap,
  generateRockwellTagMap,
  generateCodesysTagMap,
  getDefaultTagTypeMap,
  type TagDefinition,
  type TagDirection,
  type TagDataType,
} from '../../core/driver/opcuaTagMap';
import {
  type InterlockDefinition,
  DEFAULT_INTERLOCK_DEFINITIONS,
} from '../../core/driver/interlockConfig';

interface OpcUaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpcUaModal: React.FC<OpcUaModalProps> = ({ isOpen, onClose }) => {
  const driverMode = useSimulationStore((s) => s.driverMode);
  const plc = useSimulationStore((s) => s.plc);
  const opcuaEndpoint = useSimulationStore((s) => s.opcuaEndpoint);
  const opcuaSecurityOptions = useSimulationStore((s) => s.opcuaSecurityOptions);
  const opcuaTagMap = useSimulationStore((s) => s.opcuaTagMap);
  const opcuaTagTypes = useSimulationStore((s) => s.opcuaTagTypes);
  const setDriverMode = useSimulationStore((s) => s.setDriverMode);
  const connectOpcUa = useSimulationStore((s) => s.connectOpcUa);
  const disconnectOpcUa = useSimulationStore((s) => s.disconnectOpcUa);
  const startLocalOpcUaServer = useSimulationStore((s) => s.startLocalOpcUaServer);
  const stopLocalOpcUaServer = useSimulationStore((s) => s.stopLocalOpcUaServer);
  const activeSkid = useSimulationStore((s) => s.activeSkid);
  const setOpcuaTagMap = useSimulationStore((s) => s.setOpcuaTagMap);
  const resetOpcuaTagMap = useSimulationStore((s) => s.resetOpcuaTagMap);
  const setOpcuaTagType = useSimulationStore((s) => s.setOpcuaTagType);
  const resetOpcuaTagTypes = useSimulationStore((s) => s.resetOpcuaTagTypes);
  const interlockDefinitions = useSimulationStore((s) => s.interlockDefinitions);
  const setInterlockDefinitions = useSimulationStore((s) => s.setInterlockDefinitions);
  const resetInterlockDefinitions = useSimulationStore((s) => s.resetInterlockDefinitions);

  const [activeTab, setActiveTab] = useState<'connection' | 'tagmap' | 'interlocks'>('connection');
  const [interlockSearch, setInterlockSearch] = useState('');
  const [interlockSkidFilter, setInterlockSkidFilter] = useState<'ALL' | 'PASTEURIZER_10KLPH' | 'BATCH_MIXING'>('ALL');
  const [showAddInterlock, setShowAddInterlock] = useState(false);
  const [newInterlockForm, setNewInterlockForm] = useState<{
    id: string;
    name: string;
    condition: string;
    skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'COMMON';
  }>({
    id: '',
    name: '',
    condition: '',
    skid: 'PASTEURIZER_10KLPH',
  });
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

  // Tag Map Filter and Edit state
  const [tagSearch, setTagSearch] = useState('');
  const [tagSkidFilter, setTagSkidFilter] = useState<'ALL' | 'PASTEURIZER_10KLPH' | 'BATCH_MIXING'>('ALL');
  const [tagDirectionFilter, setTagDirectionFilter] = useState<'ALL' | 'INPUT' | 'OUTPUT'>('ALL');
  const [siemensDbName, setSiemensDbName] = useState('DB_Process');
  const [siemensNamespace, setSiemensNamespace] = useState(3);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagForm, setNewTagForm] = useState<{
    tag: string;
    description: string;
    direction: 'INPUT' | 'OUTPUT';
    dataType: TagDataType;
    nodeId: string;
  }>({
    tag: '',
    description: '',
    direction: 'OUTPUT',
    dataType: 'Float',
    nodeId: '',
  });

  const defaultTagMap = getDefaultTagMap();
  const defaultTagTypes = getDefaultTagTypeMap();
  const modifiedTagCount =
    Object.keys(opcuaTagMap).filter(
      (tag) => opcuaTagMap[tag] && opcuaTagMap[tag] !== (defaultTagMap[tag] ?? `ns=1;s=${tag}`)
    ).length +
    Object.keys(opcuaTagTypes).filter(
      (tag) => opcuaTagTypes[tag] && opcuaTagTypes[tag] !== defaultTagTypes[tag]
    ).length;

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

  const handleTagNodeIdChange = (tag: string, newNodeId: string) => {
    setOpcuaTagMap({
      ...opcuaTagMap,
      [tag]: newNodeId,
    });
  };

  const handleResetSingleTag = (tag: string) => {
    const defaultNodeId = defaultTagMap[tag] ?? `ns=1;s=${tag}`;
    const def = DEFAULT_OPCUA_TAGS.find((d) => d.tag === tag);
    setOpcuaTagMap({
      ...opcuaTagMap,
      [tag]: defaultNodeId,
    });
    if (def) {
      setOpcuaTagType(tag, def.dataType);
    }
  };

  const handleApplySiemensPreset = () => {
    const siemensMap = generateSiemensDbTagMap(siemensDbName, siemensNamespace);
    setOpcuaTagMap({ ...opcuaTagMap, ...siemensMap });
    setStatusMsg({
      type: 'success',
      text: `Applied Siemens S7 DB preset (ns=${siemensNamespace};s="${siemensDbName}"."TAG") to all tags`,
    });
  };

  const handleApplyRockwellPreset = () => {
    const rockwellMap = generateRockwellTagMap('Program:MainProgram', 1);
    setOpcuaTagMap({ ...opcuaTagMap, ...rockwellMap });
    setStatusMsg({
      type: 'success',
      text: 'Applied Rockwell Allen-Bradley ControlLogix preset (ns=1;s=Program:MainProgram.TAG)',
    });
  };

  const handleApplyCodesysPreset = () => {
    const codesysMap = generateCodesysTagMap('MAIN', 2);
    setOpcuaTagMap({ ...opcuaTagMap, ...codesysMap });
    setStatusMsg({
      type: 'success',
      text: 'Applied TwinCAT / CODESYS preset (ns=2;s=MAIN.TAG)',
    });
  };

  const handleResetAllTags = () => {
    resetOpcuaTagMap();
    resetOpcuaTagTypes();
    setStatusMsg({
      type: 'info',
      text: 'Reset all PLC tag mappings and data types to factory default (ns=1;s=TAG)',
    });
  };

  const handleAddCustomTag = () => {
    if (!newTagForm.tag.trim()) return;
    const tagKey = newTagForm.tag.trim().toUpperCase();
    const nodeId = newTagForm.nodeId.trim() || `ns=1;s=${tagKey}`;
    setOpcuaTagMap({
      ...opcuaTagMap,
      [tagKey]: nodeId,
    });
    setOpcuaTagType(tagKey, newTagForm.dataType);
    setNewTagForm({ tag: '', description: '', direction: 'OUTPUT', dataType: 'Float', nodeId: '' });
    setShowAddTag(false);
    setStatusMsg({ type: 'success', text: `Added custom tag mapping: ${tagKey} -> ${nodeId} (${newTagForm.dataType})` });
  };

  const allTagDefs: (TagDefinition & { isCustom?: boolean })[] = [
    ...DEFAULT_OPCUA_TAGS.map((d) => ({
      ...d,
      dataType: opcuaTagTypes[d.tag] || d.dataType,
    })),
    ...Object.keys(opcuaTagMap)
      .filter((k) => !DEFAULT_OPCUA_TAGS.some((d) => d.tag === k))
      .map((k) => ({
        tag: k,
        name: k,
        skid: 'COMMON' as const,
        direction: (k.includes('CMD') || k.includes('START') || k.includes('IL-') || k.includes('MOD_') ? 'OUTPUT' : 'INPUT') as TagDirection,
        dataType: (opcuaTagTypes[k] || 'Float') as TagDataType,
        defaultNodeId: `ns=1;s=${k}`,
        description: 'User-defined custom tag',
        isCustom: true,
      })),
  ];

  const filteredTags = allTagDefs.filter((def) => {
    const currentAddress = opcuaTagMap[def.tag] || def.defaultNodeId;
    if (tagSkidFilter !== 'ALL' && def.skid !== tagSkidFilter && def.skid !== 'COMMON') return false;
    if (tagDirectionFilter !== 'ALL' && def.direction !== tagDirectionFilter) return false;
    if (tagSearch.trim()) {
      const q = tagSearch.toLowerCase();
      return (
        def.tag.toLowerCase().includes(q) ||
        def.name.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        currentAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const isInterlocksModified =
    interlockDefinitions.length !== DEFAULT_INTERLOCK_DEFINITIONS.length ||
    interlockDefinitions.some((def, i) => {
      const d = DEFAULT_INTERLOCK_DEFINITIONS[i];
      return !d || d.name !== def.name || d.condition !== def.condition || d.id !== def.id;
    });

  const filteredInterlocks = interlockDefinitions.filter((def) => {
    if (interlockSkidFilter !== 'ALL' && def.skid !== interlockSkidFilter && def.skid !== 'COMMON') return false;
    if (interlockSearch.trim()) {
      const q = interlockSearch.toLowerCase();
      return (
        def.id.toLowerCase().includes(q) ||
        def.name.toLowerCase().includes(q) ||
        def.condition.toLowerCase().includes(q) ||
        (def.description && def.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleInterlockFieldChange = (id: string, field: 'name' | 'condition', val: string) => {
    const updated = interlockDefinitions.map((d) => (d.id === id ? { ...d, [field]: val } : d));
    setInterlockDefinitions(updated);
  };

  const handleResetSingleInterlock = (id: string) => {
    const defaultDef = DEFAULT_INTERLOCK_DEFINITIONS.find((d) => d.id === id);
    if (!defaultDef) {
      setInterlockDefinitions(interlockDefinitions.filter((d) => d.id !== id));
    } else {
      setInterlockDefinitions(
        interlockDefinitions.map((d) => (d.id === id ? { ...defaultDef } : d))
      );
    }
  };

  const handleAddInterlock = () => {
    if (!newInterlockForm.id.trim() || !newInterlockForm.name.trim()) return;
    const newDef: InterlockDefinition = {
      id: newInterlockForm.id.trim().toUpperCase(),
      name: newInterlockForm.name.trim(),
      condition: newInterlockForm.condition.trim() || 'Custom plant permissive / trip rule',
      skid: newInterlockForm.skid,
      tag: newInterlockForm.id.trim().toUpperCase(),
      defaultOk: true,
      description: 'User-configured safety interlock',
    };
    setInterlockDefinitions([...interlockDefinitions, newDef]);
    setShowAddInterlock(false);
    setNewInterlockForm({
      id: '',
      name: '',
      condition: '',
      skid: 'PASTEURIZER_10KLPH',
    });
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
          maxWidth: '850px',
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

          {/* OPC UA Navigation Sub-tabs */}
          {isOpcUa && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--border-subtle)',
                paddingBottom: 4,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('connection')}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '6px 6px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'connection' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: activeTab === 'connection' ? '#f0f9ff' : 'transparent',
                    color: activeTab === 'connection' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: -6,
                  }}
                >
                  <Plug size={13} />
                  Connection & Security
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tagmap')}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '6px 6px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'tagmap' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: activeTab === 'tagmap' ? '#f0f9ff' : 'transparent',
                    color: activeTab === 'tagmap' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: -6,
                  }}
                >
                  <Tags size={13} />
                  PLC Tag Addressing & Map
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: activeTab === 'tagmap' ? 'var(--color-primary)' : '#e2e8f0',
                      color: activeTab === 'tagmap' ? '#ffffff' : '#475569',
                      fontWeight: 700,
                    }}
                  >
                    {allTagDefs.length}
                  </span>
                  {modifiedTagCount > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: '#dcfce7',
                        color: '#166534',
                        border: '1px solid #86efac',
                        fontWeight: 700,
                      }}
                    >
                      {modifiedTagCount} customized
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('interlocks')}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '6px 6px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'interlocks' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: activeTab === 'interlocks' ? '#f0f9ff' : 'transparent',
                    color: activeTab === 'interlocks' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: -6,
                  }}
                >
                  <Shield size={13} />
                  Safety Interlocks
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: activeTab === 'interlocks' ? 'var(--color-primary)' : '#e2e8f0',
                      color: activeTab === 'interlocks' ? '#ffffff' : '#475569',
                      fontWeight: 700,
                    }}
                  >
                    {interlockDefinitions.length}
                  </span>
                  {isInterlocksModified && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: '#dcfce7',
                        color: '#166534',
                        border: '1px solid #86efac',
                        fontWeight: 700,
                      }}
                    >
                      customized
                    </span>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  Active Skid: {activeSkid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : activeSkid === 'BATCH_MIXING' ? 'Batch Mixing' : 'Custom'} ({opcDriver?.outputTags?.length ?? (activeSkid === 'PASTEURIZER_10KLPH' ? 8 : 10)} tags/scan)
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {isConnected ? `Live Sync (${latencyMs}ms)` : 'Config persisted locally'}
                </span>
              </div>
            </div>
          )}

          {/* OPC UA Connection Parameters (Shown when OPC UA and connection tab selected) */}
          {isOpcUa && activeTab === 'connection' && (
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

          {/* Tab 2: Tag Addressing & Mapping */}
          {isOpcUa && activeTab === 'tagmap' && (
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
              {/* Skid Scan Isolation Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  fontSize: 11,
                  color: '#0369a1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={13} color="#0284c7" />
                  <span>
                    Current Scan Isolation: Polling <strong>{opcDriver?.outputTags?.length ?? (activeSkid === 'PASTEURIZER_10KLPH' ? 8 : 10)} tags</strong> for <strong>{activeSkid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer Skid (10k LPH)' : activeSkid === 'BATCH_MIXING' ? 'Batch Mixing Skid' : 'Custom Skid'}</strong>
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 600 }}>
                  Per-Skid Tag Splitting Active
                </span>
              </div>

              {/* Presets and Quick Actions */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Database size={13} color="var(--color-primary)" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                      PLC Addressing Presets (Instant Map)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAllTags}
                    className="btn btn-ghost"
                    style={{ fontSize: 10, padding: '3px 8px', color: '#64748b' }}
                  >
                    <RotateCcw size={11} /> Reset All to Default (ns=1;s=TAG)
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  {/* Siemens DB Preset with custom inputs */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#f1f5f9',
                      padding: '3px 6px',
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>Siemens DB:</span>
                    <span style={{ fontSize: 9, color: '#64748b' }}>ns=</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={siemensNamespace}
                      onChange={(e) => setSiemensNamespace(parseInt(e.target.value) || 3)}
                      style={{
                        width: '32px',
                        padding: '2px 4px',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        border: '1px solid #94a3b8',
                        borderRadius: 3,
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: 9, color: '#64748b' }}>;s="</span>
                    <input
                      type="text"
                      value={siemensDbName}
                      onChange={(e) => setSiemensDbName(e.target.value)}
                      placeholder="DB_Process"
                      style={{
                        width: '84px',
                        padding: '2px 6px',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        border: '1px solid #94a3b8',
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 9, color: '#64748b' }}>"."TAG"</span>
                    <button
                      type="button"
                      onClick={handleApplySiemensPreset}
                      className="btn btn-primary"
                      style={{ padding: '3px 8px', fontSize: 10, marginLeft: 2 }}
                    >
                      Apply
                    </button>
                  </div>

                  {/* Rockwell Allen-Bradley Preset */}
                  <button
                    type="button"
                    onClick={handleApplyRockwellPreset}
                    className="btn btn-ghost"
                    style={{
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      border: '1px solid var(--border-strong)',
                      background: '#ffffff',
                    }}
                  >
                    Rockwell Logix (ns=1;s=Program:MainProgram.TAG)
                  </button>

                  {/* CODESYS / TwinCAT Preset */}
                  <button
                    type="button"
                    onClick={handleApplyCodesysPreset}
                    className="btn btn-ghost"
                    style={{
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      border: '1px solid var(--border-strong)',
                      background: '#ffffff',
                    }}
                  >
                    CODESYS / TwinCAT (ns=2;s=MAIN.TAG)
                  </button>
                </div>
              </div>

              {/* Filters and Add Custom Tag toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                {/* Search Bar */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search
                    size={13}
                    style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                  />
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search internal tag, description, or PLC NodeId (e.g. TT5, DB_Process)..."
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 28px',
                      fontSize: 11,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: '#ffffff',
                    }}
                  />
                  {tagSearch && (
                    <button
                      type="button"
                      onClick={() => setTagSearch('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Skid Filter */}
                <select
                  value={tagSkidFilter}
                  onChange={(e) => setTagSkidFilter(e.target.value as any)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: '#ffffff',
                  }}
                >
                  <option value="ALL">All Skids ({allTagDefs.length})</option>
                  <option value="PASTEURIZER_10KLPH">Pasteurizer 10k LPH</option>
                  <option value="BATCH_MIXING">Batch Mixing Skid</option>
                </select>

                {/* Direction Filter */}
                <select
                  value={tagDirectionFilter}
                  onChange={(e) => setTagDirectionFilter(e.target.value as any)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: '#ffffff',
                  }}
                >
                  <option value="ALL">All I/O</option>
                  <option value="INPUT">Inputs (Sensors → PLC)</option>
                  <option value="OUTPUT">Outputs (PLC → Actuators)</option>
                </select>

                {/* Add Custom Tag Button */}
                <button
                  type="button"
                  onClick={() => setShowAddTag(!showAddTag)}
                  className="btn btn-ghost"
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid var(--border-strong)',
                    background: showAddTag ? '#e0f2fe' : '#ffffff',
                    color: showAddTag ? '#0369a1' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={12} /> Add Tag
                </button>
              </div>

              {/* Add Custom Tag Drawer Form */}
              {showAddTag && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    padding: '12px 14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 0.9fr 0.9fr 1.8fr auto',
                    gap: 10,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
                      Tag Name (Key):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TT_HOLDING_2"
                      value={newTagForm.tag}
                      onChange={(e) => setNewTagForm({ ...newTagForm, tag: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
                      Direction:
                    </label>
                    <select
                      value={newTagForm.direction}
                      onChange={(e) => setNewTagForm({ ...newTagForm, direction: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: 11,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: '#ffffff',
                      }}
                    >
                      <option value="INPUT">INPUT (Sensor → PLC)</option>
                      <option value="OUTPUT">OUTPUT (PLC → Actuator)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
                      Data Type:
                    </label>
                    <select
                      value={newTagForm.dataType}
                      onChange={(e) => setNewTagForm({ ...newTagForm, dataType: e.target.value as TagDataType })}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: 11,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: '#ffffff',
                      }}
                    >
                      <option value="Float">Float (32-bit REAL)</option>
                      <option value="Double">Double (64-bit)</option>
                      <option value="Int16">Int16 (16-bit INT)</option>
                      <option value="Int32">Int32 (32-bit DINT)</option>
                      <option value="Boolean">Boolean (BOOL)</option>
                      <option value="String">String</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 2 }}>
                      Real PLC NodeId:
                    </label>
                    <input
                      type="text"
                      placeholder='ns=3;s="DB_Process"."TT_HOLDING_2"'
                      value={newTagForm.nodeId}
                      onChange={(e) => setNewTagForm({ ...newTagForm, nodeId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={handleAddCustomTag}
                      className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: 11 }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddTag(false)}
                      className="btn btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Tag Mapping Table */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  maxHeight: '380px',
                  overflowY: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11 }}>
                  <thead
                    style={{
                      background: '#f1f5f9',
                      borderBottom: '1px solid var(--border-strong)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                    }}
                  >
                    <tr>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', width: '28%' }}>
                        Internal Simulator Tag
                      </th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#334155', width: '22%' }}>
                        Direction / Type
                      </th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', width: '42%' }}>
                        Real PLC NodeId (Addressing)
                      </th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, color: '#334155', width: '8%', textAlign: 'center' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTags.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                          No tags match the current search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTags.map((def) => {
                        const currentAddress = opcuaTagMap[def.tag] ?? def.defaultNodeId;
                        const defaultTypes = getDefaultTagTypeMap();
                        const isAddressModified = currentAddress !== def.defaultNodeId;
                        const isTypeModified = def.dataType !== (defaultTypes[def.tag] ?? (def.direction === 'INPUT' && def.tag.startsWith('DI_') ? 'Boolean' : 'Float'));
                        const isModified = isAddressModified || isTypeModified;

                        return (
                          <tr
                            key={def.tag}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isModified ? '#f0fdf4' : '#ffffff',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* Internal Tag Name & Description */}
                            <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                                  {def.tag}
                                </span>
                                {isModified && (
                                  <span
                                    style={{
                                      fontSize: 8,
                                      padding: '1px 4px',
                                      borderRadius: 2,
                                      background: '#bbf7d0',
                                      color: '#14532d',
                                      fontWeight: 700,
                                    }}
                                  >
                                    MODIFIED
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                {def.name} · {def.description}
                              </div>
                            </td>

                            {/* Direction & Data Type */}
                            <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 3,
                                      background: def.direction === 'INPUT' ? '#eff6ff' : '#fef3c7',
                                      color: def.direction === 'INPUT' ? '#1e40af' : '#92400e',
                                      border: `1px solid ${def.direction === 'INPUT' ? '#bfdbfe' : '#fde68a'}`,
                                    }}
                                  >
                                    {def.direction === 'INPUT' ? 'INPUT' : 'OUTPUT'}
                                  </span>
                                  <select
                                    value={def.dataType}
                                    onChange={(e) => setOpcuaTagType(def.tag, e.target.value as TagDataType)}
                                    style={{
                                      fontSize: 10,
                                      fontFamily: 'monospace',
                                      padding: '1px 4px',
                                      border: `1px solid ${isTypeModified ? '#86efac' : 'var(--border-strong)'}`,
                                      borderRadius: 3,
                                      background: isTypeModified ? '#ecfdf5' : '#ffffff',
                                      color: '#0f172a',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <option value="Float">Float (32-bit REAL)</option>
                                    <option value="Double">Double (64-bit)</option>
                                    <option value="Int16">Int16 (16-bit INT)</option>
                                    <option value="Int32">Int32 (32-bit DINT)</option>
                                    <option value="Boolean">Boolean (BOOL)</option>
                                    <option value="String">String</option>
                                  </select>
                                </div>
                                <span style={{ fontSize: 9, color: '#64748b' }}>
                                  {def.skid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : def.skid === 'BATCH_MIXING' ? 'Batch Mixing' : 'Custom'}
                                </span>
                              </div>
                            </td>

                            {/* Real PLC NodeId Editable Input */}
                            <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={currentAddress}
                                onChange={(e) => handleTagNodeIdChange(def.tag, e.target.value)}
                                placeholder={def.defaultNodeId}
                                style={{
                                  width: '100%',
                                  padding: '5px 8px',
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  border: `1px solid ${isModified ? '#86efac' : 'var(--border-strong)'}`,
                                  borderRadius: 4,
                                  background: isModified ? '#ffffff' : '#f8fafc',
                                  color: '#0f172a',
                                }}
                              />
                            </td>

                            {/* Action / Reset */}
                            <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                              {isModified ? (
                                <button
                                  type="button"
                                  onClick={() => handleResetSingleTag(def.tag)}
                                  title="Reset to default NodeId and data type"
                                  className="btn btn-ghost"
                                  style={{ padding: '4px 6px', color: '#64748b' }}
                                >
                                  <RotateCcw size={12} />
                                </button>
                              ) : (
                                <span style={{ fontSize: 9, color: '#cbd5e1' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Addressing Guide Tip */}
              <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>NodeId Syntax:</span>
                <span>Siemens: <code style={{ color: '#0369a1' }}>ns=3;s="DB_Process"."TT5"</code></span>
                <span>·</span>
                <span>Rockwell: <code style={{ color: '#0369a1' }}>ns=1;s=Program:MainProgram.TT5</code></span>
                <span>·</span>
                <span>CODESYS: <code style={{ color: '#0369a1' }}>ns=2;s=MAIN.TT5</code></span>
                <span>·</span>
                <span>Numeric: <code style={{ color: '#0369a1' }}>ns=2;i=1005</code></span>
              </div>
            </div>
          )}

          {/* TAB 3: SAFETY INTERLOCKS CONFIGURATION */}
          {activeTab === 'interlocks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header Controls: Filters, Search, Add, Reset */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: 8, color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={interlockSearch}
                    onChange={(e) => setInterlockSearch(e.target.value)}
                    placeholder="Search by ID, name, or condition..."
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 28px',
                      fontSize: 11,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: '#ffffff',
                    }}
                  />
                </div>

                {/* Skid Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Skid:</span>
                  {(['ALL', 'PASTEURIZER_10KLPH', 'BATCH_MIXING'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInterlockSkidFilter(s)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 3,
                        border: 'none',
                        background: interlockSkidFilter === s ? 'var(--color-primary)' : '#e2e8f0',
                        color: interlockSkidFilter === s ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      {s === 'ALL' ? 'All Skids' : s === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : 'Batch Mixing'}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddInterlock(!showAddInterlock)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={12} />
                    New Interlock
                  </button>

                  <button
                    type="button"
                    onClick={() => resetInterlockDefinitions()}
                    className="btn btn-ghost"
                    title="Reset all interlock definitions to standard PMO/3A defaults"
                    style={{ padding: '4px 8px', fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <RotateCcw size={12} />
                    Reset Defaults
                  </button>
                </div>
              </div>

              {/* Add New Interlock Drawer */}
              {showAddInterlock && (
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 6,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1' }}>
                    Define Custom Safety Interlock
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="ID (e.g. IL-06)"
                      value={newInterlockForm.id}
                      onChange={(e) => setNewInterlockForm({ ...newInterlockForm, id: e.target.value })}
                      style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
                    />
                    <select
                      value={newInterlockForm.skid}
                      onChange={(e) => setNewInterlockForm({ ...newInterlockForm, skid: e.target.value as any })}
                      style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
                    >
                      <option value="PASTEURIZER_10KLPH">Pasteurizer Skid</option>
                      <option value="BATCH_MIXING">Batch Mixing Skid</option>
                      <option value="COMMON">Common (All Skids)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Interlock Title / Name"
                      value={newInterlockForm.name}
                      onChange={(e) => setNewInterlockForm({ ...newInterlockForm, name: e.target.value })}
                      style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddInterlock}
                      className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: 11 }}
                    >
                      Add
                    </button>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Safety trip rule & physical condition condition description..."
                      value={newInterlockForm.condition}
                      onChange={(e) => setNewInterlockForm({ ...newInterlockForm, condition: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid #94a3b8', borderRadius: 4 }}
                    />
                  </div>
                </div>
              )}

              {/* Interlocks Matrix Table */}
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  maxHeight: '380px',
                  overflowY: 'auto',
                  background: '#ffffff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-strong)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '110px' }}>ID</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '110px' }}>Skid</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '220px' }}>Name / Designation</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Safety Condition & Trip Rule</th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, color: '#475569', width: '50px', textAlign: 'center' }}>Reset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInterlocks.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                          No interlocks matched search filter
                        </td>
                      </tr>
                    ) : (
                      filteredInterlocks.map((def) => {
                        const defaultDef = DEFAULT_INTERLOCK_DEFINITIONS.find((d) => d.id === def.id);
                        const isModified = !defaultDef || defaultDef.name !== def.name || defaultDef.condition !== def.condition;

                        return (
                          <tr
                            key={def.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: isModified ? '#f0fdf4' : '#ffffff',
                            }}
                          >
                            {/* Interlock ID Badge */}
                            <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1',
                                }}
                              >
                                {def.id}
                              </span>
                            </td>

                            {/* Skid */}
                            <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  background:
                                    def.skid === 'PASTEURIZER_10KLPH'
                                      ? '#ecfdf5'
                                      : def.skid === 'BATCH_MIXING'
                                      ? '#f0f9ff'
                                      : '#f8fafc',
                                  color:
                                    def.skid === 'PASTEURIZER_10KLPH'
                                      ? '#065f46'
                                      : def.skid === 'BATCH_MIXING'
                                      ? '#0369a1'
                                      : '#475569',
                                  border: `1px solid ${
                                    def.skid === 'PASTEURIZER_10KLPH'
                                      ? '#a7f3d0'
                                      : def.skid === 'BATCH_MIXING'
                                      ? '#bae6fd'
                                      : '#e2e8f0'
                                  }`,
                                }}
                              >
                                {def.skid === 'PASTEURIZER_10KLPH' ? 'Pasteurizer' : def.skid === 'BATCH_MIXING' ? 'Batch Mixing' : 'Common'}
                              </span>
                            </td>

                            {/* Editable Name */}
                            <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={def.name}
                                onChange={(e) => handleInterlockFieldChange(def.id, 'name', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  fontSize: 11,
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 4,
                                  background: isModified ? '#ffffff' : '#f8fafc',
                                }}
                              />
                            </td>

                            {/* Editable Condition */}
                            <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={def.condition}
                                onChange={(e) => handleInterlockFieldChange(def.id, 'condition', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 4,
                                  background: isModified ? '#ffffff' : '#f8fafc',
                                  color: '#334155',
                                }}
                              />
                            </td>

                            {/* Reset / Delete Action */}
                            <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                              {isModified ? (
                                <button
                                  type="button"
                                  onClick={() => handleResetSingleInterlock(def.id)}
                                  title="Reset to default definition"
                                  className="btn btn-ghost"
                                  style={{ padding: '4px 6px', color: '#64748b' }}
                                >
                                  <RotateCcw size={12} />
                                </button>
                              ) : (
                                <span style={{ fontSize: 9, color: '#cbd5e1' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Interlock Guidance */}
              <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={12} color="#0369a1" />
                <span>
                  Interlock names and conditions are loaded dynamically from configuration instead of hardcoded in driver code. Changes persist locally and immediately update active PLC driver evaluation and FAT reports.
                </span>
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
