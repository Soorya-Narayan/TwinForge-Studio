# Centrifugal Pump & Series Hydraulic Circuit Model
**TwinForge Studio — Process Simulation Core**

## 1. Overview
This module implements a first-principles dynamic numerical model of centrifugal pumps coupled with series hydraulic networks for TwinForge Studio.
Specifically, it models the **Raw Milk Transfer Pump (`P-RAW`, tag `P_RAW`)** pumping raw chilled milk from the bulk silo outside the skid boundary through isolation valve `PV-1` into the constant-level balance tank (`TK-BALANCE`).

The model replaces hardcoded flow approximations with:
- Quadratic head-flow characteristic curves fitted to manufacturer curve points
- Affinity law scaling for rotational speed ($s = N / N_{\text{rated}}$)
- Motor electromechanical dynamics (soft-start ramps, free coast-down inertia, run feedback)
- Hydraulic power, shaft power, and electrical motor current derivation
- Thermal $I^2t$ overload integration and automatic trip interlock
- Net Positive Suction Head ($NPSHa$ vs $NPSHr$) cavitation head degradation
- Dry-running protection and alarms
- Series hydraulic pipeline resistance (Darcy-Weisbach with Swamee-Jain, fittings $K$-values, control valves, static elevation head)
- Rigorous bisection solver for operating point determination ($Q \in [0, 1.5 \cdot Q_{\text{max}}]$)
- Deadhead timeout tracking and reverse flow gravity dynamics

All numeric parameters carry an explicit provenance source tag (`source: 'placeholder' | 'datasheet'`).

---

## 2. Mathematical Equations & Physical Modeling

### 2.1 Centrifugal Pump Head-Flow Curve & Affinity Laws
At rated speed ($s = 1.0$), the total dynamic head $H$ (in meters of fluid) as a function of volumetric flow rate $Q$ (in L/h) is represented by a quadratic polynomial:
$$H(Q) = a + b Q + c Q^2$$

The coefficients $a$, $b$, and $c$ are analytically fitted by solving the $3 \times 3$ linear Vandermonde system for three operating points specified in the pump datasheet or configuration:
1. **Shut-off Head:** $(Q_0 = 0\text{ L/h}, H_0)$
2. **Rated Duty Point:** $(Q_1 = Q_{\text{rated}}, H_1 = H_{\text{rated}})$
3. **Maximum Flow Point:** $(Q_2 = Q_{\text{max}}, H_2 = H_{\text{max}})$

$$\begin{bmatrix} 1 & Q_0 & Q_0^2 \\ 1 & Q_1 & Q_1^2 \\ 1 & Q_2 & Q_2^2 \end{bmatrix} \begin{bmatrix} a \\ b \\ c \end{bmatrix} = \begin{bmatrix} H_0 \\ H_1 \\ H_2 \end{bmatrix}$$

For variable rotational speed ratio $s = \omega / \omega_{\text{rated}} \in [0, 1]$, the Affinity Laws scale head and flow quadratically:
$$H(Q, s) = a s^2 + b s Q + c Q^2$$

At shut-off ($Q = 0$):
$$H(0, s) = a s^2 = H_0 \cdot s^2$$
*(e.g., at 50% speed, shut-off head is $25\%$ of rated shut-off).*

---

### 2.2 Reusable Hydraulic Pipeline Elements

#### 2.2.1 Darcy-Weisbach Friction with Swamee-Jain
Frictional head loss along a pipe of internal diameter $D$ and length $L$ with flow velocity $v$ is:
$$\Delta h_{\text{friction}} = f \cdot \frac{L}{D} \cdot \frac{v^2}{2g}$$

Fluid velocity is calculated from volumetric flow $Q$:
$$v = \frac{Q / 3600000}{\pi D^2 / 4}$$

The Reynolds number is:
$$Re = \frac{\rho v D}{\mu}$$

- **Laminar Flow ($Re < 2300$):** Hagen-Poiseuille friction factor:
  $$f = \frac{64}{Re}$$
