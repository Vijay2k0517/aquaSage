/**
 * AquaSage 3D IoT Digital Twin - Deterministic Simulation Engine
 *
 * Pure, side-effect-free mathematical engine for fluid mass balance,
 * village distribution network flow, leak loss computation, automated
 * contamination diversion, and multi-pass filtration logic.
 */

import {
  SimulationState,
  ScenarioId,
  TelemetryReading,
  AlarmSeverity,
  MeasurementValidity,
  SimulatedConnectionState,
} from './telemetryTypes';
import { SCENARIO_DEFINITIONS } from './scenarios';
import { TANK_PHYSICAL_CONSTANTS, SENSOR_CONFIG, ThresholdBoundary } from './thresholdConfig';
import {
  NETWORK_NODES,
  NETWORK_VALVES,
  PIPE_SEGMENTS,
  VILLAGE_ZONES,
  NetworkTopology,
  FiltrationState,
} from './networkTopology';
import { evaluateFiltrationStateMachine, calculateTreatmentPass } from './filtrationEngine';
import { createSimulationEvent, SimulationEvent } from './eventLogger';

/**
 * Calculates water storage volume in Litres from water column height in metres
 * V = π * (D / 2)² * h * 1000
 */
export function calculateTankVolume(
  heightM: number,
  diameterM: number = TANK_PHYSICAL_CONSTANTS.INTERNAL_DIAMETER_M
): number {
  const clampedHeight = Math.max(0, Math.min(TANK_PHYSICAL_CONSTANTS.SHELL_HEIGHT_M, heightM));
  const radius = diameterM / 2;
  const volumeM3 = Math.PI * Math.pow(radius, 2) * clampedHeight;
  return Number((volumeM3 * 1000).toFixed(2));
}

/**
 * Calculates water column height in metres from volume in Litres
 * h = V / (π * (D / 2)² * 1000)
 */
export function calculateWaterHeightFromVolume(
  volumeLitres: number,
  diameterM: number = TANK_PHYSICAL_CONSTANTS.INTERNAL_DIAMETER_M
): number {
  const radius = diameterM / 2;
  const areaM2 = Math.PI * Math.pow(radius, 2);
  const volumeM3 = volumeLitres / 1000;
  const heightM = volumeM3 / areaM2;
  return Math.max(0, Math.min(TANK_PHYSICAL_CONSTANTS.SHELL_HEIGHT_M, Number(heightM.toFixed(4))));
}

/**
 * Calculates usable tank capacity percentage (0.0 to 100.0%)
 */
export function calculateLevelPercentage(
  heightM: number,
  maxUsableHeightM: number = TANK_PHYSICAL_CONSTANTS.MAX_USABLE_HEIGHT_M
): number {
  const pct = (heightM / maxUsableHeightM) * 100;
  return Math.max(0, Math.min(100, Number(pct.toFixed(1))));
}

/**
 * Evaluates alarm severity against configured warning and critical thresholds
 */
export function evaluateAlarmSeverity(
  value: number | null,
  thresholds?: ThresholdBoundary
): AlarmSeverity {
  if (value === null || !thresholds) {
    return 'unknown';
  }

  // Check critical thresholds first
  if (thresholds.criticalLow !== undefined && value < thresholds.criticalLow) {
    return 'critical';
  }
  if (thresholds.criticalHigh !== undefined && value > thresholds.criticalHigh) {
    return 'critical';
  }

  // Check warning thresholds
  if (thresholds.warningLow !== undefined && value < thresholds.warningLow) {
    return 'warning';
  }
  if (thresholds.warningHigh !== undefined && value > thresholds.warningHigh) {
    return 'warning';
  }

  return 'normal';
}

/**
 * Deep-clones base network topology for clean initial simulation state
 */
export function createBaseNetworkTopology(): NetworkTopology {
  return {
    nodes: JSON.parse(JSON.stringify(NETWORK_NODES)),
    pipes: JSON.parse(JSON.stringify(PIPE_SEGMENTS)),
    valves: JSON.parse(JSON.stringify(NETWORK_VALVES)),
    villageZones: JSON.parse(JSON.stringify(VILLAGE_ZONES)),
    filtrationConfig: {
      maxPasses: 3,
      turbidityEfficiencyPerPass: 0.70,
      tdsEfficiencyPerPass: 0.65,
      releaseThresholdTds: 500.0,
      releaseThresholdTurbidity: 5.0,
      filterCapacityLpm: 25.0,
      currentPassCount: 0,
      filterClogged: false,
      filterLoadingPercent: 12.0,
    },
    filtrationState: 'IDLE',
  };
}

