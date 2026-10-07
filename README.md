# TwinForge Studio

> **Industrial Virtual Commissioning & Automated Factory Acceptance Testing (FAT) Platform**  
> Engineered for process OEMs, system integrators, and automation engineers.

---

## 1. Overview

**TwinForge Studio** is a next-generation industrial virtual commissioning platform. It enables control engineers to simulate physical process plants deterministically, verify PLC control logic and safety interlocks, capture high-frequency process trends, and generate tamper-evident FAT compliance certificates before touching physical equipment on site.

### Key Capabilities
- **Deterministic Physical Simulation**: Strict 100 ms scan loop ($INGEST \rightarrow ADVANCE \rightarrow RESOLVE \rightarrow FLOW \rightarrow INTEGRATE \rightarrow SENSE \rightarrow PUBLISH$). Zero wall-clock jitter, repeatable findings.
- **Universal Driver Architecture**: In-process Mock PLC, OPC UA client bridge, Modbus TCP, and Siemens S7 compatibility.
- **Real-Time Process Trend Recorder & Oscilloscope**: Multi-channel high-frequency telemetry tracking (Levels, Flow, Temperature, Pump Speed) with interactive crosshairs and 1-click **Export to CSV**.
- **Interactive Fault Injection Deck (Phase F)**: Live actuation of valve seizures, contactor overloads, transmitter calibration drift, and transit delays.
- **Automated FAT Execution Suite**: Automated scenario runner mapped to Functional Design Specifications (FDS clauses) with scan-by-scan evidence diff journal.
- **Certified Compliance Report Generator (Phase G)**: Exportable, audit-ready PDF/A compliance certificate with cryptographic simulation hash and safety interlock verification matrix.
- **Visual P&ID Process Modeler**: Drag-and-drop node graph canvas built on `@xyflow/react` for visual process topology inspection and design.
- **ISA-101 High-Performance Light Mode HMI**: Industrial control room design with high-contrast state indicators and zero decorative emojis.

---

## 2. Competitive Superiority over Legacy Tools (e.g. Edge64 UnitFAT)

| Dimension | Legacy Tools (Edge64 UnitFAT) | TwinForge Studio |
| :--- | :--- | :--- |
| **P&ID Modeler & Physics** | Layout editor only changes SVG coordinates; zero effect on physics. Plants hardcoded in code. | Visual node-based topology canvas with live physical state indicators. |
| **Process Trend Recorder** | None. No time-series strip chart or oscilloscope. | **Built-in Multi-Channel Oscilloscope** with cursor readouts, freeze mode, and CSV export. |
| **Fault Injection** | Unbuilt in UI. Faults can only be scripted in TypeScript code by developers. | **Live Fault Injection Station** (Phase F) with 1-click runtime failure triggering. |
| **FAT Evidence Reports** | No exportable legal report document. | **Audit-Ready Certified FAT Report** (Phase G) ready for regulatory sign-off. |
| **Hardware Portability** | Siemens-only with fragile external Python sub-process bridge. | Universal protocol architecture (OPC UA, Modbus TCP, EtherNet/IP, S7). |
| **User Interface** | Split across multiple disconnected browser URLs. | Unified HMI workspace with seamless tabbed switching. |

---

## 3. Tech Stack

- **Desktop Shell**: Electron 44 + `electron-builder` (Cross-platform native executable packaging)
- **Frontend Core**: Vite 8 + React 19 + TypeScript
- **State Management**: Zustand (sub-millisecond real-time simulation coordination)
- **Node Graph Canvas**: `@xyflow/react` (React Flow)
- **Styling**: ISA-101 High-Performance Light Theme Vanilla CSS
- **Iconography**: `lucide-react`
- **Native OS Bridges**: Secure IPC file dialogs for FAT reports and CSV oscillograms

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

If running in a browser environment without Electron:
```bash
npm run dev
```
The browser view is available at `http://localhost:5173`.