- **Turbulent Flow ($Re \ge 2300$):** Swamee-Jain explicit approximation to the Colebrook-White equation for pipe roughness $\epsilon = 0.0015\text{ mm}$:
  $$f = \frac{0.25}{\left[ \log_{10}\left( \frac{\epsilon / D}{3.7} + \frac{5.74}{Re^{0.9}} \right) \right]^2}$$

#### 2.2.2 Minor Losses (Fittings $K$-factors)
Localized resistance from elbows, tees, reducers, and strainers:
$$\Delta P_{\text{fittings}} = K_{\text{fittings}} \cdot \frac{\rho v^2}{2} \cdot 10^{-5}\text{ [bar]}$$

#### 2.2.3 Valve Flow Resistance ($K_v$ Characteristic)
Differential pressure across a control or on/off valve is governed by the standard IEC 60534 valve sizing equation:
$$\Delta P_{\text{valve}}\text{ [bar]} = SG \cdot \left( \frac{Q\text{ [m}^3\text{/h]}}{K_v \cdot f(x)} \right)^2$$
where $SG = \rho / \rho_{\text{water}} = \rho / 1000$, and $x \in [0, 1]$ is the fractional valve opening. For linear on/off valves, $f(x) = x$. When $x \le 0.02$, the valve is mechanically closed and completely blocks flow.

#### 2.2.4 Static Elevation Head
$$\Delta P_{\text{static}} = \frac{\rho \cdot g \cdot \Delta z}{100000}\text{ [bar]}$$
where $\Delta z = z_{\text{outlet}} - z_{\text{inlet}}$. $\Delta P_{\text{static}}$ is positive when lifting liquid against gravity, and negative when hydrostatic elevation assists forward flow.

---

### 2.3 Series Operating Point Solver (Bisection)

The equilibrium flow rate $Q^*$ satisfies:
$$\Delta P_{\text{pump}}(Q^*) - \sum_{k} \Delta P_{\text{element}, k}(Q^*) = 0$$

TwinForge Studio solves this nonlinear algebraic balance using unconditional **Bisection** (no Newton-Raphson or numerical Jacobian instabilities):
- Bracket interval: $[0, 1.5 \cdot Q_{\text{max}}]$
- Convergence criterion: $|Q_{\text{high}} - Q_{\text{low}}| \le 1.0\text{ L/h}$
- If $\Delta P_{\text{pump}}(0) < \sum \Delta P_{\text{element}, k}(0)$ (e.g. static head exceeds pump shut-off head), the solver returns $Q = 0$ with `noForwardFlow = true`.

Node pressures $P_i$ between successive elements are computed by sequential subtraction of forward pressure drops from the suction reservoir boundary pressure:
$$P_i = P_{i-1} - \Delta P_i$$

---

### 2.4 Motor Electromechanical Dynamics & Run Feedback

1. **Start Command (`P_RAW_START`):**
   - Direct-On-Line (DOL) soft-start acceleration:
     $$\frac{ds}{dt} = \frac{1}{\tau_{\text{ramp}}}$$
     *(Placeholder $\tau_{\text{ramp}} = 2.0\text{ s}$)*
   - Run Feedback confirmation (`P_RAW_RUN_FB`): transitions to `true` $0.5\text{ s}$ after `startCmd = true`, provided the motor is not tripped.
2. **Stop Command (`P_RAW_START = false`):**
   - Run Feedback immediately drops to `false`.
   - Motor uncouples and freely coasts down under impeller and fluid inertia:
     $$\frac{ds}{dt} = -\frac{s}{\tau_{\text{coast}}}$$
     $$s(t) = s_0 \cdot \exp\left(-\frac{t}{\tau_{\text{coast}}}\right)$$
     *(Placeholder $\tau_{\text{coast}} = 3.0\text{ s}$)*
3. **Variable Frequency Drive (VFD) Mode:**
   - When `config.hasVfd = true`, the motor ramps toward `P_RAW_SPEED_SP` ($0 - 100\%$). For fixed-speed pumps (`hasVfd = false`), target speed is $100\%$.

---

### 2.5 Power, Efficiency, and Electrical Current

1. **Hydraulic Power ($P_{\text{hyd}}$):**
   $$P_{\text{hyd}}\text{ [kW]} = \frac{\rho \cdot g \cdot (Q / 3600000) \cdot H}{1000}$$