/**
 * Generates an initial simulation state from a chosen scenario definition
 */
export function createInitialSimulationState(scenarioId: ScenarioId): SimulationState {
  const scenario = SCENARIO_DEFINITIONS[scenarioId] || SCENARIO_DEFINITIONS.normal;
  const init = scenario.initialState;

  const heightM = init.tankWaterHeight;
  const volumeL = calculateTankVolume(heightM);
  const percentage = calculateLevelPercentage(heightM);

  const netFlowLpm = Number((init.inflowRateLpm - init.outflowRateLpm - init.leakRateLpm).toFixed(2));
  const timestamp = 0;

  // Upstream flow measured at FS-01: contains downstream delivery + leak rate
  const primaryFlowLpm = Number((init.outflowRateLpm + init.leakRateLpm).toFixed(2));
  const downstreamFlowLpm = init.outflowRateLpm;
  const leakSeverityLpm = init.leakRateLpm;
  const estimatedLeakLossLpm = primaryFlowLpm - downstreamFlowLpm;

  // Filtration initial states
  const filtrationState: FiltrationState = init.filtrationState || 'IDLE';
  const isDiverting = filtrationState !== 'IDLE';

  // Base network
  const network = createBaseNetworkTopology();
  network.filtrationState = filtrationState;
  network.filtrationConfig.filterClogged = !!init.filterClogged;
  network.filtrationConfig.filterLoadingPercent = init.filterClogged ? 96.0 : 15.0;

  // Configure initial valve states
  if (init.valveVdivOpen !== undefined) {
    network.valves['valve-v-div'].actualState = init.valveVdivOpen ? 'OPEN' : 'CLOSED';
    network.valves['valve-v-div'].commandedState = init.valveVdivOpen ? 'OPEN' : 'CLOSED';
  }
  if (init.valveVdistClosed !== undefined) {
    network.valves['valve-v-dist'].actualState = init.valveVdistClosed ? 'CLOSED' : 'OPEN';
    network.valves['valve-v-dist'].commandedState = init.valveVdistClosed ? 'CLOSED' : 'OPEN';
  }
  if (init.valveFaulted) {
    network.valves['valve-v-div'].isFaulted = true;
    network.valves['valve-v-div'].actualState = 'FAULTED';
  }

  // Pre- and post-treatment baseline values
  let postTds = init.tdsPpm;
  let postTurbidity = init.turbidityNtu;
  let passCount = 0;

  if (filtrationState === 'FILTERING' || filtrationState === 'RELEASE_READY') {
    passCount = 1;
    const passResult = calculateTreatmentPass(init.tdsPpm, init.turbidityNtu, 1, network.filtrationConfig);
    postTds = passResult.outputTds;
    postTurbidity = passResult.outputTurbidity;
  } else if (filtrationState === 'FILTER_LIMIT_REACHED') {
    passCount = 3;
    postTds = 750.0; // Still failing after 3 passes
    postTurbidity = 7.2;
  }

  // Calculate village supply allocations
  const isVillageSupplied = !isDiverting && downstreamFlowLpm > 0;
  const totalVillageDemand = 18.0;
  const totalVillageDelivered = isVillageSupplied ? downstreamFlowLpm : 0.0;
  const affectedVillages: string[] = [];

  Object.values(network.villageZones).forEach((zone) => {
    if (!isVillageSupplied) {
      zone.currentSupplyLpm = 0.0;
      zone.supplyStatus = isDiverting ? 'contaminated_isolated' : 'cut_off';
      affectedVillages.push(zone.name);
    } else if (downstreamFlowLpm < totalVillageDemand) {
      // Reduced delivery due to leak or blockage
      const ratio = downstreamFlowLpm / totalVillageDemand;
      zone.currentSupplyLpm = Number((zone.baselineDemandLpm * ratio).toFixed(2));
      zone.supplyStatus = 'reduced';
      affectedVillages.push(zone.name);
    } else {
      zone.currentSupplyLpm = zone.baselineDemandLpm;
      zone.supplyStatus = 'normal';
    }
  });

  // Generate normalized sensor telemetry
  const readings = generateReadingsForState(
    heightM,
    volumeL,
    percentage,
    init.inflowRateLpm,
    primaryFlowLpm,
    downstreamFlowLpm,
    leakSeverityLpm,
    init.dischargePressureBar,
    init.deliveryPressureBar,
    init.tdsPpm,
    init.turbidityNtu,
    postTds,
    postTurbidity,
    init.motorCurrentA,
    init.motorSpeedRpm,
    init.valveV1OpenPercent,
    init.valveV2OpenPercent,
    timestamp,
    init.flowSensorValidity || 'valid',
    init.flowSensorConnection || 'simulated_online',
    scenario.isFaultScenario
  );

  const activeFaults = scenario.isFaultScenario && scenario.faultDescription
    ? [scenario.faultDescription]
    : [];

  const initialEvent = createSimulationEvent(
    0,
    0,
    'SCENARIO',
    scenario.isFaultScenario ? 'warning' : 'info',
    'system-controller',
    `Scenario activated: ${scenario.name}`
  );

  return {
    scenarioId,
    isRunning: true,
    stepCount: 0,
    elapsedTimeSec: 0,
    timeStepSec: 1.0,
    speedMultiplier: 1,
    tankWaterHeight: heightM,
    tankVolumeLitres: volumeL,
    tankLevelPercentage: percentage,
    inflowRateLpm: init.inflowRateLpm,
    outflowRateLpm: downstreamFlowLpm,
    leakRateLpm: leakSeverityLpm,
    netFlowRateLpm: netFlowLpm,
    readings,
    network,
    leakSeverityLpm,
    leakLocationNorm: 0.5,
    estimatedLeakLossLpm,
    filtrationState,
    filtrationPassCount: passCount,
    preTreatmentTds: init.tdsPpm,
    preTreatmentTurbidity: init.turbidityNtu,
    postTreatmentTds: postTds,
    postTreatmentTurbidity: postTurbidity,
    postTreatmentReleaseReady:
      postTds <= 500 &&
      postTurbidity <= 5.0 &&
      (filtrationState === 'RELEASE_READY' || filtrationState === 'RETURNING_TO_DISTRIBUTION'),
    affectedVillages,
    totalVillageDemandLpm: totalVillageDemand,
    totalVillageDeliveredLpm: totalVillageDelivered,
    activeFaults,
    scientificAdvisory: scenario.scientificAdvisory,
    events: [initialEvent],
  };
}

