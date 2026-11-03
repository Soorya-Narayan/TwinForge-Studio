/**
 * TwinForge Studio - OPC UA PLC Driver & Connection Modal
 * Configures connection to external OPC UA servers (node-opcua) or embedded test server.
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
  Activity,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Shield,
  Tags,
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
import { OpcUaConnectionTab } from './opcua/OpcUaConnectionTab';
import { OpcUaTagMapTab } from './opcua/OpcUaTagMapTab';
import { OpcUaInterlocksTab } from './opcua/OpcUaInterlocksTab';

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
        text: mode === 'OPCUA' ? 'Switched to OPC UA Driver' : 'Switched to In-Process Mock PLC Driver',
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
                OPC UA simulation & automated PLC FAT verification
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
                    OPC UA Driver
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Communicates with external OPC UA server or software controller via <strong>node-opcua</strong>.
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

          {/* Tab 1: Connection & Security */}
          {isOpcUa && activeTab === 'connection' && (
            <OpcUaConnectionTab
              isConnected={isConnected}
              latencyMs={latencyMs}
              endpointInput={endpointInput}
              setCustomEndpoint={setCustomEndpoint}
              connecting={connecting}
              handleConnect={handleConnect}
              handleDisconnect={handleDisconnect}
              securityMode={securityMode}
              setSecurityMode={setSecurityMode}
              securityPolicy={securityPolicy}
              setSecurityPolicy={setSecurityPolicy}
              authMode={authMode}
              setAuthMode={setAuthMode}
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              certificatePath={certificatePath}
              setCertificatePath={setCertificatePath}
              privateKeyPath={privateKeyPath}
              setPrivateKeyPath={setPrivateKeyPath}
              handleBrowseCert={handleBrowseCert}
              handleBrowseKey={handleBrowseKey}
              isServerRunning={isServerRunning}
              serverStarting={serverStarting}
              handleStartLocalServer={handleStartLocalServer}
              handleStopLocalServer={handleStopLocalServer}
            />
          )}

          {/* Tab 2: Tag Addressing & Mapping */}
          {isOpcUa && activeTab === 'tagmap' && (
            <OpcUaTagMapTab
              activeSkid={activeSkid}
              outputTagsCount={opcDriver?.outputTags?.length}
              opcuaTagMap={opcuaTagMap}
              setOpcuaTagType={setOpcuaTagType}
              handleTagNodeIdChange={handleTagNodeIdChange}
              handleResetSingleTag={handleResetSingleTag}
              handleResetAllTags={handleResetAllTags}
              handleApplySiemensPreset={handleApplySiemensPreset}
              handleApplyRockwellPreset={handleApplyRockwellPreset}
              handleApplyCodesysPreset={handleApplyCodesysPreset}
              siemensDbName={siemensDbName}
              setSiemensDbName={setSiemensDbName}
              siemensNamespace={siemensNamespace}
              setSiemensNamespace={setSiemensNamespace}
              tagSearch={tagSearch}
              setTagSearch={setTagSearch}
              tagSkidFilter={tagSkidFilter}
              setTagSkidFilter={setTagSkidFilter}
              tagDirectionFilter={tagDirectionFilter}
              setTagDirectionFilter={setTagDirectionFilter}
              showAddTag={showAddTag}
              setShowAddTag={setShowAddTag}
              newTagForm={newTagForm}
              setNewTagForm={setNewTagForm}
              handleAddCustomTag={handleAddCustomTag}
              allTagDefs={allTagDefs}
              filteredTags={filteredTags}
            />
          )}

          {/* Tab 3: Safety Interlocks Configuration */}
          {activeTab === 'interlocks' && (
            <OpcUaInterlocksTab
              interlockSearch={interlockSearch}
              setInterlockSearch={setInterlockSearch}
              interlockSkidFilter={interlockSkidFilter}
              setInterlockSkidFilter={setInterlockSkidFilter}
              showAddInterlock={showAddInterlock}
              setShowAddInterlock={setShowAddInterlock}
              newInterlockForm={newInterlockForm}
              setNewInterlockForm={setNewInterlockForm}
              handleAddInterlock={handleAddInterlock}
              resetInterlockDefinitions={resetInterlockDefinitions}
              handleInterlockFieldChange={handleInterlockFieldChange}
              handleResetSingleInterlock={handleResetSingleInterlock}
              filteredInterlocks={filteredInterlocks}
            />
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