2. **Pump Efficiency Curve ($\eta(Q)$):**
   Modeled as a parabolic curve peaking at rated flow:
   $$\eta(Q) = \eta_{\text{peak}} \cdot \left[ 1 - \left( \frac{Q - Q_{\text{rated}}}{Q_{\text{rated}}} \right)^2 \right]$$
   *(Guarded by a physical minimum $\eta \ge 0.15$)*
3. **Shaft Power ($P_{\text{shaft}}$):**
   $$P_{\text{shaft}} = \max\left( \frac{P_{\text{hyd}}}{\eta(Q)}, 0.10 \cdot P_{\text{rated}} \cdot s^2 \right)$$
   *(Includes mechanical bearing, seal, and impeller windage idle spinning losses)*
4. **Motor Current ($I$):**
   $$I\text{ [A]} \approx I_{\text{rated}} \cdot \frac{P_{\text{shaft}}}{P_{\text{rated}} \cdot \eta_{\text{motor}}}$$
   Published to PLC input `P_RAW_CURRENT`.

---

### 2.6 Thermal $I^2t$ Overload Protection

The motor thermal overload relay accumulates heat dissipation proportional to active current above rated:
$$\frac{d\Theta}{dt} = \max\left( 0, \left(\frac{I}{I_{\text{rated}}}\right)^2 - 1 \right)$$

- **Trip Limit:** Equivalent to $30\text{ s}$ sustained at $120\%$ rated current:
  $$\Theta_{\text{trip}} = (1.20^2 - 1) \cdot 30 = 0.44 \cdot 30 = 13.2$$
- **Trip Action:** When $\Theta \ge 13.2$, the motor trips immediately:
  - `tripped = true`
  - `P_RAW_FAULT = true`
  - `P_RAW_RUN_FB = false`
  - Motor coasts down ($s \to 0$)
- **Reset Interlock:** Cannot reset while `P_RAW_START` is active. Thermal accumulation clears only after the start command is removed by the PLC operator.

---

### 2.7 Cavitation & Net Positive Suction Head ($NPSH$)

Available NPSH at pump suction centerline:
$$NPSHa = \frac{P_{\text{suction,abs}} - P_{\text{vapour}}(T)}{\rho \cdot g} + \frac{v_{\text{suction}}^2}{2g}$$

Water/milk vapour pressure $P_{\text{vapour}}(T)$ follows the Magnus-Tetens correlation:
$$P_{\text{vapour}}(T)\text{ [Pa]} = 611.2 \cdot \exp\left( \frac{17.67 \cdot T}{T + 243.5} \right)$$
*(At $4^\circ\text{C}$, $P_{\text{vapour}} \approx 813\text{ Pa} \approx 0.008\text{ bar abs}$)*

Required NPSH scales with flow rate:
$$NPSHr(Q) = NPSHr_{\text{rated}} \cdot \left( \frac{Q}{Q_{\text{rated}}} \right)^2$$

When $NPSHa < NPSHr$:
1. Effective pump head degrades due to vapour bubble formation:
   $$H_{\text{eff}} = H \cdot \max\left( 0, 1 - 1.5 \cdot \frac{NPSHr - NPSHa}{NPSHr} \right)$$
2. High-priority SCADA alarm `P_RAW_CAVITATION` is asserted.

---

### 2.8 Deadheading, Gravity & Reverse Flow Dynamics

1. **Deadheading:** If the pump runs ($s > 0.2$) while downstream isolation valve `PV-1` is closed ($Q < 20\text{ L/h}$), fluid recirculates within the volute. Discharge pressure equals shut-off head ($P_{\text{suction}} + \rho g H_0$). After a $10\text{ s}$ continuous deadhead delay, alarm `P_RAW_DEADHEAD` is asserted.
2. **Gravity & Reverse Flow:** When the pump is stopped ($s = 0$) and `PV-1` is passable:
   - The stationary impeller presents an equivalent hydraulic fitting resistance of $K_{\text{stopped}} = 20$.
   - The circuit solves gravity-driven flow from net elevation difference $\Delta z = z_{\text{silo}} - z_{\text{tank}}$.
   - If balance tank liquid head exceeds silo head ($z_{\text{tank}} > z_{\text{silo}}$), fluid flows backwards ($Q < 0$), raising alarm `RAW_REVERSE_FLOW`.