/**
 * Pure state transition function advancing the simulation by dtSeconds
 */
export function advanceSimulationStep(
  currentState: SimulationState,
  dtSeconds: number = 1.0
): SimulationState {
  const scenario = SCENARIO_DEFINITIONS[currentState.scenarioId];
  const stepCount = currentState.stepCount + 1;
  const effectiveDt = dtSeconds * (currentState.speedMultiplier || 1);
  const elapsedTimeSec = currentState.elapsedTimeSec + effectiveDt;
  const timestamp = elapsedTimeSec * 1000;

  // Mass Balance Calculation: dV = (Q_in - Q_out - Q_leak) * (dt / 60)
  const netFlowLpm = currentState.inflowRateLpm - currentState.outflowRateLpm - currentState.leakRateLpm;
  const deltaVolumeL = netFlowLpm * (effectiveDt / 60);

  // Update reservoir volume within physical constraints (0 to 250L)
  const maxVolume = TANK_PHYSICAL_CONSTANTS.USABLE_CAPACITY_LITRES;
  const newVolumeL = Math.max(0, Math.min(maxVolume, Number((currentState.tankVolumeLitres + deltaVolumeL).toFixed(4))));
  const newHeightM = calculateWaterHeightFromVolume(newVolumeL);
  const newPercentage = calculateLevelPercentage(newHeightM);

  // Hydraulic & sensor flow readings
  let flowRateLpm = currentState.outflowRateLpm + currentState.leakRateLpm;
  let downstreamFlowLpm = currentState.outflowRateLpm;
  let p1Bar = scenario.initialState.dischargePressureBar;
  let p2Bar = scenario.initialState.deliveryPressureBar;
  const tdsPpm = scenario.initialState.tdsPpm;
  const turbidityNtu = scenario.initialState.turbidityNtu;
  let motorA = scenario.initialState.motorCurrentA;
  const motorRpm = scenario.initialState.motorSpeedRpm;
  const v1Open = scenario.initialState.valveV1OpenPercent;
  const v2Open = scenario.initialState.valveV2OpenPercent;

  // Handle dry reservoir condition
  if (newHeightM <= 0.05) {
    flowRateLpm = 0.0;
    downstreamFlowLpm = 0.0;
    p1Bar = 0.20;
    p2Bar = 0.00;
    motorA = 1.2; // Dry run cavitation current
  }

  // Clone network for deterministic state transition
  const network: NetworkTopology = JSON.parse(JSON.stringify(currentState.network));
  const newEvents: SimulationEvent[] = [...currentState.events];

  // Evaluate Filtration and Diversion State Machine
  const isSensorValid = scenario.initialState.flowSensorValidity !== 'unavailable';
  const valveVdivOpen = network.valves['valve-v-div'].actualState === 'OPEN';
  const valveVdistClosed = network.valves['valve-v-dist'].actualState === 'CLOSED';

  let postTds = currentState.postTreatmentTds;
  let postTurbidity = currentState.postTreatmentTurbidity;
  let passCount = currentState.filtrationPassCount;

  // Progress state machine if in diversion or active contamination
  if (currentState.filtrationState !== 'IDLE' || tdsPpm > 500 || turbidityNtu > 5.0) {
    const activeParcelTds =
      currentState.filtrationState === 'IDLE' || currentState.filtrationState === 'DIVERTING'
        ? tdsPpm
        : currentState.postTreatmentTds;
    const activeParcelTurbidity =
      currentState.filtrationState === 'IDLE' || currentState.filtrationState === 'DIVERTING'
        ? turbidityNtu
        : currentState.postTreatmentTurbidity;

    const smResult = evaluateFiltrationStateMachine(
      currentState.filtrationState,
      passCount,
      activeParcelTds,
      activeParcelTurbidity,
      network.filtrationConfig,
      valveVdivOpen,
      valveVdistClosed,
      isSensorValid
    );

    network.filtrationState = smResult.nextState;
    passCount = smResult.newPassCount;
    postTds = smResult.newTds;
    postTurbidity = smResult.newTurbidity;

    // Apply valve commands to network, preserving faulted hardware states
    network.valves['valve-v-div'].commandedState = smResult.commandVdiv;
    if (!network.valves['valve-v-div'].isFaulted) {
      network.valves['valve-v-div'].actualState = smResult.commandVdiv;
    }

    network.valves['valve-v-dist'].commandedState = smResult.commandVdist;
    if (!network.valves['valve-v-dist'].isFaulted) {
      network.valves['valve-v-dist'].actualState = smResult.commandVdist;
    }

    network.valves['valve-v-rec'].commandedState = smResult.commandVrec;
    if (!network.valves['valve-v-rec'].isFaulted) {
      network.valves['valve-v-rec'].actualState = smResult.commandVrec;
    }

    network.valves['valve-v-rel'].commandedState = smResult.commandVrel;
    if (!network.valves['valve-v-rel'].isFaulted) {
      network.valves['valve-v-rel'].actualState = smResult.commandVrel;
    }

    if (smResult.eventDescription && smResult.nextState !== currentState.filtrationState) {
      newEvents.push(
        createSimulationEvent(
          stepCount,
          elapsedTimeSec,
          'FILTRATION',
          smResult.nextState === 'FILTER_LIMIT_REACHED' ? 'critical' : 'warning',
          'filtration-controller',
          smResult.eventDescription
        )
      );
    }
  }

  // Leak calculations: FS-01 flow vs FS-02 downstream flow
  const estimatedLeak = Math.max(0, Number((flowRateLpm - downstreamFlowLpm).toFixed(2)));

  // Update village zone levels and delivery rates
  const isDiverting = network.filtrationState !== 'IDLE' && network.filtrationState !== 'RETURNING_TO_DISTRIBUTION';
  const isVillageSupplied = !isDiverting && downstreamFlowLpm > 0;
  const totalVillageDemand = 18.0;
  const totalVillageDelivered = isVillageSupplied ? downstreamFlowLpm : 0.0;
  const affectedVillages: string[] = [];

  Object.values(network.villageZones).forEach((zone) => {
    if (!isVillageSupplied) {
      zone.currentSupplyLpm = 0.0;
      zone.supplyStatus = isDiverting ? 'contaminated_isolated' : 'cut_off';
      affectedVillages.push(zone.name);
      // Villages consume from storage tank when supply is isolated
      const consumptionL = (zone.baselineDemandLpm * effectiveDt) / 60;
      zone.currentLevelL = Math.max(0, Number((zone.currentLevelL - consumptionL).toFixed(1)));
    } else if (downstreamFlowLpm < totalVillageDemand) {
      const ratio = downstreamFlowLpm / totalVillageDemand;
      zone.currentSupplyLpm = Number((zone.baselineDemandLpm * ratio).toFixed(2));
      zone.supplyStatus = 'reduced';
      affectedVillages.push(zone.name);
      // Partial consumption deficit
      const deficitLpm = zone.baselineDemandLpm - zone.currentSupplyLpm;
      const consumptionL = (deficitLpm * effectiveDt) / 60;
      zone.currentLevelL = Math.max(0, Number((zone.currentLevelL - consumptionL).toFixed(1)));
    } else {
      zone.currentSupplyLpm = zone.baselineDemandLpm;
      zone.supplyStatus = 'normal';
      // Replenish storage tank slightly if below 85%
      if (zone.levelPercentage < 85) {
        zone.currentLevelL = Math.min(zone.tankCapacityL, zone.currentLevelL + (0.5 * effectiveDt) / 60);
      }
    }
    zone.levelPercentage = Number(((zone.currentLevelL / zone.tankCapacityL) * 100).toFixed(1));
  });

  // Update pipeline segment flow and statuses
  if (isDiverting) {
    network.pipes['pipe-diversion-run'].status = 'diverting';
    network.pipes['pipe-diversion-run'].currentFlowLpm = flowRateLpm;
    network.pipes['pipe-main-delivery'].status = 'isolated';
    network.pipes['pipe-main-delivery'].currentFlowLpm = 0.0;
  } else {
    network.pipes['pipe-diversion-run'].status = 'isolated';
    network.pipes['pipe-diversion-run'].currentFlowLpm = 0.0;
    network.pipes['pipe-main-delivery'].status = 'active';
    network.pipes['pipe-main-delivery'].currentFlowLpm = downstreamFlowLpm;
  }

  if (currentState.leakSeverityLpm > 0) {
    network.pipes['pipe-leak-section'].status = 'leaking';
  }

  // Generate complete telemetry
  const readings = generateReadingsForState(
    newHeightM,
    newVolumeL,
    newPercentage,
    currentState.inflowRateLpm,
    flowRateLpm,
    downstreamFlowLpm,
    currentState.leakSeverityLpm,
    p1Bar,
    p2Bar,
    tdsPpm,
    turbidityNtu,
    postTds,
    postTurbidity,
    motorA,
    motorRpm,
    v1Open,
    v2Open,
    timestamp,
    scenario.initialState.flowSensorValidity || 'valid',
    scenario.initialState.flowSensorConnection || 'simulated_online',
    scenario.isFaultScenario
  );

  return {
    ...currentState,
    stepCount,
    elapsedTimeSec,
    tankWaterHeight: newHeightM,
    tankVolumeLitres: newVolumeL,
    tankLevelPercentage: newPercentage,
    outflowRateLpm: downstreamFlowLpm,
    netFlowRateLpm: Number(netFlowLpm.toFixed(2)),
    readings,
    network,
    estimatedLeakLossLpm: estimatedLeak,
    filtrationState: network.filtrationState,
    filtrationPassCount: passCount,
    postTreatmentTds: postTds,
    postTreatmentTurbidity: postTurbidity,
    postTreatmentReleaseReady:
      postTds <= 500 &&
      postTurbidity <= 5.0 &&
      (network.filtrationState === 'RELEASE_READY' || network.filtrationState === 'RETURNING_TO_DISTRIBUTION'),
    affectedVillages,
    totalVillageDemandLpm: totalVillageDemand,
    totalVillageDeliveredLpm: totalVillageDelivered,
    events: newEvents.slice(-50), // Keep last 50 events in memory
  };
}

