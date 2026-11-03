import React, { useState } from 'react';
import {
  FolderOpen,
  FileText,
  FileCode,
  Image as ImageIcon,
  ExternalLink,
  ShieldCheck,
  X,
  Play,
  RotateCw,
  FolderCheck,
  Eye,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { validateCustomSkid, type CustomSkidPackage } from '../../core/templates/customTemplateValidator';
import type { ProjectFileItem, ProjectScanResult } from '../../electron';

interface ClientProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployed?: () => void;
}

export const ClientProjectModal: React.FC<ClientProjectModalProps> = ({
  isOpen,
  onClose,
  onDeployed,
}) => {
  const setCustomSkid = useSimulationStore((s) => s.setCustomSkid);

  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ProjectScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PLANT' | 'DRAWINGS' | 'DATASHEETS'>('PLANT');
  const [previewItem, setPreviewItem] = useState<{ name: string; content?: string; dataUri?: string; type: string } | null>(null);
  const [deploySuccessMsg, setDeploySuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectElectronDirectory = async () => {
    setErrorMsg(null);
    setDeploySuccessMsg(null);
    if (!window.electronAPI?.project?.openDirectory) {
      return;
    }
    try {
      const res = await window.electronAPI.project.openDirectory();
      if (!res.canceled && res.folderPath) {
        setFolderPath(res.folderPath);
        await scanDirectory(res.folderPath);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to select directory');
    }
  };

  const scanDirectory = async (dirPath: string) => {
    if (!window.electronAPI?.project?.scanDirectory) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.electronAPI.project.scanDirectory(dirPath);
      if (res.success) {
        setScanResult(res);
        setFolderName(res.folderName || 'Selected Folder');
      } else {
        setErrorMsg(res.error || 'Failed to scan directory');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error scanning directory');
    } finally {
      setLoading(false);
    }
  };

  // Web fallback: handle HTML5 directory picker or files
  const handleWebDirectoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setLoading(true);
    setErrorMsg(null);
    setDeploySuccessMsg(null);

    try {
      const drawings: ProjectFileItem[] = [];
      const datasheets: ProjectFileItem[] = [];
      const plantData: ProjectFileItem[] = [];

      const drawingExts = new Set(['.pdf', '.svg', '.png', '.jpg', '.jpeg', '.dwg', '.dxf']);
      const datasheetExts = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.txt', '.doc', '.docx']);
      const plantDataExts = new Set(['.json', '.yaml', '.yml']);

      // Web file storage for in-memory viewing
      const firstPath = fileList[0].webkitRelativePath || fileList[0].name;
      const rootFolder = firstPath.includes('/') ? firstPath.split('/')[0] : 'Uploaded Folder';

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        const item: ProjectFileItem = {
          name: file.name,
          relativePath: file.webkitRelativePath || file.name,
          absolutePath: file.name,
          size: file.size,
          ext,
        };

        if (drawingExts.has(ext)) drawings.push(item);
        if (datasheetExts.has(ext)) datasheets.push(item);
        if (plantDataExts.has(ext)) plantData.push(item);
      }

      setFolderName(rootFolder);
      setFolderPath(`Client Host Browser [${rootFolder}]`);
      setScanResult({
        success: true,
        folderName: rootFolder,
        folderPath: rootFolder,
        drawings,
        datasheets,
        plantData,
        totalFiles: fileList.length,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse folder');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDeployPlant = async (file: ProjectFileItem) => {
    setErrorMsg(null);
    setDeploySuccessMsg(null);

    try {
      let rawJson = '';
      if (window.electronAPI?.project?.readFile) {
        const readRes = await window.electronAPI.project.readFile(file.absolutePath, false);
        if (!readRes.success || !readRes.content) {
          throw new Error(readRes.error || 'Failed to read plant file');
        }
        rawJson = readRes.content;
      } else {
        throw new Error('Local file reading is only supported in Desktop application');
      }

      const parsed: CustomSkidPackage = JSON.parse(rawJson);
      const validation = validateCustomSkid(parsed);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
      }

      const meta = parsed.meta ?? {
        id: file.name.replace(/\.[^/.]+$/, '').toUpperCase(),
        name: file.name,
        category: 'Client Process Skid',
      };
      const topology = parsed.topology ?? (parsed as any);

      setCustomSkid(topology, meta);
      setDeploySuccessMsg(`Successfully deployed ${meta.name} to digital twin simulation engine.`);
      if (onDeployed) onDeployed();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to deploy custom plant topology');
    }
  };

  const handleOpenFileInSystem = async (file: ProjectFileItem) => {
    if (window.electronAPI?.project?.openPath) {
      await window.electronAPI.project.openPath(file.absolutePath);
    }
  };

  const handlePreviewFile = async (file: ProjectFileItem) => {
    setErrorMsg(null);
    if (!window.electronAPI?.project?.readFile) return;

    try {
      const isBinary = file.ext === '.pdf' || file.ext === '.png' || file.ext === '.jpg' || file.ext === '.jpeg';
      const res = await window.electronAPI.project.readFile(file.absolutePath, isBinary);
      if (res.success) {
        setPreviewItem({
          name: file.name,
          content: res.content,
          dataUri: res.dataUri,
          type: file.ext,
        });
      } else {
        setErrorMsg(res.error || 'Failed to preview file');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error generating preview');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="industrial-card"
        style={{
          width: '94%',
          maxWidth: 960,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderOpen size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                Client Project Workspace
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#065f46',
                    color: '#6ee7b7',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ShieldCheck size={11} /> Zero-Repo Footprint
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Load client P&ID drawings, engineering datasheets, and plant data locally from host machine at runtime
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Directory Chooser Toolbar */}
        <div
          style={{
            padding: '12px 20px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
            <HardDrive size={16} color="#38bdf8" />
            <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#94a3b8' }}>Project Directory: </span>
              <strong style={{ color: folderPath ? '#38bdf8' : '#e2e8f0' }}>
                {folderName ? `${folderName} (${folderPath})` : folderPath || 'No project folder loaded yet'}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {window.electronAPI?.project ? (
              <button
                onClick={handleSelectElectronDirectory}
                className="header-action-btn"
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  borderColor: '#0284c7',
                  padding: '6px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FolderOpen size={14} /> Open Local Project Folder...
              </button>
            ) : (
              <label
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <FolderOpen size={14} /> Select Local Folder (Web)...
                <input
                  type="file"
                  multiple
                  // @ts-expect-error directory upload attributes
                  webkitdirectory=""
                  directory=""
                  onChange={handleWebDirectoryUpload}
                  style={{ display: 'none' }}
                />
              </label>
            )}

            {folderPath && window.electronAPI?.project && (
              <button
                onClick={() => scanDirectory(folderPath)}
                disabled={loading}
                className="header-action-btn"
                style={{
                  background: '#334155',
                  color: '#e2e8f0',
                  padding: '6px 10px',
                  fontSize: 12,
                }}
                title="Rescan folder"
              >
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 20px',
              background: '#450a0a',
              borderBottom: '1px solid #7f1d1d',
              color: '#fca5a5',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

        {deploySuccessMsg && (
          <div
            style={{
              padding: '10px 20px',
              background: '#064e3b',
              borderBottom: '1px solid #065f46',
              color: '#6ee7b7',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={14} /> {deploySuccessMsg}
          </div>
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #334155',
            background: '#111827',
            padding: '0 20px',
          }}
        >
          <button
            onClick={() => setActiveTab('PLANT')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'PLANT' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'PLANT' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileCode size={15} /> Plant Topologies ({scanResult?.plantData?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('DRAWINGS')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'DRAWINGS' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'DRAWINGS' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ImageIcon size={15} /> P&ID Drawings ({scanResult?.drawings?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('DATASHEETS')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'DATASHEETS' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'DATASHEETS' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileText size={15} /> Datasheets & Specs ({scanResult?.datasheets?.length || 0})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {!scanResult ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#94a3b8',
              }}
            >
              <FolderCheck size={48} color="#64748b" style={{ margin: '0 auto 16px auto', display: 'block' }} />
              <h3 style={{ color: '#e2e8f0', fontSize: 16, marginBottom: 8 }}>
                No Client Project Folder Connected
              </h3>
              <p style={{ maxWidth: 520, margin: '0 auto 20px auto', fontSize: 13, lineHeight: 1.5 }}>
                Click <strong>Open Local Project Folder</strong> to select your engineering directory containing client drawings, instrument datasheets, and plant topology definitions.
              </p>
              <div
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: 14,
                  maxWidth: 480,
                  margin: '0 auto',
                  textAlign: 'left',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 6 }}>
                  🛡️ Security & Proprietary IP Protection
                </div>
                <div>• All files reside strictly on your local disk.</div>
                <div>• Zero client drawings, datasheets, or topologies are committed to Git.</div>
                <div>• Fully offline-capable and memory-isolated.</div>
              </div>
            </div>
          ) : (
            <div>
              {/* Plant Data Tab */}
              {activeTab === 'PLANT' && (
                <div>
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
                    Custom plant models and skid packages found in project folder:
                  </div>
                  {(!scanResult.plantData || scanResult.plantData.length === 0) ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                      No plant topology (.json) files detected in this folder.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {scanResult.plantData.map((file) => (
                        <div
                          key={file.absolutePath}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileCode size={20} color="#38bdf8" />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {file.relativePath} · {formatBytes(file.size)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              onClick={() => handleDeployPlant(file)}
                              style={{
                                background: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Play size={13} /> Deploy to Digital Twin
                            </button>
                            {window.electronAPI?.project && (
                              <button
                                onClick={() => handleOpenFileInSystem(file)}
                                style={{
                                  background: '#334155',
                                  color: '#cbd5e1',
                                  border: 'none',
                                  padding: '6px 10px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                                title="Open in System Editor"
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Drawings Tab */}
              {activeTab === 'DRAWINGS' && (
                <div>
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
                    Process drawings and P&ID schematics loaded from client machine:
                  </div>
                  {(!scanResult.drawings || scanResult.drawings.length === 0) ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                      No drawings (.pdf, .svg, .png, .dwg) detected in this folder.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {scanResult.drawings.map((file) => (
                        <div
                          key={file.absolutePath}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ImageIcon size={20} color="#a855f7" />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {file.relativePath} · {formatBytes(file.size)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {['.png', '.jpg', '.jpeg', '.svg', '.pdf'].includes(file.ext) && window.electronAPI?.project && (
                              <button
                                onClick={() => handlePreviewFile(file)}
                                style={{
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <Eye size={13} /> View
                              </button>
                            )}
                            {window.electronAPI?.project && (
                              <button
                                onClick={() => handleOpenFileInSystem(file)}
                                style={{
                                  background: '#334155',
                                  color: '#cbd5e1',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <ExternalLink size={13} /> Open in Native App
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Datasheets Tab */}
              {activeTab === 'DATASHEETS' && (
                <div>
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
                    Equipment datasheets, calibration tables, and technical specifications:
                  </div>
                  {(!scanResult.datasheets || scanResult.datasheets.length === 0) ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                      No datasheets (.pdf, .xlsx, .csv, .txt) detected in this folder.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {scanResult.datasheets.map((file) => (
                        <div
                          key={file.absolutePath}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileText size={20} color="#f59e0b" />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {file.relativePath} · {formatBytes(file.size)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {['.pdf', '.txt', '.csv'].includes(file.ext) && window.electronAPI?.project && (
                              <button
                                onClick={() => handlePreviewFile(file)}
                                style={{
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <Eye size={13} /> View
                              </button>
                            )}
                            {window.electronAPI?.project && (
                              <button
                                onClick={() => handleOpenFileInSystem(file)}
                                style={{
                                  background: '#334155',
                                  color: '#cbd5e1',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <ExternalLink size={13} /> Open in System Viewer
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Preview Sub-Modal */}
          {previewItem && (
            <div
              style={{
                position: 'fixed',
                inset: 30,
                zIndex: 10000,
                background: '#0f172a',
                border: '1px solid #475569',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              }}
            >
              <div
                style={{
                  padding: '12px 18px',
                  background: '#1e293b',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                  Preview: {previewItem.name}
                </div>
                <button
                  onClick={() => setPreviewItem(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#020617' }}>
                {previewItem.type === '.pdf' && previewItem.dataUri ? (
                  <iframe
                    src={previewItem.dataUri}
                    title={previewItem.name}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : ['.png', '.jpg', '.jpeg'].includes(previewItem.type) && previewItem.dataUri ? (
                  <img
                    src={previewItem.dataUri}
                    alt={previewItem.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: '0 auto', display: 'block' }}
                  />
                ) : (
                  <pre
                    style={{
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {previewItem.content || 'Binary file cannot be previewed as text.'}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #334155',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Strict privacy: files remain on host filesystem and are loaded only into simulator memory.</span>
          </div>
          <button
            onClick={onClose}
            className="header-action-btn"
            style={{
              background: '#334155',
              color: '#f8fafc',
              padding: '6px 14px',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
