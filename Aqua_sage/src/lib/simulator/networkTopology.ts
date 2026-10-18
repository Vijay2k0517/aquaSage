/**
 * AquaSage 3D IoT Digital Twin - Network Topology & Infrastructure Models
 *
 * Defines the complete rural village water distribution network,
 * interconnected piping segments, nodes, village zones, and valves.
 */

export interface NetworkNode {
  id: string;
  name: string;
  type: 'source' | 'pump' | 'sensor_junction' | 'leak_point' | 'valve_junction' | 'filtration' | 'village_zone';
  position: [number, number, number]; // 3D coordinates in world space
  pressureBar: number;
  elevationM: number;
  description: string;
}

export type PipeSegmentStatus = 'active' | 'isolated' | 'leaking' | 'diverting' | 'recirculating' | 'blocked';

export interface PipeSegment {
  id: string;
  name: string;
  startNodeId: string;
  endNodeId: string;
  points: [number, number, number][]; // 3D polyline waypoints for rendering
  nominalDiameterMm: number;
  flowCapacityLpm: number;
  currentFlowLpm: number;
  status: PipeSegmentStatus;
  waterQuality: {
    tdsPpm: number;
    turbidityNtu: number;
    isContaminated: boolean;
  };
  associatedValveId?: string;
  associatedSensorId?: string;
}

export type ValveState = 'OPEN' | 'CLOSED' | 'TRANSITIONING' | 'FAULTED';

export interface NetworkValve {
  id: string;
  name: string;
  type: 'manual_isolation' | 'automated_diversion' | 'recirculation' | 'release';
  position: [number, number, number];
  rotation?: [number, number, number];
  commandedState: 'OPEN' | 'CLOSED';
  actualState: ValveState;
  isFaulted: boolean;
  pipeSegmentId: string;
  description: string;
}

export interface VillageZone {
  id: 'zone-a' | 'zone-b' | 'zone-c';
  name: string;
  wardName: string;
  populationServed: number;
  position: [number, number, number];
  tankCapacityL: number;
  currentLevelL: number;
  levelPercentage: number;
  baselineDemandLpm: number;
  currentSupplyLpm: number;
  supplyStatus: 'normal' | 'reduced' | 'contaminated_isolated' | 'cut_off';
  waterQuality: {
    tdsPpm: number;
    turbidityNtu: number;
  };
  publicStandposts: number;
}

export type FiltrationState =
  | 'IDLE'
  | 'DIVERTING'
  | 'FILTERING'
  | 'QUALITY_CHECK'
  | 'RECIRCULATING'
  | 'RELEASE_READY'
  | 'RETURNING_TO_DISTRIBUTION'
  | 'FILTER_LIMIT_REACHED'
  | 'FILTER_FAULT'
  | 'SENSOR_INVALID';

export interface FiltrationSystemConfig {
  maxPasses: number; // default 3
  turbidityEfficiencyPerPass: number; // default 0.70 (70% reduction per pass)
  tdsEfficiencyPerPass: number; // default 0.65 (65% reduction per pass)
  releaseThresholdTds: number; // <= 500 ppm
  releaseThresholdTurbidity: number; // <= 5.0 NTU
  filterCapacityLpm: number; // rated 25 L/min
  currentPassCount: number;
  filterClogged: boolean;
  filterLoadingPercent: number; // 0 - 100%
}

export interface NetworkTopology {
  nodes: Record<string, NetworkNode>;
  pipes: Record<string, PipeSegment>;
  valves: Record<string, NetworkValve>;
  villageZones: Record<string, VillageZone>;
  filtrationConfig: FiltrationSystemConfig;
  filtrationState: FiltrationState;
}

/**
 * Standard World Coordinates and Topologies for AquaSage Infrastructure
 * Coordinates are centered around the skid origin [0, 0, 0]:
 * - Skid is at X: [-0.6 to 1.0], Y: [0 to 1.6], Z: [-0.4 to 0.4]
 * - Main Village Supply pipeline runs along X: [1.0 to 4.5], Z: [0]
 * - Filtration Plant sits at Z: [-1.2 to -2.6], X: [1.2 to 3.0]
 * - Village Distribution Network branches out at X: [4.5 to 8.5], Z: [-2.0 to 2.5]
 */
