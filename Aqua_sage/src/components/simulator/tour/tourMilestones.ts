export interface TourMilestone {
  id: string;
  stepNumber: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  description: string;
  technicalSpecs: Record<string, string>;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  durationSeconds: number;
  highlightComponentId?: string;
}

export const TOUR_MILESTONES: TourMilestone[] = [
  {
    id: 'milestone-overview',
    stepNumber: 1,
    totalSteps: 5,
    title: '1:1 Metric Hydraulic Digital Twin',
    subtitle: 'High-Precision Precision IoT Infrastructure & Regional Reach',
    description:
      'Engineered to exact 1:1 metric scale (1.8m × 0.8m × 1.6m), this digital twin models real-time hydraulic flow, continuous multi-sensor telemetry, and autonomous closed-loop remediation for mission-critical municipal water networks.',
    technicalSpecs: {
      'Physical Scale': '1:1 Metric Skid (1.8m × 0.8m × 1.6m)',
      'Reservoir Volume': '250 Litres Optical Acrylic',
      'Regional Distribution': '3 Topographic Village Zones',
      'Telemetry Sampling': 'Real-Time Deterministic Engine',
    },
    camera: {
      position: [3.8, 2.6, 3.8],
      target: [1.2, 0.75, 0],
    },
    durationSeconds: 11,
  },
  {
    id: 'milestone-pump',
    stepNumber: 2,
    totalSteps: 5,
    title: 'Centrifugal Volute Pump & Drive Motor',
    subtitle: 'Primary Hydraulic Head Generation & Manifold Riser',
    description:
      'Industrial single-stage centrifugal volute pump driven by a three-phase TEFC motor on vibration-isolation bushings. Generates 2.80 bar nominal hydraulic head to circulate fluid through analytical sensors and village feeder lines.',
    technicalSpecs: {
      'Motor Rating': 'Three-Phase Industrial TEFC Drive',
      'Discharge Pressure': '2.80 bar Nominal Head',
      'Nominal Circulation': '18.0 Litres / Minute',
      'Suction Port': 'DN50 Axial Flange (Ø 0.05m)',
    },
    camera: {
      position: [0.35, 0.65, 1.25],
      target: [0.15, 0.28, 0],
    },
    durationSeconds: 10,
    highlightComponentId: 'pump',
  },
  {
    id: 'milestone-analytics',
    stepNumber: 3,
    totalSteps: 5,
    title: 'Continuous Analytical Water Quality Loop',
    subtitle: 'Multi-Sensor Screening: TDS, Turbidity & In-Line Pressure',
    description:
      'Polished analytical stainless bypass loop hosting piezoresistive pressure transducers, immersed titanium TDS conductivity electrodes, and dual-beam nephelometric optical turbidity chambers for continuous safety compliance screening.',
    technicalSpecs: {
      'TDS Screening': '180 ppm Baseline (Threshold 500 ppm)',
      'Turbidity Optics': '1.2 NTU Baseline (Threshold 5.0 NTU)',
      'Pressure Monitoring': 'Dual Transducers P1 (2.8 bar) & P2',
      'Safety Isolation': 'Automated 1.2s Fast Diversion Trigger',
    },
    camera: {
      position: [0.65, 0.95, 1.05],
      target: [0.55, 0.65, 0],
    },
    durationSeconds: 10,
    highlightComponentId: 'sensor-tds01',
  },
  {
    id: 'milestone-filtration',
    stepNumber: 4,
    totalSteps: 5,
    title: 'Autonomous 3-Stage Filtration & Recirculation',
    subtitle: 'Immediate Contamination Interception & Closed-Loop Remediation',
    description:
      'Upon detecting turbidity or mineral contamination, automated safety valve V-DIV isolates the municipal trunk within 1.2 seconds, rerouting contaminated parcels through dual-media particulate filtration, active carbon adsorption, and reverse osmosis before recirculating clean water.',
    technicalSpecs: {
      'Valve Actuation': '< 1.2s High-Speed Safety Isolation',
      'Stage 1 Filtration': 'Dual-Media Particulate Vessel (0.16m)',
      'Stage 2 Adsorption': 'Granular Activated Carbon (GAC)',
      'Stage 3 Desalination': 'Reverse Osmosis Pressure Vessel',
    },
    camera: {
      position: [2.8, 2.2, 0.9],
      target: [2.6, 0.7, -1.2],
    },
    durationSeconds: 11,
    highlightComponentId: 'flt-stage1',
  },
  {
    id: 'milestone-village',
    stepNumber: 5,
    totalSteps: 5,
    title: 'Topographic Village Distribution Network',
    subtitle: 'Elevated Ridge Tower, Central Civic Market & Clinical Health Dispensary',
    description:
      'Connected 3D digital elevation model distributing clean water across North Ward elevated ridge tower (+140m relative), East Ward central market civic reservoir, and South Ward rural health clinic with individual zone telemetry and solar-powered cold chain storage.',
    technicalSpecs: {
      'Zone A (North Ward)': '1000 L Elevated Trestle Tower',
      'Zone B (East Ward)': '1200 L Civic Market Reservoir',
      'Zone C (South Ward)': '800 L Hospital & School Dispensary',
      'Trunk Infrastructure': 'Ground Pipeline Saddle Stanchions',
    },
    camera: {
      position: [6.8, 3.8, 4.2],
      target: [5.8, 0.8, 0],
    },
    durationSeconds: 12,
    highlightComponentId: 'zone-a',
  },
];
