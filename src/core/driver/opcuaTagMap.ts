/**
 * TwinForge Studio - OPC UA Tag Mapping Configuration
 * 
 * Maps internal simulator tag identifiers (e.g. TT5, P_FEED_CMD) to real industrial
 * PLC NodeIds (e.g. ns=3;s="DB_Process"."TT5" for Siemens S7-1500, or ns=1;s=ControllerTags.P_FEED_CMD for Rockwell).
 */

export type TagDirection = 'INPUT' | 'OUTPUT';

export type TagDataType = 'Boolean' | 'Float' | 'Double' | 'Int16' | 'Int32' | 'String';

export interface TagDefinition {
  tag: string;
  name: string;
  skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'COMMON';
  direction: TagDirection; // INPUT: Sensor feedback written to PLC; OUTPUT: Command read from PLC
  dataType: TagDataType;
  defaultNodeId: string;
  description: string;
}

export const DEFAULT_OPCUA_TAGS: TagDefinition[] = [
  // Pasteurizer Skid Inputs (Simulator Sensors -> PLC Input registers)
  // External PLCs (Siemens S7 REAL, Rockwell REAL) use 32-bit single-precision Float
  { tag: 'TT1', name: 'Raw Milk In Temp', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TT1', description: 'Raw milk intake temperature (°C)' },
  { tag: 'TT2', name: 'Pre-heat Temp', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TT2', description: 'Pre-heating exit temperature (°C)' },
  { tag: 'TT3', name: 'Heating Section Temp', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TT3', description: 'Hot water heating zone exit temperature (°C)' },
  { tag: 'TT4', name: 'Regeneration Exit Temp', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TT4', description: 'Pasteurized milk regen exit temperature (°C)' },
  { tag: 'TT5', name: 'Holding Tube Temp', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TT5', description: 'Critical legal pasteurization temperature sensor (°C)' },
  { tag: 'FM', name: 'Product Flow Rate', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=FM', description: 'Electromagnetic flow meter reading (L/h)' },
  { tag: 'PT2', name: 'Booster Pump Inlet Pressure', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=PT2', description: 'Raw regeneration side pressure (bar)' },
  { tag: 'PT4', name: 'Pasteurized Outlet Pressure', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=PT4', description: 'Pasteurized regeneration side pressure (bar)' },
  { tag: 'LT_BALANCE', name: 'Balance Tank Level', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=LT_BALANCE', description: 'Constant level tank inventory level (%)' },
  { tag: 'LT_PRODUCT', name: 'Product Tank Level', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=LT_PRODUCT', description: 'Finished pasteurized milk tank level (%)' },
  { tag: 'P_RAW_RUN_FB', name: 'Raw Pump Run Feedback', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_RAW_RUN_FB', description: 'Raw milk transfer pump run confirmation feedback' },
  { tag: 'P_RAW_CURRENT', name: 'Raw Pump Motor Current', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=P_RAW_CURRENT', description: 'Raw milk transfer pump motor active current (A)' },
  { tag: 'P_RAW_FAULT', name: 'Raw Pump Fault / Overload Trip', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_RAW_FAULT', description: 'Raw milk transfer pump thermal trip or motor fault' },
  { tag: 'P_RAW_RUNOUT', name: 'Raw Pump Run-Out Alarm', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_RAW_RUNOUT', description: 'Raw milk transfer pump run-out flow alarm (>102% max curve flow)' },
  { tag: 'PV1_ZSO', name: 'Raw Milk Infeed ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV1_ZSO', description: 'Raw milk infeed valve open switch' },
  { tag: 'PV1_ZSC', name: 'Raw Milk Infeed ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV1_ZSC', description: 'Raw milk infeed valve closed switch' },
  { tag: 'PV2_ZSO', name: 'Water Infeed ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV2_ZSO', description: 'Water infeed valve open switch' },
  { tag: 'PV2_ZSC', name: 'Water Infeed ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV2_ZSC', description: 'Water infeed valve closed switch' },
  { tag: 'PV3_ZSO', name: 'HW Prep Infeed ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV3_ZSO', description: 'Hot water loop infeed valve open switch' },
  { tag: 'PV3_ZSC', name: 'HW Prep Infeed ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV3_ZSC', description: 'Hot water loop infeed valve closed switch' },
  { tag: 'PV4_ZSO', name: 'Separator Feed ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV4_ZSO', description: 'Separator feed isolation valve open switch' },
  { tag: 'PV4_ZSC', name: 'Separator Feed ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV4_ZSC', description: 'Separator feed isolation valve closed switch' },
  { tag: 'PV5_ZSO', name: 'Skim Return ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV5_ZSO', description: 'Skim milk return valve open switch' },
  { tag: 'PV5_ZSC', name: 'Skim Return ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV5_ZSC', description: 'Skim milk return valve closed switch' },
  { tag: 'PV7_ZSO', name: 'Separator Bypass ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV7_ZSO', description: 'Separator bypass valve open switch' },
  { tag: 'PV7_ZSC', name: 'Separator Bypass ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV7_ZSC', description: 'Separator bypass valve closed switch' },
  { tag: 'PV8_ZSO', name: 'Homogenizer Infeed ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV8_ZSO', description: 'Homogenizer infeed valve open switch' },
  { tag: 'PV8_ZSC', name: 'Homogenizer Infeed ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV8_ZSC', description: 'Homogenizer infeed valve closed switch' },
  { tag: 'PV9_ZSO', name: 'Homogenizer Bypass ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV9_ZSO', description: 'Homogenizer bypass valve open switch' },
  { tag: 'PV9_ZSC', name: 'Homogenizer Bypass ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV9_ZSC', description: 'Homogenizer bypass valve closed switch' },
  { tag: 'PV11_ZSO', name: 'FDV Forward ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV11_ZSO', description: 'Flow diversion valve forward open switch' },
  { tag: 'PV11_ZSC', name: 'FDV Forward ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV11_ZSC', description: 'Flow diversion valve forward closed switch' },
  { tag: 'PV12_ZSO', name: 'FDV Divert ZSO', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV12_ZSO', description: 'Flow diversion valve divert open switch' },
  { tag: 'PV12_ZSC', name: 'FDV Divert ZSC', skid: 'PASTEURIZER_10KLPH', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV12_ZSC', description: 'Flow diversion valve divert closed switch' },

  // Pasteurizer Skid Outputs (PLC Control Outputs -> Simulator Actuators)
  { tag: 'P_RAW_START', name: 'Raw Milk Pump Start Cmd', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_RAW_START', description: 'Raw milk transfer pump run command from PLC' },
  { tag: 'P_FEED_CMD', name: 'Feed Pump Run Cmd', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_FEED_CMD', description: 'Variable speed positive displacement feed pump run' },
  { tag: 'P_BOOSTER_CMD', name: 'Booster Pump Run Cmd', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_BOOSTER_CMD', description: 'Sanitary booster pump forward run' },
  { tag: 'P_HOT_WATER_CMD', name: 'HW Circulation Pump Cmd', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P_HOT_WATER_CMD', description: 'Hot water loop circulation pump' },
  { tag: 'PV11_CMD', name: 'FDV Forward Cmd', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV11_CMD', description: 'Flow diversion valve forward route (energized = forward)' },
  { tag: 'PV12_CMD', name: 'FDV Divert Cmd', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=PV12_CMD', description: 'Flow diversion valve recycle divert route to balance tank' },
  { tag: 'MOD_VALVE', name: 'Steam Modulating Valve', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=MOD_VALVE', description: 'Modulating steam control valve position (0-100%)' },
  { tag: 'IL-FDV', name: 'FDV Interlock Status', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=IL-FDV', description: 'Legal pasteurization temperature permissive status' },
  { tag: 'IL-DIFF', name: 'Differential Interlock Status', skid: 'PASTEURIZER_10KLPH', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=IL-DIFF', description: 'Sanitary positive differential pressure status' },

  // Batch Mixing Inputs (Simulator Sensors -> PLC Input registers)
  { tag: 'TK100_LT', name: 'Mix Tank 100 Level', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TK100_LT', description: 'Batch mixing tank inventory level (%)' },
  { tag: 'TK400_LT', name: 'Discharge Tank 400 Level', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TK400_LT', description: 'Finished batch storage tank level (%)' },
  { tag: 'TT100', name: 'Mix Tank Temperature', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=TT100', description: 'Tank batch temperature (°C)' },
  { tag: 'FT100', name: 'Transfer Flow Rate', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=FT100', description: 'Flow sensor on pump transfer header (L/min)' },
  { tag: 'PT100', name: 'Transfer Pressure', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Float', defaultNodeId: 'ns=1;s=PT100', description: 'Pump discharge line pressure (bar)' },
  { tag: 'V101_ZSO', name: 'Suction Valve Open Switch', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V101_ZSO', description: 'Limit switch feedback: valve 101 fully open' },
  { tag: 'V101_ZSC', name: 'Suction Valve Closed Switch', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V101_ZSC', description: 'Limit switch feedback: valve 101 fully closed' },
  { tag: 'V102_ZSO', name: 'Transfer Valve Open Switch', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V102_ZSO', description: 'Limit switch feedback: valve 102 fully open' },
  { tag: 'V102_ZSC', name: 'Transfer Valve Closed Switch', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V102_ZSC', description: 'Limit switch feedback: valve 102 fully closed' },
  { tag: 'V400_PROD_ZSO', name: 'Storage Valve Open Switch', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V400_PROD_ZSO', description: 'Limit switch feedback: valve 400 fully open' },
  { tag: 'V400_PROD_ZSC', name: 'Storage Valve Closed Switch', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V400_PROD_ZSC', description: 'Limit switch feedback: valve 400 fully closed' },
  { tag: 'E_STOP_PB', name: 'Emergency Stop Pushbutton', skid: 'BATCH_MIXING', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=E_STOP_PB', description: 'Field safety emergency stop contact (NC contact = true)' },

  // Batch Mixing Outputs (PLC Control Outputs -> Simulator Actuators)
  { tag: 'P100_START', name: 'Transfer Pump 100 Run', skid: 'BATCH_MIXING', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=P100_START', description: 'Main batch transfer and circulation pump' },
  { tag: 'V101_CMD', name: 'Suction Valve Cmd', skid: 'BATCH_MIXING', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V101_CMD', description: 'Tank 100 bottom outlet isolation valve' },
  { tag: 'V102_CMD', name: 'Transfer Valve Cmd', skid: 'BATCH_MIXING', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V102_CMD', description: 'Transfer line valve to storage tank 400' },
  { tag: 'V103_CMD', name: 'Recirculation Valve Cmd', skid: 'BATCH_MIXING', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=V103_CMD', description: 'Tank 100 top recirculation spray ring valve' },
  { tag: 'HEATER_CMD', name: 'Steam Injection Heater', skid: 'BATCH_MIXING', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=HEATER_CMD', description: 'In-line thermal heat exchanger heating element' },
  { tag: 'AGITATOR_CMD', name: 'Agitator Drive Cmd', skid: 'BATCH_MIXING', direction: 'OUTPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=AGITATOR_CMD', description: 'Tank 100 mixing agitator impeller drive' },
  // Lockstep Handshake & State Precondition Tags (Common)
  { tag: 'PLC_STATE', name: 'PLC Sequence State', skid: 'COMMON', direction: 'OUTPUT', dataType: 'String', defaultNodeId: 'ns=1;s=PLC_STATE', description: 'Internal PLC operational state machine token' },
  { tag: 'RESET_CMD', name: 'PLC Reset Command', skid: 'COMMON', direction: 'INPUT', dataType: 'Boolean', defaultNodeId: 'ns=1;s=RESET_CMD', description: 'Reset command to restore PLC state machine to baseline' },
  { tag: 'SEQ', name: 'Lockstep Scan Sequence', skid: 'COMMON', direction: 'INPUT', dataType: 'Int32', defaultNodeId: 'ns=1;s=SEQ', description: 'Lockstep scan sequence number written by test harness' },
  { tag: 'SEQ_ACK', name: 'Lockstep Sequence Acknowledgment', skid: 'COMMON', direction: 'OUTPUT', dataType: 'Int32', defaultNodeId: 'ns=1;s=SEQ_ACK', description: 'Lockstep scan sequence number echoed by PLC' },
];

export const PASTEURIZER_OUTPUT_TAGS: string[] = [
  'P_RAW_START',
  'P_FEED_CMD',
  'P_BOOSTER_CMD',
  'P_HOT_WATER_CMD',
  'PV11_CMD',
  'PV12_CMD',
  'MOD_VALVE',
  'IL-FDV',
  'IL-DIFF',
];

export const BATCH_MIXING_OUTPUT_TAGS: string[] = [
  'P100_START',
  'V101_CMD',
  'V102_CMD',
  'V103_CMD',
  'HEATER_CMD',
  'AGITATOR_CMD',
  'IL-01',
  'IL-02',
  'IL-03',
];

export const PASTEURIZER_INPUT_TAGS: string[] = [
  'TT1',
  'TT2',
  'TT3',
  'TT4',
  'TT5',
  'FM',
  'PT2',
  'PT4',
  'LT_BALANCE',
  'LT_PRODUCT',
  'P_RAW_RUN_FB',
  'P_RAW_CURRENT',
  'P_RAW_FAULT',
  'P_RAW_RUNOUT',
  'PV1_ZSO',
  'PV1_ZSC',
  'PV2_ZSO',
  'PV2_ZSC',
  'PV3_ZSO',
  'PV3_ZSC',
  'PV4_ZSO',
  'PV4_ZSC',
  'PV5_ZSO',
  'PV5_ZSC',
  'PV7_ZSO',
  'PV7_ZSC',
  'PV8_ZSO',
  'PV8_ZSC',
  'PV9_ZSO',
  'PV9_ZSC',
  'PV11_ZSO',
  'PV11_ZSC',
  'PV12_ZSO',
  'PV12_ZSC',
];

export const BATCH_MIXING_INPUT_TAGS: string[] = [
  'TK100_LT',
  'TK400_LT',
  'TT100',
  'FT100',
  'PT100',
  'V101_ZSO',
  'V101_ZSC',
  'V102_ZSO',
  'V102_ZSC',
  'V400_PROD_ZSO',
  'V400_PROD_ZSC',
  'E_STOP_PB',
];

export const COMMON_OUTPUT_TAGS: string[] = ['SEQ_ACK', 'PLC_STATE'];
export const COMMON_INPUT_TAGS: string[] = ['SEQ', 'RESET_CMD'];

/**
 * Returns the output tags to poll cyclically for a specific skid, avoiding
 * reading unnecessary tags from other processes.
 */
export function getOutputTagsForSkid(skid: 'PASTEURIZER_10KLPH' | 'BATCH_MIXING' | 'CUSTOM' | string): string[] {
  let tags: string[];
  if (skid === 'PASTEURIZER_10KLPH') {
    tags = [...PASTEURIZER_OUTPUT_TAGS];
  } else if (skid === 'BATCH_MIXING') {
    tags = [...BATCH_MIXING_OUTPUT_TAGS];
  } else {
    tags = [...PASTEURIZER_OUTPUT_TAGS, ...BATCH_MIXING_OUTPUT_TAGS];
  }
  return [...new Set([...tags, ...COMMON_OUTPUT_TAGS])];
}

export const TAG_MAP_STORAGE_KEY = 'twinforge_opcua_tag_map';

export function getDefaultTagMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of DEFAULT_OPCUA_TAGS) {
    map[def.tag] = def.defaultNodeId;
  }
  return map;
}

/**
 * Siemens S7-1200 / S7-1500 optimized DB format: ns=3;s="DB_Process"."TAG"
 */
export function generateSiemensDbTagMap(dbName: string = 'DB_Process', namespaceIndex: number = 3): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of DEFAULT_OPCUA_TAGS) {
    map[def.tag] = `ns=${namespaceIndex};s="${dbName}"."${def.tag}"`;
  }
  return map;
}

/**
 * Rockwell Allen-Bradley ControlLogix format: ns=1;s=Program:MainProgram.TAG
 */
export function generateRockwellTagMap(scope: string = 'Program:MainProgram', namespaceIndex: number = 1): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of DEFAULT_OPCUA_TAGS) {
    map[def.tag] = `ns=${namespaceIndex};s=${scope}.${def.tag}`;
  }
  return map;
}

/**
 * Beckhoff TwinCAT / CODESYS format: ns=2;s=MAIN.TAG
 */
export function generateCodesysTagMap(gvlName: string = 'MAIN', namespaceIndex: number = 2): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of DEFAULT_OPCUA_TAGS) {
    map[def.tag] = `ns=${namespaceIndex};s=${gvlName}.${def.tag}`;
  }
  return map;
}

export function loadStoredTagMap(): Record<string, string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(TAG_MAP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...getDefaultTagMap(), ...parsed };
        }
      }
    }
  } catch {
    // Ignore storage parse errors and fallback
  }
  return getDefaultTagMap();
}

export function saveStoredTagMap(map: Record<string, string>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TAG_MAP_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage write errors in restricted contexts
  }
}

export const TAG_TYPE_MAP_STORAGE_KEY = 'twinforge_opcua_tag_types';

export function getDefaultTagTypeMap(): Record<string, TagDataType> {
  const map: Record<string, TagDataType> = {};
  for (const def of DEFAULT_OPCUA_TAGS) {
    map[def.tag] = def.dataType;
  }
  return map;
}

export function loadStoredTagTypeMap(): Record<string, TagDataType> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(TAG_TYPE_MAP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...getDefaultTagTypeMap(), ...parsed };
        }
      }
    }
  } catch {
    // Ignore storage parse errors and fallback
  }
  return getDefaultTagTypeMap();
}

export function saveStoredTagTypeMap(map: Record<string, TagDataType>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TAG_TYPE_MAP_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage write errors in restricted contexts
  }
}