export const NETWORK_NODES: Record<string, NetworkNode> = {
  // Source & Skid Nodes
  'node-source-tank': {
    id: 'node-source-tank',
    name: 'Primary Source Reservoir',
    type: 'source',
    position: [-0.45, 0.95, 0],
    pressureBar: 0.12,
    elevationM: 0.35,
    description: '250 L calibrated acrylic reservoir with ultrasonic level transducer US-01',
  },
  'node-pump-station': {
    id: 'node-pump-station',
    name: 'Water Pumping Station',
    type: 'pump',
    position: [0.05, 0.27, 0],
    pressureBar: 2.80,
    elevationM: 0.12,
    description: 'Centrifugal volute pump coupled to 2850 RPM induction motor',
  },
  'node-fs01': {
    id: 'node-fs01',
    name: 'Upstream Flow Sensor Bay FS-01',
    type: 'sensor_junction',
    position: [0.42, 0.65, 0],
    pressureBar: 2.75,
    elevationM: 0.65,
    description: 'Upstream primary turbine flow meter FS-01 and pressure transducer PT-01',
  },
  'node-leak-point': {
    id: 'node-leak-point',
    name: 'Pipeline Inspection Segment (Leak Bay)',
    type: 'leak_point',
    position: [1.60, 0.65, 0],
    pressureBar: 2.55,
    elevationM: 0.65,
    description: 'Exposed distribution pipe section between FS-01 and FS-02 for simulated aperture rupture',
  },
  'node-fs02': {
    id: 'node-fs02',
    name: 'Downstream Flow Sensor Bay FS-02',
    type: 'sensor_junction',
    position: [2.60, 0.65, 0],
    pressureBar: 2.40,
    elevationM: 0.65,
    description: 'Downstream flow meter FS-02 and delivery pressure transducer PT-02',
  },
  'node-diversion-junction': {
    id: 'node-diversion-junction',
    name: 'Automated Diversion Manifold',
    type: 'valve_junction',
    position: [3.40, 0.65, 0],
    pressureBar: 2.35,
    elevationM: 0.65,
    description: 'Three-way manifold housing V-DIST (normal delivery) and V-DIV (automated diversion)',
  },

  // Filtration Facility Nodes
  'node-flt-inlet': {
    id: 'node-flt-inlet',
    name: 'Filtration Plant Inlet',
    type: 'filtration',
    position: [3.40, 0.65, -1.20],
    pressureBar: 2.20,
    elevationM: 0.65,
    description: 'Filtration facility inlet valve V-FLT-IN with raw water analytical sensors',
  },
  'node-flt-stage1': {
    id: 'node-flt-stage1',
    name: 'Stage 1: Turbidity & Particulate Vessel',
    type: 'filtration',
    position: [2.60, 0.70, -1.60],
    pressureBar: 2.00,
    elevationM: 0.70,
    description: 'Dual-media sand/anthracite pressure filter vessel for suspended particulate removal',
  },
  'node-flt-stage2': {
    id: 'node-flt-stage2',
    name: 'Stage 2: RO / Desalination Membrane Vessel',
    type: 'filtration',
    position: [1.80, 0.70, -1.60],
    pressureBar: 1.65,
    elevationM: 0.70,
    description: 'Brackish water reverse osmosis & ion exchange membrane for dissolved solids reduction',
  },
  'node-flt-post-quality': {
    id: 'node-flt-post-quality',
    name: 'Post-Treatment Quality Block',
    type: 'sensor_junction',
    position: [1.20, 0.65, -1.60],
    pressureBar: 1.50,
    elevationM: 0.65,
    description: 'Post-treatment TDS probe, optical turbidity cell, and outlet flow meter FS-OUT',
  },
  'node-flt-recirc-junction': {
    id: 'node-flt-recirc-junction',
    name: 'Multi-Pass Recirculation Junction',
    type: 'valve_junction',
    position: [1.20, 0.65, -1.20],
    pressureBar: 1.45,
    elevationM: 0.65,
    description: 'Automated recirculation valve V-REC directing failing batches back to treatment inlet',
  },
  'node-flt-release-junction': {
    id: 'node-flt-release-junction',
    name: 'Treated Water Release Junction',
    type: 'valve_junction',
    position: [3.40, 0.65, -0.60],
    pressureBar: 1.80,
    elevationM: 0.65,
    description: 'Release valve V-REL connecting certified post-treatment water back to distribution',
  },

  // Village Network Distribution Header & Zones
  'node-distribution-header': {
    id: 'node-distribution-header',
    name: 'Village Distribution Header',
    type: 'valve_junction',
    position: [4.60, 0.65, 0],
    pressureBar: 2.25,
    elevationM: 0.65,
    description: 'Main delivery manifold splitting supply to North, East, and South village sectors',
  },
  'node-zone-a': {
    id: 'node-zone-a',
    name: 'Village Zone A (North Ward)',
    type: 'village_zone',
    position: [6.20, 0.85, 1.80],
    pressureBar: 1.95,
    elevationM: 1.20,
    description: 'North settlement cluster with 1,200 residents, elevated reservoir, and 8 public taps',
  },
  'node-zone-b': {
    id: 'node-zone-b',
    name: 'Village Zone B (East Ward / Market)',
    type: 'village_zone',
    position: [6.80, 0.70, 0.0],
    pressureBar: 2.05,
    elevationM: 0.80,
    description: 'Central village market and community center with 1,850 residents and direct standposts',
  },
  'node-zone-c': {
    id: 'node-zone-c',
    name: 'Village Zone C (South Ward / Clinic)',
    type: 'village_zone',
    position: [6.20, 0.60, -1.80],
    pressureBar: 2.10,
    elevationM: 0.40,
    description: 'Rural healthcare dispensary, primary school, and residential sector with 950 residents',
  },
};

