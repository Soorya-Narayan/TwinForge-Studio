/**
 * TwinForge Studio - Visual P&ID Graph Modeler (Light Mode)
 * Node-based visual process modeler using React Flow.
 */

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Database, Disc, GitCommit, Flame } from 'lucide-react';

export const PidCanvas: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);

  // Derive dynamic visual nodes from current plant topology & live simulation values
  const nodes: Node[] = useMemo(() => {
    const tk100 = snapshot?.devices['TK-100'];
    const tk400 = snapshot?.devices['TK-400'];
    const tkProd = snapshot?.devices['TK-PROD'];
    const v101 = snapshot?.devices['V-101'];
    const v102 = snapshot?.devices['V-102'];
    const p100 = snapshot?.devices['P-100'];
    const hx100 = snapshot?.devices['HX-100'];

    return [
      {
        id: 'TK-100',
        position: { x: 50, y: 150 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Database size={14} color="#0369a1" />
                <strong style={{ fontSize: 13, color: '#0f172a' }}>TK-100</strong>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Chemical Supply</div>
              <div className="mono" style={{ fontSize: 12, color: '#0369a1', marginTop: 4, fontWeight: 700 }}>
                Level: {(tk100?.levelPct ?? 0).toFixed(0)} %
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, minWidth: 150, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
      {
        id: 'V-101',
        position: { x: 260, y: 165 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GitCommit size={14} color={v101?.isOpen ? '#059669' : '#64748b'} />
                <strong style={{ fontSize: 12, color: '#0f172a' }}>V-101 (Suction)</strong>
              </div>
              <div className="mono" style={{ fontSize: 10, color: v101?.isOpen ? '#059669' : '#64748b', fontWeight: 600 }}>
                {v101?.isOpen ? 'PROVED OPEN' : 'CLOSED'}
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: `1px solid ${v101?.isOpen ? '#059669' : '#cbd5e1'}`, borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
      {
        id: 'P-100',
        position: { x: 440, y: 160 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Disc size={14} color={(p100?.speedPct ?? 0) > 0 ? '#0284c7' : '#64748b'} />
                <strong style={{ fontSize: 12, color: '#0f172a' }}>P-100 (Pump)</strong>
              </div>
              <div className="mono" style={{ fontSize: 10, color: '#0369a1', fontWeight: 600 }}>
                Speed: {(p100?.speedPct ?? 0).toFixed(0)} %
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
      {
        id: 'HX-100',
        position: { x: 620, y: 155 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={14} color="#d97706" />
                <strong style={{ fontSize: 12, color: '#0f172a' }}>HX-100 (Plate)</strong>
              </div>
              <div className="mono" style={{ fontSize: 10, color: '#b45309', fontWeight: 600 }}>
                {(hx100?.temperatureC ?? 20).toFixed(1)} °C
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
      {
        id: 'V-102',
        position: { x: 790, y: 165 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 6 }}>
              <strong style={{ fontSize: 12, color: '#0f172a' }}>V-102 (Discharge)</strong>
              <div className="mono" style={{ fontSize: 10, color: v102?.isOpen ? '#059669' : '#64748b', fontWeight: 600 }}>
                {v102?.isOpen ? 'OPEN' : 'CLOSED'}
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
      {
        id: 'TK-400',
        position: { x: 970, y: 140 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 8 }}>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>TK-400 (Mixer)</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>1500L Capacity</div>
              <div className="mono" style={{ fontSize: 12, color: '#4338ca', marginTop: 4, fontWeight: 700 }}>
                Level: {(tk400?.levelPct ?? 0).toFixed(0)} %
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, minWidth: 140, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
      {
        id: 'TK-PROD',
        position: { x: 970, y: 350 },
        data: {
          label: (
            <div style={{ textAlign: 'left', padding: 8 }}>
              <strong style={{ fontSize: 13, color: '#059669' }}>TK-PROD</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>Finished Product</div>
              <div className="mono" style={{ fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: 700 }}>
                Level: {(tkProd?.levelPct ?? 0).toFixed(0)} %
              </div>
            </div>
          ),
        },
        style: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, minWidth: 140, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
    ];
  }, [snapshot]);

  const edges: Edge[] = useMemo(() => {
    const isFlowingP1 = (snapshot?.paths.find((p) => p.id === 'PIPE-02')?.flowLpm ?? 0) > 0;
    const isFlowingP2 = (snapshot?.paths.find((p) => p.id === 'PIPE-06')?.flowLpm ?? 0) > 0;

    return [
      { id: 'e1', source: 'TK-100', target: 'V-101', animated: isFlowingP1, style: { stroke: isFlowingP1 ? '#0284c7' : '#94a3b8', strokeWidth: 3 } },
      { id: 'e2', source: 'V-101', target: 'P-100', animated: isFlowingP1, style: { stroke: isFlowingP1 ? '#0284c7' : '#94a3b8', strokeWidth: 3 } },
      { id: 'e3', source: 'P-100', target: 'HX-100', animated: isFlowingP1, style: { stroke: isFlowingP1 ? '#0284c7' : '#94a3b8', strokeWidth: 3 } },
      { id: 'e4', source: 'HX-100', target: 'V-102', animated: isFlowingP1, style: { stroke: isFlowingP1 ? '#0284c7' : '#94a3b8', strokeWidth: 3 } },
      { id: 'e5', source: 'V-102', target: 'TK-400', animated: isFlowingP1, style: { stroke: isFlowingP1 ? '#0284c7' : '#94a3b8', strokeWidth: 3 } },
      { id: 'e6', source: 'TK-400', target: 'TK-PROD', animated: isFlowingP2, style: { stroke: isFlowingP2 ? '#059669' : '#94a3b8', strokeWidth: 3 } },
    ];
  }, [snapshot]);

  return (
    <div className="industrial-card" style={{ width: '100%', height: '100%', borderRadius: 4, overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        style={{ background: '#f8fafc' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4 }} />
      </ReactFlow>
    </div>
  );
};
