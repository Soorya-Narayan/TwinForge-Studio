# On/Off Automated Valve Model

The `OnOffValveModel` simulates automated pneumatic and solenoid process valves in TwinForge Studio. It models mechanical stroke ramping, fail-safe spring dynamics, limit switch detection (`ZSO`/`ZSC`), hydraulic seat leakage, and industrial fault modes.

---

## 1. Physical Architecture

### Fail-Safe Configurations
Valves are configured with either:
- **`closed` (Fail-Closed / Air-to-Open / Spring-to-Close):** In the absence of instrument air or solenoid electrical power, internal mechanical return springs drive the valve plug to $0\%$ position.
- **`open` (Fail-Open / Air-to-Close / Spring-to-Open):** Return springs drive the valve plug to $100\%$ position on loss of air or power.

### Travel Dynamics
Actuator stroke transit follows constant velocity motion parameterized by `travelTimeS`:
$$\frac{dx}{dt} = \frac{100}{\tau_{\text{travel}} \cdot \mu_{\text{delay}}}$$
where:
- $\tau_{\text{travel}}$ is rated travel time in seconds (e.g. 2.0 s).
- $\mu_{\text{delay}}$ is the travel time multiplier (default 1.0; $> 1.0$ under `travel_delay` fault).

---

## 2. Limit Switch Feedback (`ZSO` / `ZSC`)

Physical limit switches detect end-of-stroke mechanical positions:
- **`ZSO` (Zone Switch Open):**
  $$ZSO_{\text{physical}} = x \ge \theta_{ZSO} \quad (\text{default } \theta_{ZSO} = 95\%)$$
- **`ZSC` (Zone Switch Closed):**
  $$ZSC_{\text{physical}} = x \le \theta_{ZSC} \quad (\text{default } \theta_{ZSC} = 5\%)$$

> [!NOTE]
> During transit between thresholds ($5\% < x < 95\%$), neither limit switch is engaged ($ZSO = \text{false}$, $ZSC = \text{false}$).

Switch electrical failures (`zso_fail`, `zsc_fail`) override physical detection:
- `value = 0`: Switch contact stuck open (signal reads `false`).
- `value = 1`: Switch contact stuck closed (signal reads `true`).

---

## 3. Hydraulic Characteristic & Seat Leakage

The effective hydraulic flow coefficient $K_v$ accounts for both stroke position and seat leakage:
$$K_{v, \text{stroke}} = K_{v, \text{rated}} \cdot \left(\frac{x}{100}\right)$$
$$K_{v, \text{leak}} = K_{v, \text{rated}} \cdot \left(\frac{\%_{\text{leak}}}{100}\right)$$
$$K_{v, \text{effective}} = \max\left(K_{v, \text{stroke}}, K_{v, \text{leak}}\right)$$

where:
- $\%_{\text{leak}}$ defaults to $0.01\%$ of rated $K_v$ (placeholder).
- Under `seat_leak` fault, $\%_{\text{leak}}$ is overridden by the fault's assigned percentage value.

---

## 4. Fault Modes

| Fault Mode | Description | Effect |
| :--- | :--- | :--- |
| `stuck_open` | Mechanical stem seizure | Freezes position at $100\%$. |
| `stuck_closed` | Mechanical stem seizure / galling | Freezes position at $0\%$. |
| `travel_delay` | Exhaust orifice restriction / low air pressure | Multiplies travel time by `value` (e.g. $3\times$ slower). |
| `seat_leak` | Damaged elastomer seat / debris | Overrides closed seat leak percentage to `value` $\%$. |
| `zso_fail` | Proximity switch / reed contact failure | Forces ZSO output to `value` ($0 = \text{OFF}, 1 = \text{ON}$). |
| `zsc_fail` | Proximity switch / reed contact failure | Forces ZSC output to `value` ($0 = \text{OFF}, 1 = \text{ON}$). |
| `actuator_air_loss` | Local tubing disconnect or burst | Forces valve immediately to its configured fail position. |