export const NETWORK_VALVES: Record<string, NetworkValve> = {
  'valve-v1': {
    id: 'valve-v1',
    name: 'V1 Suction Isolation Valve',
    type: 'manual_isolation',
    position: [-0.20, 0.25, 0],
    commandedState: 'OPEN',
    actualState: 'OPEN',
    isFaulted: false,
    pipeSegmentId: 'pipe-suction',
    description: 'Quarter-turn ball valve isolating source reservoir from pump suction',
  },
  'valve-v2': {
    id: 'valve-v2',
    name: 'V2 Skid Delivery Throttle',
    type: 'manual_isolation',
    position: [0.89, 0.65, 0],
    commandedState: 'OPEN',
    actualState: 'OPEN',
    isFaulted: false,
    pipeSegmentId: 'pipe-skid-discharge',
    description: 'Downstream throttle valve controlling delivery flow leaving the pilot skid',
  },
  'valve-v-dist': {
    id: 'valve-v-dist',
    name: 'V-DIST Normal Village Delivery Valve',
    type: 'automated_diversion',
    position: [3.80, 0.65, 0],
    commandedState: 'OPEN',
    actualState: 'OPEN',
    isFaulted: false,
    pipeSegmentId: 'pipe-main-delivery',
    description: 'Automated pneumatic fail-closed actuator isolating village supply during contamination events',
  },
  'valve-v-div': {
    id: 'valve-v-div',
    name: 'V-DIV Automated Contamination Diversion Valve',
    type: 'automated_diversion',
    position: [3.40, 0.65, -0.60],
    commandedState: 'CLOSED',
    actualState: 'CLOSED',
    isFaulted: false,
    pipeSegmentId: 'pipe-diversion-run',
    description: 'High-speed diverter valve directing contaminated water away from villages to filtration plant',
  },
  'valve-v-flt-in': {
    id: 'valve-v-flt-in',
    name: 'V-FLT-IN Treatment Plant Inlet Valve',
    type: 'manual_isolation',
    position: [3.00, 0.65, -1.20],
    commandedState: 'OPEN',
    actualState: 'OPEN',
    isFaulted: false,
    pipeSegmentId: 'pipe-flt-inlet-run',
    description: 'Inlet isolation valve admitting diverted water into the multi-stage filtration train',
  },
  'valve-v-rec': {
    id: 'valve-v-rec',
    name: 'V-REC Filtration Recirculation Valve',
    type: 'recirculation',
    position: [1.20, 0.65, -1.00],
    commandedState: 'CLOSED',
    actualState: 'CLOSED',
    isFaulted: false,
    pipeSegmentId: 'pipe-flt-recirc-run',
    description: 'Recirculation bypass routing water failing release criteria back for additional treatment passes',
  },
  'valve-v-rel': {
    id: 'valve-v-rel',
    name: 'V-REL Treated Water Release Valve',
    type: 'release',
    position: [3.00, 0.65, -0.60],
    commandedState: 'CLOSED',
    actualState: 'CLOSED',
    isFaulted: false,
    pipeSegmentId: 'pipe-flt-release-run',
    description: 'Release valve opening exclusively when post-treatment TDS and turbidity meet release criteria',
  },
};

