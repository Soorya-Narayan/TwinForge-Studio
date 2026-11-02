# TwinForge Studio

> **Industrial Virtual Commissioning & Automated Factory Acceptance Testing (FAT) Platform**  
> Engineered for process OEMs, system integrators, and automation engineers.

---

## 1. Overview

**TwinForge Studio** is an industrial virtual commissioning and simulation platform. It enables control engineers to simulate physical process equipment deterministically, verify PLC control logic and safety interlocks, capture high-frequency process trends, inject runtime equipment faults, and run automated FAT test scenarios before deploying to physical hardware on site.

---

## 2. Capabilities

### Implemented

- **Deterministic Physical Simulation Engine**:
  - Discrete 100 ms fixed scan loop (`INGEST → ADVANCE → RESOLVE → FLOW → INTEGRATE → SENSE → PUBLISH`).
  - Strict step-based physics with zero wall-clock jitter for repeatable testing.
  - Multi-skid physical modeling:
    - **Plate Heat Exchanger (PHE) Pasteurizer Skid**: Detailed thermal modeling across Regenerative, Heating, and Cooling sections, holding tube residence time calculation, hot water loop, and automated Flow Diversion Valve (FDV) diversion logic.
    - **Three-Solution Batch Mixing Skid**: Multi-vessel transfer, variable dosing rates, and agitation dynamics.
    - **Custom Process Skid Builder**: Configurable vessels, pumps, valves, and transmitter definitions.
- **Real Industrial PLC Driver (OPC UA via node-opcua)**:
  - Real-time connection over standard `opc.tcp://` protocol to OPC UA servers and controllers.
  - Native Node.js communication stack executing in Electron main process using `node-opcua-client`.
  - Bidirectional cyclic I/O synchronization: feeds physical simulation sensor telemetry to PLC inputs and captures real-time PLC commands/interlocks.
  - Embedded local test OPC UA server via `node-opcua-server` (port 4840) with standard plant address space for instant zero-hardware loopback testing.
- **In-Process Mock PLC Driver Architecture**:
  - Unified `Driver` boundary (`readOutputs()` / `writeInputs()`) decoupling plant physics from control logic.
  - Built-in TypeScript PLC controllers:
    - `PasteurizerPlcDriver`: State machine for CIP, Water Flush, Pasteurize, and Divert modes; PID temperature control loops; safety interlocks.
    - `MockPlcDriver`: 3-solution batch state sequencing (Dosing, Mixing, Discharge) and 15-rule safety interlock matrix.
    - `GenericPlcDriver`: Tag-mapped control driver for custom skids.
- **Real-Time Process Trend Recorder & Oscilloscope**:
  - Multi-channel high-frequency telemetry tracking (Levels, Flow Rates, Temperatures, Pressures, Pump Speeds).
  - Channel toggling, time window adjustment, freeze/pause mode, and interactive cursor inspection readouts.
  - One-click **Export to CSV** for offline process analysis.
- **Interactive Fault Injection Deck**:
  - Live runtime actuation of device failures without code changes:
    - Valve mechanical seizures and stuck open/closed conditions.
    - Contactor overloads and pump electrical trips.
    - Transmitter sensor calibration drift and scaling offsets.
    - Signal transmission / transit delays.
- **Automated FAT Execution Suite**:
  - Automated scenario runner executing sequences mapped to Functional Design Specification (FDS) clauses.
  - Step-by-step stimulus injection and scan-by-scan assertion validation.
  - Live execution telemetry, failure diagnostics, and pass/fail reporting.
- **FAT Inspection & Export Report**:
  - In-app verification modal displaying executed scenario results, interlock verification matrices, execution timestamps, and simulation Run Fingerprint (SHA-256).
  - Native PDF document generation via Electron's `webContents.printToPDF` (with web browser print fallback).
- **Visual P&ID Process Modeler & Mimics**:
  - Interactive SVG-based skid mimics with animated fluid flows, device states, and telemetry inspection drawers.
  - Drag-and-drop node graph canvas built on `@xyflow/react` for visual process topology inspection and layout design.
- **Tag Watch & Force Table**:
  - Live I/O monitoring across all boolean and analog process tags.
  - Manual tag override / forcing capability for commissioning validation.
- **ISA-101 High-Performance Light Theme HMI**:
  - Ergonomic industrial control room styling with high-contrast state indicators and focused telemetry presentation.
- **Desktop Packaging**:
  - Native cross-platform desktop application packaging using Electron 44 and `electron-builder`.

---

### Planned (Roadmap)

- **External Hardware & Fieldbus Protocol Drivers**:
  - **Modbus TCP Driver**: Fieldbus communication via standard holding register and coil polling.
  - **Siemens S7 Protocol Driver**: Native S7 communication (DB block reading/writing for S7-1200 / S7-1500 controllers).
  - **EtherNet/IP Driver**: CIP tag-based integration for Rockwell / Allen-Bradley ControlLogix and CompactLogix PLCs.
- **Digital Signatures & PDF/A Archival Export**:
  - Direct generation of ISO 19005-compliant PDF/A archival documents.
  - Cryptographic digital signing with user-controlled private keys for audit trail verification.
- **Dynamic Hydraulic & Multi-Phase Flow Solver**:
  - Dynamic pipe network pressure-drop calculation, friction loss modeling, and two-phase vapor/liquid handling.
- **PLC Logic Code Generation**:
  - Export verified visual control sequences directly into IEC 61131-3 Structured Text (ST) and Siemens SCL.

---

## 3. Tech Stack

- **Desktop Shell**: Electron 44 + `electron-builder` (Cross-platform native executable packaging)
- **Frontend Core**: Vite 8 + React 19 + TypeScript
- **State Management**: Zustand
- **Node Graph Canvas**: `@xyflow/react`
- **Styling**: ISA-101 High-Performance Light Theme Vanilla CSS
- **Iconography**: `lucide-react`
- **Linter**: `oxlint`

---

## 4. Desktop Software Development & Packaging

### Prerequisites
- Node.js >= 18
- npm >= 9

### Running the Desktop App

```bash
# 1. Start live desktop development with HMR
npm run electron:dev

# 2. Or run the compiled production desktop application locally
npm run electron:start
```

### Packaging & Distribution

```bash
# Compile and create unpackaged native .app / binary
npm run dist:dir

# Build production installer for your current OS (DMG/Zip on macOS, NSIS on Windows, AppImage on Linux)
npm run dist

# Target-specific builds
npm run dist:mac     # macOS DMG and ZIP
npm run dist:win     # Windows NSIS and Portable EXE
npm run dist:linux   # Linux AppImage
```

Packaged binaries and installers are output to the `./release/` directory.

---

## 5. Web Mode (Optional)

If running in a standard browser environment without Electron:

```bash
npm run dev
```

The browser view will be available at `http://localhost:5173`.
