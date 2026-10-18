# Phase 2 Engineering Notes & Specification Tracking
## AquaSage 3D IoT Digital Twin Simulator

**Document Version:** 1.0.0  
**Phase:** 2 — Project Setup and Initial 3D Infrastructure  
**Author:** Senior Systems Architect & 3D Visualization Engineer  
**Date:** October 2026  

---

## 1. Overview & Phase Scope

Phase 2 establishes the web application framework (Next.js 15, React 19, TypeScript, Tailwind CSS) and constructs the first interactive, explorable 3D physical representation of the AquaSage water infrastructure using Three.js, `@react-three/fiber`, and `@react-three/drei`.

In strict adherence to Phase 2 boundaries:
- **Included:** 3D structural frame, acrylic water storage tank, usable water volume geometry, suction and discharge piping, analytical bypass loop, centrifugal pump and motor assembly, isolation valves V1 and V2, sensor placeholders (ultrasonic, flow, P1, P2, TDS, turbidity), and the ESP32 enclosure.
- **Excluded (Deferred to Phase 3+):** Telemetry generation engines, WebSocket/MQTT streaming, hydraulic simulation math, interactive component inspection drawers, threshold alerts, and scenario fault injectors.

---

## 2. 3D Coordinate System & Physical Scale Definition

To ensure precision and repeatability between physical hardware and the 3D digital twin:

$$\mathbf{1.0\text{ Three.js World Unit} = 1.0\text{ Physical Metre (1:1 Metric Scale)}}$$

### Physical Asset Dimension Mapping

| System Asset | Physical Dimensions | Three.js World Units $(X, Y, Z)$ | Placement & Coordinate Offsets |
| :--- | :--- | :--- | :--- |
| **Structural Skid Frame** | $1.8\text{m} \times 1.6\text{m} \times 0.8\text{m}$ | Width: $1.8$, Height: $1.6$, Depth: $0.8$ | Centered horizontally: $X \in [-0.9, 0.9]$, $Z \in [-0.4, 0.4]$, Floor at $Y = 0.0$ |
| **Water Storage Tank** | Cylinder $\varnothing 0.5642\text{m} \times 1.20\text{m}$ | Diameter: $0.5642$ ($R = 0.2821$), Height: $1.20$ | Mounted on base rails at $Y = 0.35$. Top rim at $Y = 1.55$. Position: $[-0.45, 0.95, 0.0]$ |
| **Water Volume (Baseline)** | Cylinder $\varnothing 0.556\text{m} \times 0.75\text{m}$ | Height: $0.75$ (75% fill = 187.5 L) | Base at $Y = 0.35$, Top liquid surface at $Y = 1.10$. Position: $[-0.45, 0.725, 0.0]$ |
| **Ultrasonic Sensor Collar** | Mount standoff at $H = 1.25\text{m}$ | Height: $0.06$, Radius: $0.04$ | Mounted above tank top opening at $Y = 1.60$, downward beam toward liquid surface |
| **Centrifugal Pump & Motor** | Footprint $\approx 0.45\text{m} \times 0.25\text{m} \times 0.28\text{m}$ | Suction inlet at $Y = 0.25$, Discharge at $Y = 0.42$ | Mounted on lower skid deck: $[0.15, 0.25, 0.0]$ |
| **Primary Piping (Main)** | 2-inch nominal pipe ($\varnothing 0.05\text{m}$) | Pipe Outer Diameter: $0.05$ | Suction at $Y = 0.25$, Midstream manifold at $Y = 0.65$, Return at $Y = 1.45$ |
| **Analytical Bypass Loop** | 1-inch nominal pipe ($\varnothing 0.03\text{m}$) | Pipe Outer Diameter: $0.03$ | Taps off manifold down to $Y = 0.45$, houses TDS & Turbidity sampling chamber |
| **ESP32 Enclosure** | IP65 Box $0.22\text{m} \times 0.28\text{m} \times 0.12\text{m}$ | Dimensions: $[0.22, 0.28, 0.12]$ | Mounted on front upright frame member: $[0.82, 0.95, 0.38]$ |

---

## 3. Tracking of Outstanding Phase 1 Specification Issues

The following four technical items were identified during Phase 1 specification analysis and are logged here for explicit tracking. In accordance with architectural boundaries, they remain tracked and are not altered silently:

### Item 1: Flow Sensor Operating Range vs. Critical Threshold Above 32 L/min
- **Issue Description:** The YF-S201 Hall-effect flow sensor datasheet specifies a linear measuring envelope of $1.0 - 30.0\text{ L/min}$ (frequency output $F = 7.5 \cdot Q$). In Phase 1's initial fault scenario table, a critical threshold was set at $> 32.0\text{ L/min}$, and pipe rupture was illustrated at $27.5\text{ L/min}$.
- **Technical Ambiguity:** When flow exceeds $30.0\text{ L/min}$, physical YF-S201 rotor slippage causes non-linear pulse degradation. A reading $> 32.0\text{ L/min}$ represents an out-of-rating condition rather than a calibrated measurement.
- **Resolution Strategy for Phase 3:** In the Phase 3 simulation engine, the high flow warning will trigger at $> 25.0\text{ L/min}$, critical pipe rupture scenario will generate $28.5\text{ L/min}$, and readings exceeding $32.0\text{ L/min}$ will be flagged with `hardwareStatus: 'out_of_range'` alongside the critical hydraulic alarm.

### Item 2: Inconsistent Warning/Critical Severity for Elevated TDS and Turbidity Scenarios
- **Issue Description:** Initial documentation alternated between treating high TDS ($>800\text{ ppm}$) and high turbidity ($>25\text{ NTU}$) as "Critical Contamination" (implying immediate hazard) versus "Warning / Advisory" (indicating aesthetic/mineral variation).
- **Scientific Rationale:** Total Dissolved Solids is an electrochemical measurement of conductivity, not toxicity; water with high mineral hardness (calcium/magnesium salts) can safely exceed $800\text{ ppm}$. Similarly, turbidity measures optical scattering, which can be caused by trapped microbubbles or benign silt.
- **Resolution Strategy for Phase 3:** Water quality anomalies will be systematically classified as **Observation Advisories (Warning)** rather than definitive critical toxicity alarms. The UI will prompt the operator to conduct secondary physical/chemical assays before diagnosing safety.

### Item 3: Missing Litre Unit ('L') in Proposed TypeScript Union
- **Issue Description:** The initial TypeScript `SensorReading` unit union was defined as:
  ```typescript
  unit: 'L/min' | 'cm' | 'bar' | 'ppm' | 'NTU' | 'A' | 'RPM';
  ```
  This omitted the volumetric unit `'L'` (or `'Litres'`) required for derived reservoir capacity and percentage volume reporting.
- **Resolution Strategy for Phase 3:** The unit type definition in the telemetry schema has been updated to:
  ```typescript
  unit: 'L/min' | 'cm' | 'bar' | 'ppm' | 'NTU' | 'A' | 'RPM' | '%' | 'L';
  ```

### Item 4: Distinction Between Simulated Telemetry and Physical Sensor Connection Health
- **Issue Description:** The original schema placed `'simulated'` within the same union as `'warning'` and `'critical'` in `MeasurementValidity`. This prevented synthetic telemetry from expressing an active alarm state during demonstration scenarios.
- **Resolution Strategy for Phase 3:** Full decoupling of dimensions into orthogonal attributes:
  1. `source`: `'simulated' | 'physical'`
  2. `alarmStatus`: `'nominal' | 'warning' | 'critical' | 'indeterminate'`
  3. `hardwareStatus`: `'operational' | 'out_of_range' | 'disconnected' | 'uncalibrated' | 'virtual'`
  4. `freshness`: `{ freshnessState: 'fresh' | 'stale' | 'expired', ageMs: number }`

---

## 4. Hardware Readiness Classification

To avoid conflating physical prototypes with software-modeled digital-twin features:

1. **Confirmed Hardware (Targeted for physical ESP32 breadboard/skid in Phase 4):**
   - Microcontroller: ESP32-WROOM-32 DevKitC
   - Flow Sensor: YF-S201 Hall-Effect (Pulse counter GPIO 34)
   - Ultrasonic Level: JSN-SR04T Waterproof (Trig GPIO 18, Echo GPIO 19 with 3.3V divider)
   - TDS Probe: Analog Electrolytic Probe (ADC1 GPIO 33)
   - Turbidity Sensor: TS-300B Optical Module (ADC1 GPIO 36)

2. **Planned Hardware (Virtual Placeholders in 3D scene; subject to signal conditioning):**
   - Upstream Pressure Transducer P1: 0-1.0 MPa (0-10 bar) piezoresistive sensor
   - Downstream Pressure Transducer P2: 0-1.0 MPa piezoresistive sensor
   - Isolation Valves V1 & V2: Manual quarter-turn ball valves / motorized valve placeholders

3. **Virtual-Only (Rendered in 3D digital twin without planned physical transducers):**
   - Centrifugal Pump Motor Current ($A$) & RPM: Computed dynamically from hydraulic head and flow
   - Pipe Network Stress Shading & Acoustic Vibration