export const VILLAGE_ZONES: Record<string, VillageZone> = {
  'zone-a': {
    id: 'zone-a',
    name: 'Zone A',
    wardName: 'North Ward (Elevated Ridge)',
    populationServed: 1200,
    position: [6.20, 0.85, 1.80],
    tankCapacityL: 1000,
    currentLevelL: 780,
    levelPercentage: 78.0,
    baselineDemandLpm: 6.0,
    currentSupplyLpm: 6.0,
    supplyStatus: 'normal',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5 },
    publicStandposts: 8,
  },
  'zone-b': {
    id: 'zone-b',
    name: 'Zone B',
    wardName: 'East Ward (Central Market)',
    populationServed: 1850,
    position: [6.80, 0.70, 0.0],
    tankCapacityL: 1200,
    currentLevelL: 950,
    levelPercentage: 79.2,
    baselineDemandLpm: 6.5,
    currentSupplyLpm: 6.5,
    supplyStatus: 'normal',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5 },
    publicStandposts: 12,
  },
  'zone-c': {
    id: 'zone-c',
    name: 'Zone C',
    wardName: 'South Ward (Dispensary & School)',
    populationServed: 950,
    position: [6.20, 0.60, -1.80],
    tankCapacityL: 800,
    currentLevelL: 640,
    levelPercentage: 80.0,
    baselineDemandLpm: 5.5,
    currentSupplyLpm: 5.5,
    supplyStatus: 'normal',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5 },
    publicStandposts: 6,
  },
};

