# Dynamic Plate Heat Exchanger (PHE) & Holding Tube Physical Model
**TwinForge Studio — Process Simulation Core**

## 1. Overview
This module provides a first-principles dynamic numerical model of a multi-section sanitary plate heat exchanger (PHE) coupled with a transport-delay holding tube for HTST (High Temperature Short Time) dairy pasteurization (10,000 L/h nominal capacity).

The model replaces low-fidelity static/lumped placeholders with a rigorous finite-volume discretized solver that accurately computes:
- Dynamic spatial temperature profiles along counterflow plate channels
- Conjugate heat transfer with plate-wall thermal mass capacitance
- Variable convection coefficients as a function of mass flow rate ($h \propto \dot{m}^{0.7}$)
- Operational fouling resistance kinetics ($R_f$) accelerated by high wall temperatures
- Plug-flow transport delay in the holding tube with dynamic residence time tracking
- Hydraulic pressure gradients and differential pressure contamination barrier interlocks
- Cross-stream plate leakage fault dynamics

---

## 2. Mathematical Equations & Modeling Physics

### 2.1 Spatial Discretization (Counterflow $N$-Cell Finite Volume)
Each section is spatially subdivided into $N$ equal control volumes ($i = 0, \dots, N-1$).
- **Cold stream** flows forward: Cell $0$ (inlet) $\rightarrow$ Cell $N-1$ (outlet).
- **Hot stream** flows in counterflow: Cell $N-1$ (inlet) $\rightarrow$ Cell $0$ (outlet).

For cell $i$, the transient energy conservation equations are:

#### Cold Fluid Node ($T_{c,i}$):
$$\rho_c V_{\text{cell},c} c_{p,c} \frac{dT_{c,i}}{dt} = \dot{m}_c c_{p,c} \left(T_{c,i-1} - T_{c,i}\right) + h_{c,i} A_{\text{cell}} \left(T_{w,i} - T_{c,i}\right)$$
*(For cell 0, $T_{c,i-1} = T_{c,\text{in}}$)*

#### Hot Fluid Node ($T_{h,i}$):
$$\rho_h V_{\text{cell},h} c_{p,h} \frac{dT_{h,i}}{dt} = \dot{m}_h c_{p,h} \left(T_{h,i+1} - T_{h,i}\right) - h_{h,i} A_{\text{cell}} \left(T_{h,i} - T_{w,i}\right)$$
*(For cell $N-1$, $T_{h,i+1} = T_{h,\text{in}}$)*

#### Plate-Wall Intermediate Node ($T_{w,i}$):
$$C_{w,\text{cell}} \frac{dT_{w,i}}{dt} = h_{h,i} A_{\text{cell}} \left(T_{h,i} - T_{w,i}\right) - h_{c,i} A_{\text{cell}} \left(T_{w,i} - T_{c,i}\right)$$
where $C_{w,\text{cell}} = \rho_{\text{ss}} c_{p,\text{ss}} t_{\text{plate}} A_{\text{cell}}$.

When the wall node is bypassed (`enableWallNode = false`), direct hot-to-cold coupling applies:
$$\dot{Q}_i = U_i A_{\text{cell}} \left(T_{h,i} - T_{c,i}\right)$$

---

### 2.2 Heat Transfer Coefficients & Thermal Resistance
The overall heat transfer coefficient $U$ is calculated from the thermal resistance network:
$$\frac{1}{U} = \frac{1}{h_{\text{hot}}} + \frac{1}{h_{\text{cold}}} + \frac{t_{\text{plate}}}{k_{\text{plate}}} + R_{\text{fouling}}$$

Convective film coefficients scale dynamically with fluid velocity according to corrugated turbulent channel correlations:
$$h = h_{\text{nom}} \cdot \left(\frac{\dot{m}}{\dot{m}_{\text{nom}}}\right)^{0.7} \cdot f_{\text{corrugation}}$$

A stationary natural convection/conduction floor ($h_{\text{min}} \approx 350\text{ W/m}^2\text{K}$) prevents artificial thermal isolation during pump shutdowns.

---

### 2.3 Fouling Kinetics & CIP Cleanliness
Fouling resistance $R_{\text{fouling}}$ accumulates dynamically over operating time, accelerated exponentially by elevated plate wall temperatures (predominantly in the HEATING section where whey protein denaturation occurs at $T > 75^\circ\text{C}$):
$$\frac{dR_{\text{fouling}}}{dt} = k_{\text{foul,base}} \cdot \exp\left(\frac{T_{\text{wall,avg}} - 65}{15}\right) \cdot \mu_{\text{fault}}$$

- **CIP Event:** Resets $R_{\text{fouling}} = 0\text{ m}^2\text{K/W}$.
- **Fault Injection:** A multiplier $\mu_{\text{fault}} \in [1, 20]$ can be injected from the Fault Deck.

---