3. **Dry Running:** If the raw milk silo is empty or unavailable (`raw_supply_empty`), pump head drops to zero, flow stops, and alarm `P_RAW_DRY_RUN` is asserted.

---

### 2.9 Injectable Faults

The circuit and pump models support active fault simulation:
| Fault Mode | Target Device | Parameter | Operational Impact |
|:---|:---|:---|:---|
| `pump_trip` | `P-RAW` | — | Immediate electrical trip; speed coasts down, `P_RAW_FAULT = true`. |
| `impeller_wear` | `P-RAW` | % Head Loss | Direct reduction in delivered pump head $H \to H \cdot (1 - \text{loss}\% / 100)$. |
| `suction_blockage` | `P-RAW` | Added $K$ | Extra resistance factor added to suction pipe ($K_{\text{suction}} = 3.0 + K_{\text{extra}}$). |
| `motor_overload` | `P-RAW` | Multiplier | Current scaled by multiplier $\mu > 1.0$, accelerating $I^2t$ thermal trip. |
| `run_feedback_fail` | `P-RAW` | — | Motor runs mechanically, but `P_RAW_RUN_FB` remains `false`. |
| `raw_supply_empty` | Skid / Silo | — | Sets silo availability to false; dry running, flow drops to 0, raises `P_RAW_DRY_RUN`. |

---

## 3. Parameter Catalog & Provenance

All parameters carry an explicit provenance source. Current placeholder values:

| Parameter | Identifier | Value | Unit | Source | Description |
|:---|:---|:---|:---|:---|:---|
| Rated Speed | `ratedSpeedRpm` | 2900 | RPM | placeholder | 2-pole asynchronous motor synchronous speed |
| Shut-off Head | `shutoffHeadM` | 32.0 | m | placeholder | Zero-flow shut-off head at rated speed |
| Rated Head | `ratedHeadM` | 24.0 | m | placeholder | Duty head at nominal operating point |
| Rated Flow | `ratedFlowLph` | 12000 | L/h | placeholder | Nominal design flow rate (200 L/min) |
| Max Flow | `maxFlowLph` | 16000 | L/h | placeholder | Runout capacity at 12 m head |
| Rated Power | `ratedPowerKw` | 2.2 | kW | placeholder | Nameplate shaft power (3.0 HP) |
| Rated Current | `ratedCurrentA` | 4.8 | A | placeholder | Full load electrical current at 400V 3-phase |
| Motor Efficiency | `motorEfficiency`| 0.85 | — | placeholder | IE3 premium efficiency class |
| Soft-Start Ramp | `rampUpTimeS` | 2.0 | s | placeholder | Soft-start acceleration from 0 to 100% |
| Coast-down Tau | `coastDownTauS` | 3.0 | s | placeholder | Free coasting time constant on stop |
| Peak Efficiency | `efficiencyPct` | 60.0 | % | placeholder | Hydraulic efficiency at rated flow |
| Rated NPSHr | `npshrRatedM` | 2.5 | m | placeholder | Required suction head at 12,000 L/h |
| Deadhead Timeout| `deadheadTimeoutS`| 10.0 | s | placeholder | Delay before raising P_RAW_DEADHEAD |
| Suction Pipe | `PIPE-SUCTION` | Ø48mm, 5m, K=3 | — | placeholder | Chilled raw milk suction line from silo |
| Discharge Pipe | `PIPE-DISCHARGE`| Ø48mm, 15m, K=6| — | placeholder | Delivery line to skid balance tank inlet |
| PV-1 Valve | `PV-1` | $K_v = 60$ | m³/h | placeholder | Sanitary pneumatic feed shut-off valve |
| Silo Elevation | `siloLevelM` | 3.0 | m | placeholder | Initial milk liquid level above pump center |
| Tank Inlet Elev | `balanceTankInlet`| 2.0 | m | placeholder | Balance tank top inlet elevation above center |