export const PIPE_SEGMENTS: Record<string, PipeSegment> = {
  // Skid Internal Line
  'pipe-suction': {
    id: 'pipe-suction',
    name: 'Tank Suction Line',
    startNodeId: 'node-source-tank',
    endNodeId: 'node-pump-station',
    points: [[-0.45, 0.25, 0], [0.05, 0.25, 0]],
    nominalDiameterMm: 50,
    flowCapacityLpm: 30.0,
    currentFlowLpm: 18.0,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedValveId: 'valve-v1',
  },
  'pipe-skid-discharge': {
    id: 'pipe-skid-discharge',
    name: 'Pump Discharge & FS-01 Line',
    startNodeId: 'node-pump-station',
    endNodeId: 'node-fs01',
    points: [[0.07, 0.65, 0], [0.42, 0.65, 0]],
    nominalDiameterMm: 50,
    flowCapacityLpm: 30.0,
    currentFlowLpm: 18.0,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedSensorId: 'sensor-fs01',
  },

  // Main Pipeline & Leak Section
  'pipe-leak-section': {
    id: 'pipe-leak-section',
    name: 'Main Supply Pipeline (Inspection Segment)',
    startNodeId: 'node-fs01',
    endNodeId: 'node-fs02',
    points: [[0.44, 0.65, 0], [1.60, 0.65, 0], [2.60, 0.65, 0]],
    nominalDiameterMm: 50,
    flowCapacityLpm: 30.0,
    currentFlowLpm: 18.0,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
  },
  'pipe-to-diversion': {
    id: 'pipe-to-diversion',
    name: 'Main Delivery to Diversion Manifold',
    startNodeId: 'node-fs02',
    endNodeId: 'node-diversion-junction',
    points: [[2.60, 0.65, 0], [3.40, 0.65, 0]],
    nominalDiameterMm: 50,
    flowCapacityLpm: 30.0,
    currentFlowLpm: 18.0,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedSensorId: 'sensor-fs02',
  },

  // Normal Village Supply Branch
  'pipe-main-delivery': {
    id: 'pipe-main-delivery',
    name: 'Main Village Supply Trunk',
    startNodeId: 'node-diversion-junction',
    endNodeId: 'node-distribution-header',
    points: [[3.40, 0.65, 0], [4.60, 0.65, 0]],
    nominalDiameterMm: 50,
    flowCapacityLpm: 30.0,
    currentFlowLpm: 18.0,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedValveId: 'valve-v-dist',
  },
  'pipe-zone-a': {
    id: 'pipe-zone-a',
    name: 'Zone A North Ward Feeder',
    startNodeId: 'node-distribution-header',
    endNodeId: 'node-zone-a',
    points: [[4.60, 0.65, 0], [5.20, 0.75, 1.80], [6.20, 0.85, 1.80]],
    nominalDiameterMm: 32,
    flowCapacityLpm: 12.0,
    currentFlowLpm: 6.0,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
  },
  'pipe-zone-b': {
    id: 'pipe-zone-b',
    name: 'Zone B Central Market Feeder',
    startNodeId: 'node-distribution-header',
    endNodeId: 'node-zone-b',
    points: [[4.60, 0.65, 0], [6.80, 0.70, 0.0]],
    nominalDiameterMm: 32,
    flowCapacityLpm: 12.0,
    currentFlowLpm: 6.5,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
  },
  'pipe-zone-c': {
    id: 'pipe-zone-c',
    name: 'Zone C South Ward Feeder',
    startNodeId: 'node-distribution-header',
    endNodeId: 'node-zone-c',
    points: [[4.60, 0.65, 0], [5.20, 0.60, -1.80], [6.20, 0.60, -1.80]],
    nominalDiameterMm: 32,
    flowCapacityLpm: 12.0,
    currentFlowLpm: 5.5,
    status: 'active',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
  },

  // Automated Diversion & Filtration Lines
  'pipe-diversion-run': {
    id: 'pipe-diversion-run',
    name: 'Contamination Diversion Run',
    startNodeId: 'node-diversion-junction',
    endNodeId: 'node-flt-inlet',
    points: [[3.40, 0.65, 0], [3.40, 0.65, -1.20]],
    nominalDiameterMm: 40,
    flowCapacityLpm: 25.0,
    currentFlowLpm: 0.0,
    status: 'isolated',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedValveId: 'valve-v-div',
  },
  'pipe-flt-treatment-train': {
    id: 'pipe-flt-treatment-train',
    name: 'Filtration Train (Stage 1 to Stage 2)',
    startNodeId: 'node-flt-inlet',
    endNodeId: 'node-flt-post-quality',
    points: [
      [3.40, 0.65, -1.20],
      [2.60, 0.70, -1.60],
      [1.80, 0.70, -1.60],
      [1.20, 0.65, -1.60],
    ],
    nominalDiameterMm: 40,
    flowCapacityLpm: 25.0,
    currentFlowLpm: 0.0,
    status: 'isolated',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedValveId: 'valve-v-flt-in',
  },
  'pipe-flt-recirc-run': {
    id: 'pipe-flt-recirc-run',
    name: 'Filtration Multi-Pass Recirculation Loop',
    startNodeId: 'node-flt-post-quality',
    endNodeId: 'node-flt-inlet',
    points: [
      [1.20, 0.65, -1.60],
      [1.20, 0.65, -2.10],
      [3.40, 0.65, -2.10],
      [3.40, 0.65, -1.20],
    ],
    nominalDiameterMm: 32,
    flowCapacityLpm: 25.0,
    currentFlowLpm: 0.0,
    status: 'isolated',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedValveId: 'valve-v-rec',
  },
  'pipe-flt-release-run': {
    id: 'pipe-flt-release-run',
    name: 'Treated Water Return & Release Line',
    startNodeId: 'node-flt-post-quality',
    endNodeId: 'node-distribution-header',
    points: [
      [1.20, 0.65, -1.60],
      [1.20, 0.65, -0.60],
      [3.40, 0.65, -0.60],
      [4.60, 0.65, 0],
    ],
    nominalDiameterMm: 40,
    flowCapacityLpm: 25.0,
    currentFlowLpm: 0.0,
    status: 'isolated',
    waterQuality: { tdsPpm: 180, turbidityNtu: 1.5, isContaminated: false },
    associatedValveId: 'valve-v-rel',
  },
};
