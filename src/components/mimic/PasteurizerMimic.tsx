/**
 * TwinForge Studio - Milk Pasteurizer 10 KLPH Process Mimic
 * High-Clarity Industrial P&ID SCADA Mimic.
 * Precision orthogonal pipe routing with zero disconnected lines,
 * standard two-way opposing-triangle valve symbols, and external legend.
 */

import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { PheInspectorDrawer } from './PheInspectorDrawer';
import { PumpInspectorDrawer } from './PumpInspectorDrawer';
import { PasteurizerToolbar } from './pasteurizer/PasteurizerToolbar';
import { PasteurizerPidSvg } from './pasteurizer/PasteurizerPidSvg';
import { PasteurizerLegend } from './pasteurizer/PasteurizerLegend';

export const PasteurizerMimic: React.FC = () => {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const running = useSimulationStore((s) => s.running);
  const isFatRunning = useSimulationStore((s) => s.isFatRunning);
  const speed = useSimulationStore((s) => s.speed);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const reset = useSimulationStore((s) => s.reset);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const injectFault = useSimulationStore((s) => s.injectFault);
  const clearFaults = useSimulationStore((s) => s.clearFaults);
  const faults = useSimulationStore((s) => s.faults);

  // Inspector drawer states
  const [isPheDrawerOpen, setIsPheDrawerOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL');
  const [isPumpDrawerOpen, setIsPumpDrawerOpen] = useState(false);

  // Extract simulated devices
  const balTank = snapshot?.devices['TK-BALANCE'];
  const prodTank = snapshot?.devices['TK-PRODUCT'];
  const pRaw = snapshot?.devices['P-RAW'];
  const pFeed = snapshot?.devices['P-FEED'];
  const pBoost = snapshot?.devices['P-BOOSTER'];
  const pHw = snapshot?.devices['P-HOTWATER'];

  // Valves
  const pv1 = snapshot?.devices['PV-1'];
  const pv2 = snapshot?.devices['PV-2'];
  const pv4 = snapshot?.devices['PV-4'];
  const pv5 = snapshot?.devices['PV-5'];
  const pv8 = snapshot?.devices['PV-8'];
  const pv10 = snapshot?.devices['PV-10'];
  const pv11 = snapshot?.devices['PV-11'];
  const pv12 = snapshot?.devices['PV-12'];
  const scv1 = snapshot?.devices['SCV-1'];

  // Sensor tags
  const tags = snapshot?.tags.inputs ?? {};
  const tt1 = Number(tags['TT1'] ?? 4.0);
  const tt5 = Number(tags['TT5'] ?? 90.0);
  const tt6 = Number(tags['TT6'] ?? 95.0);

  const pt1 = Number(tags['PT1'] ?? 0.25);
  const pt2 = Number(tags['PT2'] ?? 2.5);
  const pt3 = Number(tags['PT3'] ?? 180.0);
  const pt4 = Number(tags['PT4'] ?? 4.1);
  const fmFlowLph = Number(tags['FM'] ?? (pFeed?.speedPct ? (pFeed.speedPct / 100) * 10000 : 0));
  const balLevel = Number(tags['LT1'] ?? balTank?.levelPct ?? 75);
  const isLs1Tripped = balLevel < 15;
  const isLs2High = balLevel > 95;

  // Interlock statuses
  const isAtLegalTemp = tt5 >= 88.0;
  const isForwardFlow = isAtLegalTemp && Boolean(pv11?.isOpen ?? true);
  const isDiverted = !isForwardFlow && (pFeed?.speedPct ?? 0) > 0;
  const dpSafe = pt4 - pt2 >= 0.5;

  // PHE Dynamic Tags
  const chillTcIn = Number(tags['PHE_CHILL_TC_IN'] ?? 3.5);
  const chillTcOut = Number(tags['PHE_CHILL_TC_OUT'] ?? 6.2);
  const chillThIn = Number(tags['PHE_CHILL_TH_IN'] ?? 14.8);
  const chillThOut = Number(tags['PHE_CHILL_TH_OUT'] ?? 4.0);

  const reg1TcIn = Number(tags['PHE_REG1_TC_IN'] ?? tt1);
  const reg1TcOut = Number(tags['PHE_REG1_TC_OUT'] ?? 38.5);
  const reg1ThIn = Number(tags['PHE_REG1_TH_IN'] ?? 45.0);
  const reg1ThOut = Number(tags['PHE_REG1_TH_OUT'] ?? chillThIn);

  const reg2TcIn = Number(tags['PHE_REG2_TC_IN'] ?? reg1TcOut);
  const reg2TcOut = Number(tags['PHE_REG2_TC_OUT'] ?? 68.2);
  const reg2ThIn = Number(tags['PHE_REG2_TH_IN'] ?? tt5);
  const reg2ThOut = Number(tags['PHE_REG2_TH_OUT'] ?? reg1ThIn);

  const heatTcIn = Number(tags['PHE_HEAT_TC_IN'] ?? reg2TcOut);
  const heatTcOut = Number(tags['PHE_HEAT_TC_OUT'] ?? tt5);
  const heatThIn = Number(tags['PHE_HEAT_TH_IN'] ?? tt6);
  const heatThOut = Number(tags['PHE_HEAT_TH_OUT'] ?? (tt6 - 4.5));

  const regenEff = Number(tags['PHE_REGEN_EFF_PCT'] ?? 91.5);
  const totalDutyKw = Number(tags['PHE_TOTAL_DUTY_KW'] ?? 245.0);
  const holdingTimeS = Number(tags['PHE_HOLDING_TIME_S'] ?? 20.0);
  const pheStatus = String(tags['PHE_STATUS'] ?? 'NORMAL');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingBottom: 20 }}>
      {/* 1. SCADA Operator Control Toolbar */}
      <PasteurizerToolbar
        running={running}
        isFatRunning={isFatRunning}
        speed={speed}
        isForwardFlow={isForwardFlow}
        isDiverted={isDiverted}
        tt5={tt5}
        isAtLegalTemp={isAtLegalTemp}
        dpSafe={dpSafe}
        pt4={pt4}
        pt2={pt2}
        faults={faults}
        start={start}
        pause={pause}
        reset={reset}
        setSpeed={setSpeed}
        injectFault={injectFault}
        clearFaults={clearFaults}
      />

      {/* 2. Main High-Clarity Process Mimic */}
      <PasteurizerPidSvg
        balTank={balTank}
        prodTank={prodTank}
        pRaw={pRaw}
        pFeed={pFeed}
        pBoost={pBoost}
        pHw={pHw}
        pv1={pv1}
        pv2={pv2}
        pv4={pv4}
        pv5={pv5}
        pv8={pv8}
        pv10={pv10}
        pv11={pv11}
        pv12={pv12}
        scv1={scv1}
        tt1={tt1}
        tt5={tt5}
        tt6={tt6}
        pt1={pt1}
        pt2={pt2}
        pt3={pt3}
        pt4={pt4}
        fmFlowLph={fmFlowLph}
        balLevel={balLevel}
        isLs1Tripped={isLs1Tripped}
        isLs2High={isLs2High}
        isAtLegalTemp={isAtLegalTemp}
        isForwardFlow={isForwardFlow}
        isDiverted={isDiverted}
        chillTcIn={chillTcIn}
        chillTcOut={chillTcOut}
        chillThIn={chillThIn}
        chillThOut={chillThOut}
        reg1TcIn={reg1TcIn}
        reg1TcOut={reg1TcOut}
        reg1ThIn={reg1ThIn}
        reg1ThOut={reg1ThOut}
        reg2TcIn={reg2TcIn}
        reg2TcOut={reg2TcOut}
        reg2ThIn={reg2ThIn}
        reg2ThOut={reg2ThOut}
        heatTcIn={heatTcIn}
        heatTcOut={heatTcOut}
        heatThIn={heatThIn}
        heatThOut={heatThOut}
        regenEff={regenEff}
        totalDutyKw={totalDutyKw}
        holdingTimeS={holdingTimeS}
        pheStatus={pheStatus}
        onInspectPhe={(sectionId) => {
          setSelectedSectionId(sectionId);
          setIsPheDrawerOpen(true);
        }}
        onInspectPump={() => setIsPumpDrawerOpen(true)}
      />

      {/* 3. Dedicated Process Legend & Component Guide */}
      <PasteurizerLegend />

      {/* Dynamic Model Physical Inspection Drawer for PHE */}
      <PheInspectorDrawer
        isOpen={isPheDrawerOpen}
        onClose={() => setIsPheDrawerOpen(false)}
        initialSectionId={selectedSectionId}
      />

      {/* Dynamic Model Physical Inspection Drawer for P-RAW Pump */}
      <PumpInspectorDrawer
        isOpen={isPumpDrawerOpen}
        onClose={() => setIsPumpDrawerOpen(false)}
      />
    </div>
  );
};
