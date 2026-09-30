/**
 * TwinForge Studio - Real-Time Process Trend Recorder & Oscilloscope
 * Multi-channel high-frequency process data acquisition, visualization, and CSV export.
 */

import React, { useState, useMemo, useRef } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Download, Pause, Play, RotateCcw, TrendingUp } from 'lucide-react';

interface ChannelConfig {
  id: string;
  name: string;
  unit: string;
  color: string;
  min: number;
  max: number;
  enabled: boolean;
}

export const TrendOscilloscope: React.FC = () => {
  const trendHistory = useSimulationStore((s) => s.trendHistory);
  const clearTrendHistory = useSimulationStore((s) => s.clearTrendHistory);
  const activeSkid = useSimulationStore((s) => s.activeSkid);

  const [timeWindowSec, setTimeWindowSec] = useState<number>(30); // 15, 30, 60
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [frozenSnapshot, setFrozenSnapshot] = useState<typeof trendHistory>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const channelDefs = useMemo<Record<string, { name: string; unit: string; color: string; min: number; max: number }>>(() => {
    if (activeSkid === 'PASTEURIZER_10KLPH') {
      return {
        tk100Level: { name: 'Balance Tank (LT1)', unit: '%', color: '#0284c7', min: 0, max: 100 },
        tk400Level: { name: 'Product Silo Level', unit: '%', color: '#6366f1', min: 0, max: 100 },
        flowRate: { name: 'Feed Flow Rate (FM)', unit: 'L/min', color: '#059669', min: 0, max: 200 },
        temperature: { name: 'Holding Tube (TT5)', unit: '°C', color: '#d97706', min: 0, max: 100 },
        pumpSpeed: { name: 'Feed Pump (VFD)', unit: '% RPM', color: '#dc2626', min: 0, max: 100 },
      };
    }
    if (activeSkid === 'CUSTOM') {
      return {
        tk100Level: { name: 'Primary Vessel Level', unit: '%', color: '#0284c7', min: 0, max: 100 },
        tk400Level: { name: 'Secondary Vessel Level', unit: '%', color: '#6366f1', min: 0, max: 100 },
        flowRate: { name: 'Process Flow Rate', unit: 'L/min', color: '#059669', min: 0, max: 300 },
        temperature: { name: 'Process Temperature', unit: '°C', color: '#d97706', min: 0, max: 120 },
        pumpSpeed: { name: 'Pump Drive Speed', unit: '% RPM', color: '#dc2626', min: 0, max: 100 },
      };
    }
    return {
      tk100Level: { name: 'TK-100 Supply Level', unit: '%', color: '#0284c7', min: 0, max: 100 },
      tk400Level: { name: 'TK-400 Mixing Level', unit: '%', color: '#6366f1', min: 0, max: 100 },
      flowRate: { name: 'Header Flow Rate', unit: 'L/min', color: '#059669', min: 0, max: 250 },
      temperature: { name: 'HX-100 Process Temp', unit: '°C', color: '#d97706', min: 0, max: 100 },
      pumpSpeed: { name: 'P-100 Pump Speed', unit: '% RPM', color: '#dc2626', min: 0, max: 100 },
    };
  }, [activeSkid]);

  const [enabledChannels, setEnabledChannels] = useState<Record<string, boolean>>({
    tk100Level: true,
    tk400Level: true,
    flowRate: true,
    temperature: true,
    pumpSpeed: true,
  });

  const channels: ChannelConfig[] = useMemo(() => {
    return Object.entries(channelDefs).map(([id, def]) => ({
      id,
      ...def,
      enabled: enabledChannels[id] ?? true,
    }));
  }, [channelDefs, enabledChannels]);

  const toggleChannel = (id: string) => {
    setEnabledChannels((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const handleFreezeToggle = () => {
    if (!isFrozen) {
      setFrozenSnapshot([...trendHistory]);
      setIsFrozen(true);
    } else {
      setIsFrozen(false);
    }
  };

  // Determine active dataset (live vs frozen)
  const activeData = isFrozen ? frozenSnapshot : trendHistory;

  // Filter to the time window
  const visibleData = useMemo(() => {
    if (activeData.length === 0) return [];
    const latestTime = activeData[activeData.length - 1].timeSec;
    const cutoff = latestTime - timeWindowSec;
    return activeData.filter((d) => d.timeSec >= cutoff);
  }, [activeData, timeWindowSec]);

  // Dimensions
  const svgWidth = 900;
  const svgHeight = 360;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Compute SVG Paths for each enabled channel
  const channelPaths = useMemo(() => {
    if (visibleData.length < 2) return {};

    const minTime = visibleData[0].timeSec;
    const maxTime = Math.max(minTime + 1, visibleData[visibleData.length - 1].timeSec);
    const timeSpan = maxTime - minTime;

    const paths: Record<string, string> = {};

    channels.forEach((ch) => {
      if (!ch.enabled) return;

      const pts = visibleData.map((d) => {
        const val = (d as any)[ch.id] ?? 0;
        const normX = (d.timeSec - minTime) / timeSpan;
        const normY = Math.max(0, Math.min(1, (val - ch.min) / (ch.max - ch.min)));

        const x = padLeft + normX * plotWidth;
        const y = padTop + (1 - normY) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

      paths[ch.id] = `M ${pts.join(' L ')}`;
    });

    return paths;
  }, [visibleData, channels, plotWidth, plotHeight]);

  // Export CSV Handler
  const exportCsv = () => {
    if (activeData.length === 0) return;

    const headers =
      activeSkid === 'PASTEURIZER_10KLPH'
        ? ['Time (s)', 'Balance_Tank_LT1 (%)', 'Product_Silo_Level (%)', 'Feed_Flow_FM (L/min)', 'Holding_Temp_TT5 (C)', 'Feed_Pump_VFD (%)']
        : activeSkid === 'CUSTOM'
        ? ['Time (s)', 'Vessel_1_Level (%)', 'Vessel_2_Level (%)', 'Line_Flow (L/min)', 'Process_Temp (C)', 'Pump_Speed (%)']
        : ['Time (s)', 'TK100_Level (%)', 'TK400_Level (%)', 'Header_Flow (L/min)', 'HX100_Temp (C)', 'P100_Speed (%)'];

    const rows = activeData.map((d) => [
      d.timeSec.toFixed(1),
      d.tk100Level.toFixed(1),
      d.tk400Level.toFixed(1),
      d.flowRate.toFixed(1),
      d.temperature.toFixed(1),
      d.pumpSpeed.toFixed(1),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `twinforge_${activeSkid.toLowerCase()}_trend_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hoveredPoint = hoverIndex !== null && visibleData[hoverIndex] ? visibleData[hoverIndex] : visibleData[visibleData.length - 1];

  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || visibleData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * svgWidth;

    if (relativeX < padLeft || relativeX > padLeft + plotWidth) {
      setHoverIndex(null);
      return;
    }

    const normX = (relativeX - padLeft) / plotWidth;
    const index = Math.round(normX * (visibleData.length - 1));
    setHoverIndex(Math.max(0, Math.min(visibleData.length - 1, index)));
  };

  return (
    <div className="industrial-card" style={{ padding: 18, height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header & Controls Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingUp size={20} color="var(--color-primary)" />
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Process Trend Recorder & Oscilloscope
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
              {activeSkid === 'PASTEURIZER_10KLPH'
                ? 'High-frequency telemetry: Holding tube TT5, Feed flow FM, Tank levels, and VFD speed.'
                : 'High-frequency multi-channel telemetry acquisition and transient analysis.'}
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Timebase Window Selector */}
          <div style={{ display: 'flex', background: '#e2e8f0', padding: 2, borderRadius: 4, gap: 2 }}>
            {[15, 30, 60].map((t) => (
              <button
                key={t}
                onClick={() => setTimeWindowSec(t)}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 3,
                  border: 'none',
                  background: timeWindowSec === t ? '#0284c7' : 'transparent',
                  color: timeWindowSec === t ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {t}s
              </button>
            ))}
          </div>

          {/* Freeze / Live Toggle */}
          <button onClick={handleFreezeToggle} className={`btn ${isFrozen ? 'btn-danger' : 'btn-ghost'}`} style={{ fontSize: 11 }}>
            {isFrozen ? <Play size={13} /> : <Pause size={13} />}
            {isFrozen ? 'RESUME LIVE' : 'FREEZE TREND'}
          </button>

          {/* Clear Buffer */}
          <button onClick={clearTrendHistory} className="btn btn-ghost" style={{ fontSize: 11 }}>
            <RotateCcw size={13} />
            CLEAR
          </button>

          {/* Export CSV */}
          <button onClick={exportCsv} className="btn btn-primary" style={{ fontSize: 11 }}>
            <Download size={13} />
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#ffffff', border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Grid Lines */}
          <g stroke="#f1f5f9" strokeWidth="1">
            {/* Horizontal Division Lines (0%, 25%, 50%, 75%, 100%) */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((p, i) => {
              const y = padTop + p * plotHeight;
              return (
                <g key={i}>
                  <line x1={padLeft} y1={y} x2={padLeft + plotWidth} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <text x={padLeft - 8} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="9" className="mono">
                    {(100 - p * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })}

            {/* Vertical Time Division Lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((p, i) => {
              const x = padLeft + p * plotWidth;
              return <line key={`v-${i}`} x1={x} y1={padTop} x2={x} y2={padTop + plotHeight} stroke="#e2e8f0" strokeDasharray="4 4" />;
            })}
          </g>

          {/* Traces */}
          {channels.map((ch) => {
            if (!ch.enabled || !channelPaths[ch.id]) return null;
            return (
              <path
                key={ch.id}
                d={channelPaths[ch.id]}
                fill="none"
                stroke={ch.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Crosshair Cursor */}
          {hoverIndex !== null && visibleData[hoverIndex] && (
            <g>
              {(() => {
                const minTime = visibleData[0].timeSec;
                const maxTime = Math.max(minTime + 1, visibleData[visibleData.length - 1].timeSec);
                const normX = (visibleData[hoverIndex].timeSec - minTime) / (maxTime - minTime);
                const cursorX = padLeft + normX * plotWidth;

                return (
                  <>
                    <line x1={cursorX} y1={padTop} x2={cursorX} y2={padTop + plotHeight} stroke="#0f172a" strokeWidth="1" strokeDasharray="2 2" />
                    <rect x={cursorX - 25} y={padTop - 15} width="50" height="14" fill="#0f172a" rx="2" />
                    <text x={cursorX} y={padTop - 5} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" className="mono">
                      {visibleData[hoverIndex].timeSec.toFixed(1)}s
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </svg>

        {/* Live Hover Tooltip / Status Display */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 14,
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              padding: '6px 12px',
              fontSize: 11,
              display: 'flex',
              gap: 14,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span className="mono" style={{ color: 'var(--text-muted)' }}>
              TIME: <strong style={{ color: 'var(--text-primary)' }}>{hoveredPoint.timeSec.toFixed(1)} s</strong>
            </span>
            {channels.map((ch) => {
              if (!ch.enabled) return null;
              const val = (hoveredPoint as any)[ch.id] ?? 0;
              return (
                <span key={ch.id} className="mono" style={{ color: ch.color }}>
                  {ch.name.split(' ')[0]}: <strong>{val.toFixed(1)} {ch.unit}</strong>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Channel Toggles & Telemetry Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {channels.map((ch) => {
          const currentVal = hoveredPoint ? (hoveredPoint as any)[ch.id] ?? 0 : 0;
          return (
            <div
              key={ch.id}
              onClick={() => toggleChannel(ch.id)}
              style={{
                background: ch.enabled ? '#ffffff' : '#f8fafc',
                border: `1px solid ${ch.enabled ? ch.color : 'var(--border-subtle)'}`,
                borderLeft: `4px solid ${ch.enabled ? ch.color : '#cbd5e1'}`,
                borderRadius: 4,
                padding: '8px 12px',
                cursor: 'pointer',
                opacity: ch.enabled ? 1 : 0.6,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {ch.name}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: 9 }}>
                  {ch.unit}
                </span>
              </div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: ch.enabled ? ch.color : 'var(--text-muted)', marginTop: 4 }}>
                {currentVal.toFixed(1)} <span style={{ fontSize: 10 }}>{ch.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
