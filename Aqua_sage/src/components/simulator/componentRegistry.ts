import { TwinComponentDefinition } from '@/lib/simulator/types';

/**
 * Central Component Registry for the AquaSage 3D Digital Twin
 * Source of truth for component identity, hardware readiness, technical metadata, and camera focus targets.
 */
export const COMPONENT_REGISTRY: Record<string, TwinComponentDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────
  // WATER SYSTEM COMPONENTS
  // ─────────────────────────────────────────────────────────────────────────
  'tank': {
    id: 'tank',
    name: 'Water Storage Tank',
    shortName: 'Reservoir',
    category: 'tank',
    readiness: 'confirmed_hardware',
    description:
      'Cylindrical acrylic water storage reservoir with steel base and top reinforcement flanges. Features calibrated volume markings and supports hydraulic closed-loop recirculation.',
    position: [-0.45, 0.95, 0],
    camera: {
      position: [-0.45, 1.25, 1.55],
      target: [-0.45, 0.95, 0],
    },
    parameter: 'Reservoir Water Level & Volume',
    unit: 'L',
    demoValue: '187.5 L (75%)',
    demoRange: '0 – 250 Litres (0 – 1.00m)',
    installation: 'Elevated skid rails at Y = 0.35m',
    metadata: {
      'Shell Geometry': 'Ø 0.5642m × 1.20m Shell Height',
      'Cross-Sectional Area': '0.25 m² (2.50 L/cm liquid height)',
      'Usable Capacity': '250 Litres at 1.00m water height',
      'Baseline Fill Level': '0.75m (187.5 L / 75% capacity)',
      'Material': 'Industrial Optical Acrylic (8mm wall)',
      'Drain Connection': 'Bottom Center Flange Spigot (Ø 0.05m)',
    },
  },

  'pump': {
    id: 'pump',
    name: 'Centrifugal Water Pump',
    shortName: 'Centrifugal Pump',
    category: 'pump',
    readiness: 'confirmed_hardware',
    description:
      'Industrial centrifugal volute pump assembly driven by electric motor. Generates hydraulic head to circulate fluid from the reservoir through the discharge manifold and analytical sensor bays.',
    position: [0.05, 0.27, 0],
    camera: {
      position: [-0.05, 0.48, 0.85],
      target: [0.05, 0.27, 0],
    },
    parameter: 'Hydraulic Discharge Head',
    unit: 'bar',
    demoValue: '2.80 bar',
    demoRange: '0.0 – 6.0 bar',
    installation: 'Lower skid deck on vibration damping mounts at [0.15, 0.12, 0]',
    metadata: {
      'Pump Type': 'Single-Stage End-Suction Centrifugal',
      'Casing Material': 'Cast Iron ASTM A48 (Gray Powder-Coated)',
      'Suction Port': 'DN50 (2-inch nominal axial flange)',
      'Discharge Port': 'DN40 (1.5-inch vertical flange)',
      'Coupling': 'Flexible shaft coupling with safety shroud',
    },
  },

  'motor': {
    id: 'motor',
    name: 'Three-Phase Electric Motor',
    shortName: 'AC Motor',
    category: 'pump',
    readiness: 'virtual_only',
    description:
      'Totally enclosed fan-cooled (TEFC) industrial induction motor driving the centrifugal pump. Current draw and rotational speed are modeled in software for Phase 3.',
    position: [0.29, 0.27, 0],
    camera: {
      position: [0.35, 0.48, 0.85],
      target: [0.29, 0.27, 0],
    },
    parameter: 'Motor Current Draw & Speed',
    unit: 'A',
    demoValue: '4.2 A / 2850 RPM',
    demoRange: '0.0 – 8.0 A (Full load: 5.5 A)',
    installation: 'Direct-coupled to pump volute on lower skid deck',
    metadata: {
      'Enclosure Rating': 'IP55 TEFC Industrial Frame',
      'Nominal Speed': '2850 RPM at 50 Hz',
      'Power Rating': '0.75 kW (1.0 HP)',
      'Telemetry Classification': 'Virtual Inferred Parameter (Phase 3)',
    },
  },

  'valve-v1': {
    id: 'valve-v1',
    name: 'Suction Isolation Valve V1',
    shortName: 'Valve V1',
    category: 'valve',
    readiness: 'planned_hardware',
    description:
      'Quarter-turn flanged ball valve installed in the upstream suction line. Isolates the reservoir outlet from the centrifugal pump suction during maintenance or dry-run testing.',
    position: [-0.20, 0.25, 0],
    camera: {
      position: [-0.20, 0.45, 0.70],
      target: [-0.20, 0.25, 0],
    },
    parameter: 'Valve Mechanical Position',
    unit: '%',
    demoValue: '100% (Fully Open)',
    demoRange: '0% (Closed) – 100% (Open)',
    installation: 'Upstream suction line between tank spigot and pump inlet',
    metadata: {
      'Valve Body': '2-inch Full Bore Industrial Ball Valve',
      'Handle': 'Yellow Ergonomic Safety Lever (Parallel = Open)',
      'Actuation': 'Manual Placeholder (Planned for Motorized Actuator in Phase 4)',
      'Seal Type': 'PTFE Reinforced Stem Packing',
    },
  },

  'valve-v2': {
    id: 'valve-v2',
    name: 'Delivery Isolation Valve V2',
    shortName: 'Valve V2',
    category: 'valve',
    readiness: 'planned_hardware',
    description:
      'Quarter-turn downstream ball valve located after the sensor bay. Regulates delivery line resistance and enables simulated pipeline blockage or backpressure demonstration.',
    position: [0.89, 0.65, 0],
    camera: {
      position: [0.89, 0.85, 0.70],
      target: [0.89, 0.65, 0],
    },
    parameter: 'Delivery Flow Restriction',
    unit: '%',
    demoValue: '100% (Fully Open)',
    demoRange: '0% (Closed) – 100% (Open)',
    installation: 'Downstream manifold after pressure sensor PT-02',
    metadata: {
      'Valve Body': '2-inch Industrial Throttle / Ball Valve',
      'Handle': 'Red Industrial Handle (Safety / Fault Injection)',
      'Actuation': 'Manual Placeholder (Planned for Proportional Servo in Phase 4)',
      'Function': 'Delivery isolation and backpressure simulation',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SENSORS
  // ─────────────────────────────────────────────────────────────────────────
  'sensor-us01': {
    id: 'sensor-us01',
    name: 'Ultrasonic Level Sensor US-01',
    shortName: 'Level US-01',
    category: 'sensor',
    readiness: 'confirmed_hardware',
    description:
      'Non-contact waterproof ultrasonic transceiver mounted on the inspection collar at the top of the storage tank. Emits high-frequency acoustic pulses downward to continuously measure liquid surface distance.',
    position: [-0.45, 1.60, 0],
    camera: {
      position: [-0.45, 1.85, 0.90],
      target: [-0.45, 1.55, 0],
    },
    parameter: 'Liquid Surface Distance / Level',
    unit: 'cm',
    demoValue: '75.0 cm',
    demoRange: '25.0 – 450.0 cm (Transducer Deadband: <25cm)',
    installation: 'Tank top inspection collar standoff at Y = 1.60m',
    metadata: {
      'Target Sensor Model': 'JSN-SR04T Waterproof Ultrasonic Transceiver',
      'Operating Voltage': '5V DC (3.3V Echo divider to ESP32)',
      'GPIO Pinout': 'Trigger: GPIO 18, Echo: GPIO 19',
      'Measurement Formula': 'h_water = 125.0cm - d_measured',
      'Calculated Fill': '75.0 cm Water Column (187.5 Litres / 75%)',
    },
  },

  'sensor-fs01': {
    id: 'sensor-fs01',
    name: 'Primary In-Line Flow Sensor FS-01',
    shortName: 'Flow FS-01',
    category: 'sensor',
    readiness: 'confirmed_hardware',
    description:
      'In-line Hall-effect turbine flow sensor installed in the high-pressure discharge manifold. Internal rotor spins proportionally to volumetric water velocity, generating calibrated pulse trains for the ESP32.',
    position: [0.42, 0.65, 0],
    camera: {
      position: [0.42, 0.85, 0.70],
      target: [0.42, 0.65, 0],
    },
    parameter: 'Volumetric Flow Rate',
    unit: 'L/min',
    demoValue: '18.0 L/min',
    demoRange: '1.0 – 30.0 L/min (Configured Demo Operating Range)',
    installation: 'Pump discharge line between PT-01 and bypass split',
    metadata: {
      'Target Sensor Model': 'YF-S201 Hall-Effect Turbine Flow Meter',
      'Pulse Characteristic': 'F = 7.5 × Q (Hz per L/min)',
      'Operating Voltage': '5V DC (Open collector with 3.3V pull-up)',
      'GPIO Pinout': 'GPIO 34 (Hardware Pulse Counter / Interrupt)',
      'Accuracy Envelope': '±5% across 1.0 – 30.0 L/min rated envelope',
    },
  },

  'sensor-pt01': {
    id: 'sensor-pt01',
    name: 'Pump Discharge Pressure Sensor PT-01',
    shortName: 'Pressure PT-01',
    category: 'sensor',
    readiness: 'planned_hardware',
    description:
      'Piezoresistive pressure transducer mounted on a vertical T-joint at the pump discharge manifold. Measures head pressure generated by the centrifugal pump to detect overpressure or cavitation.',
    position: [0.25, 0.68, 0],
    camera: {
      position: [0.25, 0.88, 0.70],
      target: [0.25, 0.68, 0],
    },
    parameter: 'Pump Discharge Head Pressure',
    unit: 'bar',
    demoValue: '2.80 bar',
    demoRange: '0.00 – 10.00 bar (0 – 1.0 MPa)',
    installation: 'Discharge manifold riser T-junction at X = 0.25m',
    metadata: {
      'Transducer Type': '0–1.0 MPa Piezoresistive Ceramic Pressure Sensor',
      'Output Signal': '0.5V – 4.5V Linear Ratiometric Analog',
      'Hardware Status': 'Planned Hardware (Requires ADC Level-Shift Interface)',
      'Normal Envelope': '1.50 – 4.00 bar',
    },
  },

  'sensor-pt02': {
    id: 'sensor-pt02',
    name: 'Delivery Pressure Sensor PT-02',
    shortName: 'Pressure PT-02',
    category: 'sensor',
    readiness: 'planned_hardware',
    description:
      'Downstream pressure transducer measuring water pressure delivered to the recirculation return line. Paired with PT-01 to continuously compute hydraulic differential pressure (ΔP).',
    position: [0.81, 0.68, 0],
    camera: {
      position: [0.81, 0.88, 0.70],
      target: [0.81, 0.68, 0],
    },
    parameter: 'Delivery Line Pressure',
    unit: 'bar',
    demoValue: '2.40 bar',
    demoRange: '0.00 – 10.00 bar (0 – 1.0 MPa)',
    installation: 'Downstream line immediately before delivery valve V2',
    metadata: {
      'Transducer Type': '0–1.0 MPa Piezoresistive Ceramic Pressure Sensor',
      'Baseline Differential': 'ΔP (PT01 - PT02) = 0.40 bar (Nominal Friction Loss)',
      'Hardware Status': 'Planned Hardware (Requires ADC Level-Shift Interface)',
      'Blockage Threshold': 'ΔP > 2.00 bar indicates downstream obstruction',
    },
  },

  'sensor-tds01': {
    id: 'sensor-tds01',
    name: 'Water Quality TDS Sensor TDS-01',
    shortName: 'TDS Probe',
    category: 'sensor',
    readiness: 'confirmed_hardware',
    description:
      'Electrolytic conductivity sensor probe submerged in the analytical bypass cell. Measures electrical conductivity as an indicator of total dissolved ionic solids in the water circuit.',
    position: [0.59, 0.50, 0],
    camera: {
      position: [0.59, 0.70, 0.65],
      target: [0.59, 0.50, 0],
    },
    parameter: 'Total Dissolved Solids (Conductivity)',
    unit: 'ppm',
    demoValue: '180 ppm',
    demoRange: '0 – 1000 ppm (mg/L)',
    installation: 'Analytical water-quality bypass loop at Y = 0.48m',
    observationNote:
      'Elevated Dissolved Solids Observation: Indicates ionic concentration. Harmless mineral hardness (calcium/magnesium) or salinity. Non-conclusive of water potability alone.',
    metadata: {
      'Target Sensor Model': 'Analog Electrolytic TDS Probe Module',
      'Output Voltage': '0.0V – 2.3V Analog (Direct ESP32 3.3V ADC compatible)',
      'GPIO Pinout': 'GPIO 33 (ADC1 Channel 5)',
      'Advisory Threshold': '> 500 ppm (Aesthetic / Mineral Advisory)',
      'Observation Flag': '> 800 ppm (Secondary Contaminant Flag)',
    },
  },

  'sensor-turb01': {
    id: 'sensor-turb01',
    name: 'Water Clarity Turbidity Sensor TURB-01',
    shortName: 'Turbidity TS-01',
    category: 'sensor',
    readiness: 'confirmed_hardware',
    description:
      'Optical nephelometric turbidity sensor installed in the bypass sampling cell. Emits 850nm infrared light to measure scattering caused by suspended particles or micro-bubbles.',
    position: [0.69, 0.48, 0],
    camera: {
      position: [0.69, 0.68, 0.65],
      target: [0.69, 0.48, 0],
    },
    parameter: 'Optical Nephelometric Turbidity',
    unit: 'NTU',
    demoValue: '1.5 NTU',
    demoRange: '0.0 – 100.0 NTU',
    installation: 'Analytical water-quality bypass loop at Y = 0.48m',
    observationNote:
      'Elevated Optical Particulate Observation: Indicates suspended particulate scattering (silt, organic matter, or air micro-bubbles). Non-conclusive of microbiological hazard.',
    metadata: {
      'Target Sensor Model': 'TS-300B / Analog Optical Turbidity Module',
      'Optical Method': '90° Nephelometric Light Scattering (ISO 7027)',
      'Output Voltage': '0.0V – 4.5V (Requires Voltage Divider to 3.3V)',
      'GPIO Pinout': 'GPIO 36 (ADC1 Channel 0 / SENSOR_VP)',
      'Advisory Threshold': '> 5.0 NTU (Aesthetic Clarity Advisory)',
      'Observation Flag': '> 25.0 NTU (Sediment / Filter Backwash Flag)',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CONTROLLER
  // ─────────────────────────────────────────────────────────────────────────
  'controller-esp32': {
    id: 'controller-esp32',
    name: 'ESP32 Industrial Edge Gateway',
    shortName: 'ESP32 Gateway',
    category: 'controller',
    readiness: 'confirmed_hardware',
    description:
      'IP65-rated polycarbonate control enclosure housing an ESP32-WROOM-32 microcontroller, DIN rail, power conditioning, and terminal wiring breakout blocks for physical sensors.',
    position: [0.82, 0.95, 0.36],
    camera: {
      position: [0.82, 1.05, 0.88],
      target: [0.82, 0.95, 0.36],
    },
    parameter: 'Telemetry Ingestion & Gateway Health',
    unit: '%',
    demoValue: 'Online (50 Hz Loop)',
    demoRange: '1 – 100 Hz Loop Frequency',
    installation: 'Mounted on front-right structural frame column at [0.82, 0.95, 0.36]',
    metadata: {
      'Microcontroller': 'ESP32-WROOM-32 (Dual-Core 240 MHz Tensilica LX6)',
      'Wireless Connectivity': '2.4 GHz Wi-Fi 802.11 b/g/n & Bluetooth v4.2 BR/EDR',
      'Firmware Protocol': 'JSON Telemetry over MQTT / WebSockets (Future Phase 4)',
      'Enclosure Protection': 'IP65 Weatherproof Polycarbonate with Smoked Acrylic Lid',
      'Operating Mode': 'Read-Only Telemetry Listener (Zero Hardware Actuation in Phase 3)',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PIPELINE NETWORKS (OPTIONAL CLEAN EXTENSIONS)
  // ─────────────────────────────────────────────────────────────────────────
  'pipe-main': {
    id: 'pipe-main',
    name: 'Primary Hydraulic Distribution Line',
    shortName: 'Main Pipeline',
    category: 'pipeline',
    readiness: 'virtual_only',
    description:
      'Schedule 80 industrial pipeline system routing fluid from the tank base through the pump discharge manifold, sensor bay, and overhead return spigot back into the reservoir.',
    position: [0.40, 0.65, 0],
    camera: {
      position: [0.40, 0.95, 1.30],
      target: [0.40, 0.65, 0],
    },
    parameter: 'Hydraulic Circuit Integrity',
    unit: 'bar',
    demoValue: 'Nominal Flow',
    demoRange: '2-inch Nominal Pipe (DN50)',
    installation: 'Closed-loop circuit mounted on structural extrusion frame',
    metadata: {
      'Pipe Diameter': '2-inch nominal (Ø 0.05m outer diameter)',
      'Material': 'Industrial Stainless Steel 304 / Coated Schedule 80 PVC',
      'Routing': 'Suction (Y=0.25) -> Manifold (Y=0.65) -> Overhead Return (Y=1.45)',
      'Classification': 'Virtual-Only Asset (Digital Twin Mechanical Representation)',
    },
  },

  'pipe-bypass': {
    id: 'pipe-bypass',
    name: 'Analytical Water Quality Bypass Loop',
    shortName: 'Bypass Loop',
    category: 'pipeline',
    readiness: 'virtual_only',
    description:
      'Low-velocity sampling loop that taps off the primary discharge manifold to protect analytical electrochemical probes (TDS and Turbidity) from high-velocity erosion.',
    position: [0.65, 0.48, 0],
    camera: {
      position: [0.65, 0.70, 0.85],
      target: [0.65, 0.48, 0],
    },
    parameter: 'Sampling Cell Flow',
    unit: 'L/min',
    demoValue: 'Low Velocity',
    demoRange: '1-inch Nominal Tube (DN25)',
    installation: 'Taps off manifold at X = 0.52m down to Y = 0.48m, rejoins at X = 0.74m',
    metadata: {
      'Tube Diameter': '1-inch nominal (Ø 0.03m outer diameter)',
      'Material': 'Polished Analytical Grade Stainless 316L',
      'Function': 'Sensor protection & laminar analytical sampling chamber',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PIPELINE LEAK DEFECT BAY
  // ─────────────────────────────────────────────────────────────────────────
  'pipe-leak-bay': {
    id: 'pipe-leak-bay',
    name: 'Pipeline Leak Bay',
    shortName: 'Leak Bay',
    category: 'pipeline',
    readiness: 'confirmed_hardware',
    description:
      'Midstream pipeline segment between Flow Sensor 1 and Flow Sensor 2. Supports physical defect testing and differential mass balance leak calculation (Q_leak = Flow 1 - Flow 2).',
    position: [0.76, 0.65, 0],
    camera: {
      position: [0.75, 0.85, 0.95],
      target: [0.75, 0.65, 0],
    },
    parameter: 'Differential Flow Deficit',
    unit: 'L/min',
    demoValue: '0.0 L/min (Intact)',
    demoRange: '0.0 – 15.0 L/min',
    installation: 'Main hydraulic delivery run at [0.76, 0.65, 0]',
    metadata: {
      'Detection Principle': 'Differential Mass Balance (Flow 1 - Flow 2)',
      'Upstream Meter': 'Flow Sensor 1 (YF-S201)',
      'Downstream Meter': 'Flow Sensor 2 (YF-S201)',
      'Backend Detection': 'FastAPI algorithmic deficit validation',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUTOMATED VALVES (DISTRIBUTION & FILTRATION)
  // ─────────────────────────────────────────────────────────────────────────
  'valve-v-dist': {
    id: 'valve-v-dist',
    name: 'Village Network Isolation Valve V-DIST',
    shortName: 'Valve V-DIST',
    category: 'valve',
    readiness: 'virtual_only',
    description:
      'Main motorized isolation valve on the primary village distribution trunk line. Automatically shuts closed upon detection of contamination to isolate downstream community supplies.',
    position: [3.60, 0.65, 0],
    camera: {
      position: [3.60, 0.95, 0.85],
      target: [3.60, 0.65, 0],
    },
    parameter: 'Distribution Trunk Line Routing',
    unit: '%',
    demoValue: '100% (Open)',
    demoRange: '0% (Closed) – 100% (Open)',
    installation: 'Main 60mm distribution line entry before village manifold',
    metadata: {
      'Actuator Type': 'Modulating 24V DC Industrial Quarter-Turn Motor',
      'Stroke Time': '2.5 seconds emergency closure',
      'Fail-Safe Action': 'Fail-Closed on Contamination Breach',
      'Interlock': 'Interlocked with V-DIV diversion diverter',
    },
  },

  'valve-v-div': {
    id: 'valve-v-div',
    name: 'Automated Contamination Diversion Valve V-DIV',
    shortName: 'Valve V-DIV',
    category: 'valve',
    readiness: 'virtual_only',
    description:
      'High-speed automated 3-way diversion valve. Commands contaminated water away from the village trunk line and into the multi-stage filtration loop.',
    position: [1.35, 0.65, 0],
    camera: {
      position: [1.35, 0.95, 0.85],
      target: [1.35, 0.65, 0],
    },
    parameter: 'Diversion Valve State',
    unit: '%',
    demoValue: '0% (Closed - Standby)',
    demoRange: '0% (Standby) – 100% (Diverting)',
    installation: 'Primary trunk line junction at X = 1.35m',
    metadata: {
      'Valve Type': '3-Way Stainless Industrial Diverter Valve',
      'Response Time': '1.8 seconds fast-acting pneumatic / electric',
      'Control Source': 'ESP32 PLC automated state machine',
    },
  },

  'valve-v-rec': {
    id: 'valve-v-rec',
    name: 'Filtration Recirculation Valve V-REC',
    shortName: 'Valve V-REC',
    category: 'valve',
    readiness: 'virtual_only',
    description:
      'Automated loop return valve. Directs water failing post-treatment quality checks back to the treatment plant inlet for an additional filtration pass.',
    position: [2.85, 0.25, -1.60],
    camera: {
      position: [2.85, 0.60, -0.90],
      target: [2.85, 0.25, -1.60],
    },
    parameter: 'Recirculation Loop State',
    unit: '%',
    demoValue: '0% (Closed - Standby)',
    demoRange: '0% (Closed) – 100% (Open)',
    installation: 'Filtration return header at Z = -1.60m',
    metadata: {
      'Recirculation Limit': '3 treatment passes maximum',
      'Safety Lockout': 'Locks closed if pass limit exceeded without passing checks',
    },
  },

  'valve-v-rel': {
    id: 'valve-v-rel',
    name: 'Treated Water Release Valve V-REL',
    shortName: 'Valve V-REL',
    category: 'valve',
    readiness: 'virtual_only',
    description:
      'Certified treated-water release valve. Opens only when post-treatment TDS and turbidity measurements strictly satisfy configured release criteria.',
    position: [3.60, 0.65, -1.20],
    camera: {
      position: [3.60, 0.95, -0.50],
      target: [3.60, 0.65, -1.20],
    },
    parameter: 'Treated Release State',
    unit: '%',
    demoValue: '0% (Closed)',
    demoRange: '0% (Closed) – 100% (Open)',
    installation: 'Release manifold connecting filtration effluent back to village distribution',
    metadata: {
      'Release Criteria': 'TDS <= 500 ppm AND Turbidity <= 5.0 NTU',
      'Verification Timing': 'Valid and fresh measurements required',
      'Integrity Check': 'Downstream path must be confirmed open before release',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FILTRATION VESSELS & POST-TREATMENT SENSORS
  // ─────────────────────────────────────────────────────────────────────────
  'flt-stage1': {
    id: 'flt-stage1',
    name: 'Stage 1 Dual-Media Particulate Filter',
    shortName: 'Stage 1 Filter',
    category: 'filter',
    readiness: 'virtual_only',
    description:
      'Graded sand and anthracite dual-media pressure vessel. Captures suspended solids, silt, and colloidal particles to dramatically reduce turbidity (70% nominal efficiency per pass). Does not reduce dissolved solids (TDS).',
    position: [1.80, 0.70, -1.20],
    camera: {
      position: [1.80, 1.20, -0.40],
      target: [1.80, 0.70, -1.20],
    },
    parameter: 'Turbidity Filtration Loading',
    unit: 'NTU',
    demoValue: '70% Removal',
    demoRange: '0 – 50 NTU handling capacity',
    installation: 'Filtration bay vessel 1 at [1.80, 0.20, -1.20]',
    metadata: {
      'Media Type': 'Anthracite / Quartz Sand multi-layer bed',
      'Target Contaminant': 'Suspended particles and turbidity',
      'Pass Efficiency': '70% removal per pass (clean condition)',
      'Clogging Model': 'Efficiency degrades to 25% under accumulated debris',
    },
  },

  'flt-stage2': {
    id: 'flt-stage2',
    name: 'Stage 2 RO & Ion-Exchange Membrane',
    shortName: 'Stage 2 RO Vessel',
    category: 'filter',
    readiness: 'virtual_only',
    description:
      'Semi-permeable thin-film composite reverse osmosis membrane and selective ion-exchange resin. Reduces dissolved inorganic ions and salinity (65% nominal TDS reduction per pass).',
    position: [2.40, 0.70, -1.20],
    camera: {
      position: [2.40, 1.20, -0.40],
      target: [2.40, 0.70, -1.20],
    },
    parameter: 'Dissolved Solids Desalination',
    unit: 'ppm',
    demoValue: '65% Desalination',
    demoRange: '0 – 1500 ppm operating range',
    installation: 'Filtration bay vessel 2 at [2.40, 0.20, -1.20]',
    metadata: {
      'Membrane Type': 'Polyamide Thin-Film Composite Spiral Wound',
      'Target Contaminant': 'Total Dissolved Solids (TDS) / Soluble ions',
      'Pass Efficiency': '65% reduction per pass',
      'Minimum Driving Head': '3.2 bar net feed pressure',
    },
  },

  'sensor-fs02': {
    id: 'sensor-fs02',
    name: 'Downstream Flow Sensor FS-02',
    shortName: 'Flow FS-02',
    category: 'sensor',
    readiness: 'virtual_only',
    description:
      'Downstream turbine flow sensor located at the entry of the village distribution sector. Paired with FS-01 to compute differential mass balance and detect pipeline leakage loss.',
    position: [2.85, 0.65, 0],
    camera: {
      position: [2.85, 0.95, 0.80],
      target: [2.85, 0.65, 0],
    },
    parameter: 'Downstream Pipeline Flow',
    unit: 'L/min',
    demoValue: '30.0 L/min',
    demoRange: '0.0 – 60.0 L/min',
    installation: 'Main distribution pipeline at X = 2.85m',
    metadata: {
      'Differential Pair': 'FS-01 (Upstream) - FS-02 (Downstream)',
      'Leak Calculation': 'Q_leak = FS-01 - FS-02 (under steady boundary conditions)',
      'Signal Interface': 'Hall-effect pulse train to ESP32 virtual pin',
    },
  },

  'sensor-fs-out': {
    id: 'sensor-fs-out',
    name: 'Post-Treatment Outlet Flow Sensor FS-OUT',
    shortName: 'Flow FS-OUT',
    category: 'sensor',
    readiness: 'virtual_only',
    description:
      'In-line turbine flow meter monitoring treated effluent volume leaving the multi-stage filtration train.',
    position: [2.85, 0.65, -1.20],
    camera: {
      position: [2.85, 0.95, -0.50],
      target: [2.85, 0.65, -1.20],
    },
    parameter: 'Treated Outlet Flow',
    unit: 'L/min',
    demoValue: '0.0 L/min (Standby)',
    demoRange: '0.0 – 45.0 L/min',
    installation: 'Filtration effluent header at [2.85, 0.65, -1.20]',
    metadata: {
      'Operating Mode': 'Active during filtration and recirculation cycles',
      'Flow Range': '0 – 45 L/min',
    },
  },

  'sensor-tds-post': {
    id: 'sensor-tds-post',
    name: 'Post-Treatment TDS Analytical Sensor',
    shortName: 'TDS (Post-Treatment)',
    category: 'sensor',
    readiness: 'virtual_only',
    description:
      'Precision 4-electrode conductivity cell measuring residual dissolved solids after Stage 2 treatment. Must read <= 500 ppm to permit release.',
    position: [3.05, 0.65, -1.20],
    camera: {
      position: [3.05, 0.95, -0.50],
      target: [3.05, 0.65, -1.20],
    },
    parameter: 'Post-Treatment TDS',
    unit: 'ppm',
    demoValue: '180 ppm',
    demoRange: '0 – 2000 ppm',
    installation: 'Analytical sampling cell on treated effluent manifold',
    metadata: {
      'Release Threshold': '<= 500 ppm',
      'Electrode Type': 'Platinum coated titanium 4-pole cell',
      'Resolution': '1 ppm',
    },
  },

  'sensor-turb-post': {
    id: 'sensor-turb-post',
    name: 'Post-Treatment Turbidity Optical Sensor',
    shortName: 'Turbidity (Post-Treatment)',
    category: 'sensor',
    readiness: 'virtual_only',
    description:
      'ISO 7027 compliant 90-degree near-infrared nephelometric sensor checking post-treatment optical clarity. Must read <= 5.0 NTU to permit release.',
    position: [3.25, 0.65, -1.20],
    camera: {
      position: [3.25, 0.95, -0.50],
      target: [3.25, 0.65, -1.20],
    },
    parameter: 'Post-Treatment Turbidity',
    unit: 'NTU',
    demoValue: '1.5 NTU',
    demoRange: '0.0 – 100.0 NTU',
    installation: 'Nephelometric flow-through cuvette on treated effluent manifold',
    metadata: {
      'Release Threshold': '<= 5.0 NTU',
      'Optical Standard': 'ISO 7027 / US EPA 180.1 compliant',
      'Resolution': '0.1 NTU',
    },
  },
};

/**
 * Array of all registered components for navigation and iteration
 */
export const COMPONENT_LIST: TwinComponentDefinition[] = Object.values(COMPONENT_REGISTRY);
