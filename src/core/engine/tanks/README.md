# Sanitary Constant-Level Balance Tank Model (`TK-BALANCE`)
**TwinForge Studio — Process Simulation Core**

## 1. Overview
The `BalanceTankModel` simulates the atmospheric constant-level balance tank (`TK-BALANCE`) at the inlet of continuous HTST dairy pasteurization lines. It provides hydraulic de-aeration, hydraulic separation between raw supply pressure and pasteurizer feed pump suction, diversion return recirculation, and water-to-milk changeover mixing.

The model replaces unphysical clamped volume integration with:
- Strict conservation of mass with dynamic sub-stepping
- Physical overflow totalization and dairy product loss tracking
- Lumped-parameter well-mixed thermal dynamics with ambient heat loss
- Multi-component fluid composition tracking (water fraction, product fraction, fat mass percentage)
- Piecewise volume-to-level height interpolation
- Dual-threshold level switches with Schmitt-trigger hysteresis (`LS1` low, `LS2` high)
- Vortex suction air entrainment modeling below outlet submergence
- Industrial fault injection (`ls1_fail`, `ls2_fail`, `tank_leak`)

All numeric parameters carry an explicit provenance source tag (`source: 'placeholder' | 'datasheet'`).

---

## 2. Mathematical Equations & Physical Modeling

### 2.1 Mass & Volume Conservation
The liquid volume $V$ (L) inside the vessel obeys the differential mass conservation equation:
$$\frac{dV}{dt} = \sum_{i} Q_{\text{in}, i} - Q_{\text{out}} - Q_{\text{overflow}} - Q_{\text{leak}}$$

where:
- $\sum Q_{\text{in}, i}$ is the total volumetric inflow from all streams (raw milk, mains water, diversion return) in L/h.
- $Q_{\text{out}}$ is the requested process outflow (feed pump demand) in L/h.
- $Q_{\text{overflow}}$ is the gravity overflow rate in L/h when volume reaches vessel capacity $V_{\text{cap}} = 600\text{ L}$.
- $Q_{\text{leak}}$ is the external leak rate in L/h under tank shell rupture faults.

#### Dynamic Sub-Stepping
To ensure stability during severe flow transients or near-empty conditions, each integration step $dt$ is subdivided into $N$ equal sub-steps such that no sub-step changes tank volume by more than $5\%$ of total capacity:
$$N = \max\left(1, \left\lceil \frac{|\sum Q_{\text{in}} - Q_{\text{requested}}| \cdot \frac{dt}{3600}}{0.05 \cdot V_{\text{cap}}} \right\rceil\right)$$
$$dt_{\text{sub}} = \frac{dt}{N}$$

#### Empty Vessel Limiting & Starvation
When available fluid $V + \sum Q_{\text{in}} \cdot dt_{\text{sub}}$ cannot satisfy the requested outflow:
$$Q_{\text{actual, out}} = \frac{V + \sum Q_{\text{in}} \cdot dt_{\text{sub}}}{dt_{\text{sub}}}$$
$$V_{\text{new}} = 0$$
and the alarm `TK_BAL_EMPTY` is asserted. The actual outflow is propagated downstream to starve the feed pump and PHE.

#### Capacity Overflow & Product Loss Totalization
When liquid volume exceeds capacity $V_{\text{cap}}$:
$$Q_{\text{overflow}} = \frac{V_{\text{tentative}} - V_{\text{cap}}}{dt_{\text{sub}}}$$
$$V_{\text{new}} = V_{\text{cap}}$$
The alarm `TK_BAL_OVERFLOW` is raised. The total overflow volume and product portion are integrated continuously:
$$V_{\text{overflow, total}} = \int Q_{\text{overflow}} \, dt$$
$$V_{\text{product overflow, total}} = \int Q_{\text{overflow}} \cdot w_{\text{product}} \, dt$$

---

### 2.2 Well-Mixed Lumped Thermal Dynamics
Assuming rapid and complete mechanical mixing across the liquid volume, internal temperature $T$ (°C) follows energy conservation:
$$\frac{dT}{dt} = \frac{1}{V} \sum_{i} Q_{\text{in}, i} (T_{\text{in}, i} - T) - \frac{UA \cdot (T - T_{\text{ambient}})}{\rho \cdot c_p \cdot V}$$