### 2.4 Hydraulic Pressure Drops & Booster Barrier
Pressure loss per section follows Darcy-Forchheimer channel flow:
$$\Delta P = k_{\text{drop}} \cdot \left(\frac{\dot{m}}{\dot{m}_{\text{nom}}}\right)^{1.7} \cdot \left(1 + 10^4 \cdot R_{\text{fouling}}\right)$$

Absolute pressures across the plant are governed by pump heads:
- $PT1$: Balance Tank head ($0.25\text{ bar}$)
- $PT2$: Feed Pump discharge ($2.5 - 2.8\text{ bar}$)
- $PT4$: Booster Pump discharge ($4.0 - 4.3\text{ bar}$)

#### Sanitary Pressure Differential Interlock:
To prevent raw milk contamination into pasteurized streams:
$$\Delta P_{\text{barrier}} = PT4 - PT2 \ge 0.5\text{ bar}$$
- If a plate pinhole leak occurs and $PT4 > PT2$: Pasteurized clean milk leaks into raw milk $\rightarrow$ **Safe Fault (LEAK_SAFE)**.
- If $PT2 \ge PT4$: Raw unpasteurized milk infiltrates pasteurized milk $\rightarrow$ **Contamination Hazard (CONTAMINATED_LEAK)**, tripping high-priority SCADA alarms.

---

### 2.5 Holding Tube Plug-Flow Transport Delay
The sanitary holding coil is modeled as a plug-flow delay line buffer ($V_{\text{tube}} = 55.55\text{ L}$):
$$\tau_{\text{residence}} = \frac{V_{\text{tube}}}{\dot{V}} = \frac{55.55\text{ L}}{10,000\text{ L/h} / 3600\text{ s/h}} = 20.0\text{ s}$$

A discrete ring buffer stores thermal packets:
$$T_{\text{holding,out}}(t) = T_{\text{heater,out}}(t - \tau_{\text{residence}})$$

If flow increases such that $\tau_{\text{residence}} < 16.0\text{ s}$ (configurable legal minimum), a legal safety interlock warning is raised.

---

### 2.6 Numerical Stability & Adaptive Sub-stepping
Explicit Euler convection is Courant-Friedrichs-Lewy (CFL) bounded by the cell residence time:
$$\Delta t_{\text{crit}} = \min\left(\frac{V_{\text{cell}}}{\dot{V}}\right)$$

TwinForge Studio's integrator dynamically computes the maximum stable sub-step:
$$\Delta t_{\text{sub}} \le 0.4 \cdot \Delta t_{\text{crit}}$$
$$N_{\text{sub}} = \left\lceil \frac{\Delta t_{\text{step}}}{\Delta t_{\text{sub}}} \right\rceil$$

This guarantees unconditional numerical stability and zero divergence across $1\times, 2\times, 5\times,$ and $10\times$ simulation speeds. Zero-flow division is strictly guarded with safe equilibration.

---

## 3. Engineering Units & Physical Constants

| Property | Symbol | Value | Units |
| :--- | :--- | :--- | :--- |
| Milk Specific Heat | $c_{p,\text{milk}}$ | 3930 | $\text{J}/(\text{kg}\cdot\text{K})$ |
| Milk Density | $\rho_{\text{milk}}$ | 1030 | $\text{kg}/\text{m}^3$ |
| Water Specific Heat | $c_{p,\text{water}}$ | 4184 | $\text{J}/(\text{kg}\cdot\text{K})$ |
| Water Density | $\rho_{\text{water}}$ | 1000 | $\text{kg}/\text{m}^3$ |
| Plate Material | SS 316L | $k=16.3$ | $\text{W}/(\text{m}\cdot\text{K})$ |
| Plate Thickness | $t_{\text{plate}}$ | 0.6 | $\text{mm}$ |
| Channel Gap | $d_{\text{gap}}$ | 2.8 | $\text{mm}$ |
| Holding Tube Volume | $V_{\text{tube}}$ | 55.55 | $\text{L}$ |
| Min Legal Holding Time | $\tau_{\text{legal}}$ | 16.0 | $\text{s}$ |

---

## 4. How to Configure & Add New Sections

Section geometries and operational parameters are fully configurable in `config.ts`:

```typescript
import { PHEConfig } from './config';

// Example: Modifying plate count or corrugation factor for REG-01
PHEConfig.sections['REG-01'].plateCount = 68;
PHEConfig.sections['REG-01'].corrugationFactor = 1.25;

// Example: Tuning holding tube volume
PHEConfig.holdingTubeVolumeL = 60.0;
PHEConfig.minHoldingTimeS = 18.0;
```

To instantiate a custom section or heat exchanger in pure TypeScript:
```typescript
import { PlateSectionModel } from './PlateSectionModel';
import { PHEConfig } from './config';

const mySection = new PlateSectionModel('MY-SECTION', PHEConfig.sections['HEATING'], {
  numCells: 12,
  enableWallNode: true,
});

mySection.step(
  dtSeconds,
  mDotColdKgS,
  tempColdInC,
  mDotHotKgS,
  tempHotInC
);

console.log(mySection.getMetrics());
```