/**
 * Builds normalized readings record for all sensors across the network
 */
function generateReadingsForState(
  heightM: number,
  volumeL: number,
  percentage: number,
  inflowLpm: number,
  primaryFlowLpm: number,
  downstreamFlowLpm: number,
  leakLpm: number,
  p1Bar: number,
  p2Bar: number,
  tdsPpm: number,
  turbidityNtu: number,
  postTdsPpm: number,
  postTurbidityNtu: number,
  motorA: number,
  motorRpm: number,
  v1Open: number,
  v2Open: number,
  timestamp: number,
  flowValidity: MeasurementValidity = 'valid',
  flowConnection: SimulatedConnectionState = 'simulated_online',
  isFaultScenario: boolean = false
): Record<string, TelemetryReading> {
  const faultOrigin = isFaultScenario ? 'injected_simulation' : 'none';

  // 1. Storage Reservoir US-01
  const us01Config = SENSOR_CONFIG['sensor-us01'];
  const waterHeightCm = Number((heightM * 100).toFixed(1));
  const isUs01OutOfRange = waterHeightCm < us01Config.operatingRange.min || waterHeightCm > us01Config.operatingRange.max;
  const us01Severity = evaluateAlarmSeverity(waterHeightCm, us01Config.alarmThresholds);

  const readingUs01: TelemetryReading = {
    sensorId: 'sensor-us01',
    displayName: 'Ultrasonic Water Level US-01',
    value: waterHeightCm,
    formattedValue: `${waterHeightCm.toFixed(1)} cm`,
    unit: 'cm',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: us01Severity,
    connectionState: 'simulated_online',
    faultOrigin,
    isOutOfOperatingRange: isUs01OutOfRange,
    operatingRange: us01Config.operatingRange,
    alarmThresholds: us01Config.alarmThresholds,
    notes: `Calculated volume: ${volumeL.toFixed(1)} L (${percentage.toFixed(1)}%). Transducer distance: ${(125.0 - waterHeightCm).toFixed(1)} cm.`,
  };

  // 2. Upstream Flow Sensor FS-01
  const fs01Config = SENSOR_CONFIG['sensor-fs01'];
  const isFs01Valid = flowValidity === 'valid';
  const fs01Value = isFs01Valid ? Number(primaryFlowLpm.toFixed(1)) : null;
  const isFs01OutOfRange = fs01Value !== null && (fs01Value < fs01Config.operatingRange.min || fs01Value > fs01Config.operatingRange.max);
  const fs01Severity = isFs01Valid ? evaluateAlarmSeverity(fs01Value, fs01Config.alarmThresholds) : 'unknown';

  const readingFs01: TelemetryReading = {
    sensorId: 'sensor-fs01',
    displayName: 'Upstream Flow Sensor FS-01',
    value: fs01Value,
    formattedValue: isFs01Valid ? `${primaryFlowLpm.toFixed(1)} L/min` : flowValidity === 'unavailable' ? 'UNAVAILABLE' : 'INVALID',
    unit: 'L/min',
    timestamp,
    source: 'simulated',
    validity: flowValidity,
    severity: fs01Severity,
    connectionState: flowConnection,
    faultOrigin,
    isOutOfOperatingRange: isFs01OutOfRange,
    operatingRange: fs01Config.operatingRange,
    alarmThresholds: fs01Config.alarmThresholds,
    notes: isFs01Valid ? `Hall frequency: ${(primaryFlowLpm * 7.5).toFixed(1)} Hz (F = 7.5 * Q)` : 'Sensor signal fault or disconnected',
  };

  // 3. Downstream Flow Sensor FS-02
  const fs02Config = SENSOR_CONFIG['sensor-fs02'];
  const fs02Value = Number(downstreamFlowLpm.toFixed(1));
  const isFs02OutOfRange = fs02Value < fs02Config.operatingRange.min || fs02Value > fs02Config.operatingRange.max;
  const fs02Severity = evaluateAlarmSeverity(fs02Value, fs02Config.alarmThresholds);

  const readingFs02: TelemetryReading = {
    sensorId: 'sensor-fs02',
    displayName: 'Downstream Flow Sensor FS-02',
    value: fs02Value,
    formattedValue: `${downstreamFlowLpm.toFixed(1)} L/min`,
    unit: 'L/min',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: fs02Severity,
    connectionState: 'simulated_online',
    faultOrigin,
    isOutOfOperatingRange: isFs02OutOfRange,
    operatingRange: fs02Config.operatingRange,
    alarmThresholds: fs02Config.alarmThresholds,
    notes: `Downstream delivery flow. Net leak between FS-01 & FS-02: ${(primaryFlowLpm - downstreamFlowLpm).toFixed(1)} L/min.`,
  };

  // 4. Pump Discharge Head PT-01
  const pt01Config = SENSOR_CONFIG['sensor-pt01'];
  const pt01Value = Number(p1Bar.toFixed(2));
  const pt01Severity = evaluateAlarmSeverity(pt01Value, pt01Config.alarmThresholds);

  const readingPt01: TelemetryReading = {
    sensorId: 'sensor-pt01',
    displayName: 'Pump Discharge Pressure PT-01',
    value: pt01Value,
    formattedValue: `${pt01Value.toFixed(2)} bar`,
    unit: 'bar',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: pt01Severity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: pt01Config.operatingRange,
    alarmThresholds: pt01Config.alarmThresholds,
    notes: 'Measured at pump discharge riser T-junction.',
  };

  // 5. Downstream Delivery Pressure PT-02
  const pt02Config = SENSOR_CONFIG['sensor-pt02'];
  const pt02Value = Number(p2Bar.toFixed(2));
  const pt02Severity = evaluateAlarmSeverity(pt02Value, pt02Config.alarmThresholds);

  const readingPt02: TelemetryReading = {
    sensorId: 'sensor-pt02',
    displayName: 'Delivery Line Pressure PT-02',
    value: pt02Value,
    formattedValue: `${pt02Value.toFixed(2)} bar`,
    unit: 'bar',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: pt02Severity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: pt02Config.operatingRange,
    alarmThresholds: pt02Config.alarmThresholds,
    notes: `Differential head: Delta-P = ${(pt01Value - pt02Value).toFixed(2)} bar.`,
  };

  // 6. Pre-treatment TDS Sensor TDS-01
  const tdsConfig = SENSOR_CONFIG['sensor-tds01'];
  const tdsValue = Math.round(tdsPpm);
  const tdsSeverity = evaluateAlarmSeverity(tdsValue, tdsConfig.alarmThresholds);

  const readingTds01: TelemetryReading = {
    sensorId: 'sensor-tds01',
    displayName: 'Raw Water TDS Sensor TDS-01',
    value: tdsValue,
    formattedValue: `${tdsValue} ppm`,
    unit: 'ppm',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: tdsSeverity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: tdsConfig.operatingRange,
    alarmThresholds: tdsConfig.alarmThresholds,
    notes: 'Pre-treatment total dissolved ionic solids.',
  };

  // 7. Pre-treatment Turbidity Sensor TURB-01
  const turbConfig = SENSOR_CONFIG['sensor-turb01'];
  const turbValue = Number(turbidityNtu.toFixed(1));
  const turbSeverity = evaluateAlarmSeverity(turbValue, turbConfig.alarmThresholds);

  const readingTurb01: TelemetryReading = {
    sensorId: 'sensor-turb01',
    displayName: 'Raw Water Turbidity TURB-01',
    value: turbValue,
    formattedValue: `${turbValue.toFixed(1)} NTU`,
    unit: 'NTU',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: turbSeverity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: turbConfig.operatingRange,
    alarmThresholds: turbConfig.alarmThresholds,
    notes: 'Pre-treatment optical nephelometric clarity.',
  };

  // 8. Post-treatment TDS Sensor
  const postTdsConfig = SENSOR_CONFIG['sensor-tds-post'];
  const postTdsValue = Math.round(postTdsPpm);
  const postTdsSeverity = evaluateAlarmSeverity(postTdsValue, postTdsConfig.alarmThresholds);

  const readingTdsPost: TelemetryReading = {
    sensorId: 'sensor-tds-post',
    displayName: 'Post-Treatment TDS Sensor',
    value: postTdsValue,
    formattedValue: `${postTdsValue} ppm`,
    unit: 'ppm',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: postTdsSeverity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: postTdsConfig.operatingRange,
    alarmThresholds: postTdsConfig.alarmThresholds,
    notes: postTdsValue <= 500 ? 'Meets release criterion (<= 500 ppm)' : 'Exceeds release criterion',
  };

  // 9. Post-treatment Turbidity Sensor
  const postTurbConfig = SENSOR_CONFIG['sensor-turb-post'];
  const postTurbValue = Number(postTurbidityNtu.toFixed(1));
  const postTurbSeverity = evaluateAlarmSeverity(postTurbValue, postTurbConfig.alarmThresholds);

  const readingTurbPost: TelemetryReading = {
    sensorId: 'sensor-turb-post',
    displayName: 'Post-Treatment Turbidity Sensor',
    value: postTurbValue,
    formattedValue: `${postTurbValue.toFixed(1)} NTU`,
    unit: 'NTU',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: postTurbSeverity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: postTurbConfig.operatingRange,
    alarmThresholds: postTurbConfig.alarmThresholds,
    notes: postTurbValue <= 5.0 ? 'Meets release criterion (<= 5.0 NTU)' : 'Exceeds release criterion',
  };

  // 10. AC Motor Induction telemetry
  const motorConfig = SENSOR_CONFIG['motor'];
  const motorValue = Number(motorA.toFixed(1));
  const motorSeverity = evaluateAlarmSeverity(motorValue, motorConfig.alarmThresholds);

  const readingMotor: TelemetryReading = {
    sensorId: 'motor',
    displayName: 'Pump AC Induction Motor',
    value: motorValue,
    formattedValue: `${motorValue.toFixed(1)} A`,
    unit: 'A',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: motorSeverity,
    connectionState: 'simulated_online',
    faultOrigin,
    operatingRange: motorConfig.operatingRange,
    alarmThresholds: motorConfig.alarmThresholds,
    notes: `Shaft velocity: ${motorRpm} RPM. Inferred electro-mechanical model.`,
  };

  // 11. Equipment Telemetry (Tank, Pump, ESP32, Valves, Pipes)
  const readingTank: TelemetryReading = {
    sensorId: 'tank',
    displayName: 'Water Storage Reservoir',
    value: Number(volumeL.toFixed(2)),
    formattedValue: `${volumeL.toFixed(1)} L`,
    unit: 'L',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: us01Severity,
    connectionState: 'simulated_online',
    faultOrigin,
    notes: `Calculated capacity: ${percentage.toFixed(1)}% full.`,
  };

  const readingPump: TelemetryReading = {
    sensorId: 'pump',
    displayName: 'Centrifugal Pump Head',
    value: pt01Value,
    formattedValue: `${pt01Value.toFixed(2)} bar`,
    unit: 'bar',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: pt01Severity,
    connectionState: 'simulated_online',
    faultOrigin,
    notes: `Discharge head generated across impeller at ${motorRpm} RPM.`,
  };

  const readingController: TelemetryReading = {
    sensorId: 'controller-esp32',
    displayName: 'ESP32 Dual-Core Controller',
    value: 240,
    formattedValue: '240 MHz (Nominal)',
    unit: '%',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: 'normal',
    connectionState: 'simulated_online',
    faultOrigin,
    notes: 'Deterministic digital twin telemetry engine.',
  };

  const readingV1: TelemetryReading = {
    sensorId: 'valve-v1',
    displayName: 'Suction Isolation Valve V1',
    value: v1Open,
    formattedValue: `${v1Open}% Open`,
    unit: '%',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: v1Open < 100 ? 'warning' : 'normal',
    connectionState: 'simulated_online',
    faultOrigin,
  };

  const readingV2: TelemetryReading = {
    sensorId: 'valve-v2',
    displayName: 'Delivery Valve V2',
    value: v2Open,
    formattedValue: `${v2Open}% Open`,
    unit: '%',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: v2Open < 100 ? 'warning' : 'normal',
    connectionState: 'simulated_online',
    faultOrigin,
  };

  const readingPipeMain: TelemetryReading = {
    sensorId: 'pipe-main',
    displayName: 'Primary Discharge Pipeline',
    value: Number(primaryFlowLpm.toFixed(1)),
    formattedValue: `${primaryFlowLpm.toFixed(1)} L/min`,
    unit: 'L/min',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: fs01Severity,
    connectionState: 'simulated_online',
    faultOrigin,
  };

  const readingPipeBypass: TelemetryReading = {
    sensorId: 'pipe-bypass',
    displayName: 'Sampling Bypass Loop',
    value: Number((primaryFlowLpm * 0.15).toFixed(1)),
    formattedValue: `${(primaryFlowLpm * 0.15).toFixed(1)} L/min`,
    unit: 'L/min',
    timestamp,
    source: 'simulated',
    validity: 'valid',
    severity: 'normal',
    connectionState: 'simulated_online',
    faultOrigin,
  };

  return {
    'tank': readingTank,
    'pump': readingPump,
    'controller-esp32': readingController,
    'valve-v1': readingV1,
    'valve-v2': readingV2,
    'pipe-main': readingPipeMain,
    'pipe-bypass': readingPipeBypass,
    'sensor-us01': readingUs01,
    'sensor-fs01': readingFs01,
    'sensor-fs02': readingFs02,
    'sensor-pt01': readingPt01,
    'sensor-pt02': readingPt02,
    'sensor-tds01': readingTds01,
    'sensor-turb01': readingTurb01,
    'sensor-tds-post': readingTdsPost,
    'sensor-turb-post': readingTurbPost,
    'motor': readingMotor,
  };
}