where placeholder dairy fluid constants are:
- Density $\rho = 1030\text{ kg/m}^3$
- Specific heat capacity $c_p = 3930\text{ J/(kg}\cdot\text{K)}$
- Tank heat loss coefficient $UA = 5.0\text{ W/K}$
- Ambient air temperature $T_{\text{ambient}} = 25.0\text{ }^\circ\text{C}$

> [!NOTE]
> Below $2\%$ volume ($V < 0.02 \cdot V_{\text{cap}} = 12\text{ L}$), temperature differential updates are frozen to avoid division by near-zero volume; any incoming stream volume-replaces residual contents.

---

### 2.3 Fluid Composition & Fat Fraction Tracking
Fluid composition is tracked across three conserved fields:
1. $w_{\text{water}}$: plain water volume fraction ($0 \le w_{\text{water}} \le 1$)
2. $w_{\text{product}}$: dairy product volume fraction ($w_{\text{water}} + w_{\text{product}} = 1.0$)
3. $\text{fatPct}$: mass fat percentage of the dairy product portion ($0 \le \text{fatPct} \le 100$)

For each volume fraction component $c \in \{w_{\text{water}}, w_{\text{product}}\}$:
$$\frac{dc}{dt} = \frac{1}{V} \sum_{i} Q_{\text{in}, i} (c_{\text{in}, i} - c)$$

The product fat concentration mixes strictly on a dairy product volume basis:
$$\text{fat}_{\text{new}} = \frac{V_{\text{product, old}} \cdot \text{fat}_{\text{old}} + \sum_{i} Q_{\text{in}, i} \cdot w_{\text{product}, i} \cdot \text{fat}_{\text{in}, i} \cdot dt_{\text{sub}}}{V_{\text{product, new}}}$$
Adding plain water ($w_{\text{product}} = 0$) reduces product fraction but preserves the intrinsic fat percentage of the remaining product portion.

---

### 2.4 Geometry Table & Level Percentage
Level height $h$ (mm) is interpolated from a piecewise volume-to-height table:
- Cylindrical vessel placeholder: $0\text{ L} \to 0\text{ mm}$, $600\text{ L} \to 800\text{ mm}$
- Level percentage:
$$\text{levelPct} = \frac{h(V)}{h_{\text{max}}} \times 100\%$$

---

### 2.5 Level Switches with Hysteresis
To prevent chattering around threshold boundaries, level switches utilize hysteresis deadbands:
- **`LS1` (Low Level Switch — Dry-Run Safety Interlock):**
  - Trip (`true`): $\text{levelPct} < 15.0\%$
  - Reset (`false`): $\text{levelPct} > 20.0\%$
- **`LS2` (High Level Switch — Inlet Cutoff / Overfill):**
  - Trip (`true`): $\text{levelPct} > 95.0\%$
  - Reset (`false`): $\text{levelPct} < 90.0\%$

---

### 2.6 Hydraulic Air Entrainment
When liquid level drops below the outlet nozzle submergence threshold ($\theta_{\text{submergence}} = 5.0\%$), vortexing pulls air into the bottom suction outlet:
$$\alpha_{\text{air}} = \begin{cases} 0 & \text{if } \text{levelPct} \ge \theta_{\text{submergence}} \\ 1.0 - \frac{\text{levelPct}}{\theta_{\text{submergence}}} & \text{if } 0 \le \text{levelPct} < \theta_{\text{submergence}} \end{cases}$$
When $\alpha_{\text{air}} > 0$, the alarm `TK_BAL_AIR_ENTRAINMENT` is asserted.

---

## 3. Industrial Fault Modes

| Fault Mode | Target Device | Description | Behavioral Impact |
| :--- | :--- | :--- | :--- |
| `ls1_fail` | `TK-BALANCE` | Low-level switch electrical failure | `value = 0`: stuck off (`false`); `value = 1`: stuck on (`true`). |
| `ls2_fail` | `TK-BALANCE` | High-level switch electrical failure | `value = 0`: stuck off (`false`); `value = 1`: stuck on (`true`). |
| `tank_leak` | `TK-BALANCE` | Tank shell crack / drain valve rupture | Discharges fluid at `value` L/h continuously. |
