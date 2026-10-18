/**
 * AquaSage 3D IoT Digital Twin - Simulation Engine Unit Tests
 * Executed via Node.js native test runner (node --experimental-strip-types --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateTankVolume,
  calculateWaterHeightFromVolume,
  calculateLevelPercentage,
  evaluateAlarmSeverity,
  createInitialSimulationState,
  advanceSimulationStep,
} from '../simulationEngine';
import { TANK_PHYSICAL_CONSTANTS, SENSOR_CONFIG } from '../thresholdConfig';

describe('AquaSage Deterministic IoT Simulation Engine', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Initial tank level, percentage, and volume
  // ─────────────────────────────────────────────────────────────────────────
  it('1. should calculate initial tank baseline accurately (0.75m -> 187.5 L -> 75%)', () => {
    const heightM = 0.75;
    const volumeL = calculateTankVolume(heightM);
    const percentage = calculateLevelPercentage(heightM);

    assert.strictEqual(volumeL, 187.51); // π * (0.2821)² * 0.75 * 1000 = 187.508 L (~187.51 L)
    assert.strictEqual(percentage, 75.0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Volume calculation and valid height boundaries
  // ─────────────────────────────────────────────────────────────────────────
  it('2. should enforce height boundaries and calculate volume inversely', () => {
    // Zero height
    assert.strictEqual(calculateTankVolume(0), 0);

    // Full usable height (1.0m)
    const fullUsableVolume = calculateTankVolume(1.0);
    assert.strictEqual(Math.round(fullUsableVolume), TANK_PHYSICAL_CONSTANTS.USABLE_CAPACITY_LITRES);

    // Clamping negative height to 0
    assert.strictEqual(calculateTankVolume(-0.5), 0);

    // Inverse height from volume
    const heightFromVol = calculateWaterHeightFromVolume(187.51);
    assert.strictEqual(Number(heightFromVol.toFixed(2)), 0.75);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Volume changes over fixed simulation steps
  // ─────────────────────────────────────────────────────────────────────────
  it('3. should deterministically advance volume over fixed simulation steps', () => {
    const initialState = createInitialSimulationState('low_level');
    // low_level initial: inflow = 6 L/min, outflow = 21 L/min -> net = -15 L/min (-0.25 L/s)
    const startVolume = initialState.tankVolumeLitres;

    // Step 1: 1 second
    const step1 = advanceSimulationStep(initialState, 1.0);
    const expectedVolume1 = Number((startVolume - 0.25).toFixed(2));
    assert.strictEqual(step1.tankVolumeLitres, expectedVolume1);
    assert.strictEqual(step1.stepCount, 1);
    assert.strictEqual(step1.elapsedTimeSec, 1.0);

    // Step 2: 10 seconds total from step 1
    const step10 = advanceSimulationStep(step1, 9.0);
    const expectedVolume10 = Number((startVolume - 2.50).toFixed(2));
    assert.strictEqual(step10.tankVolumeLitres, expectedVolume10);
    assert.strictEqual(step10.stepCount, 2);
    assert.strictEqual(step10.elapsedTimeSec, 10.0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Flow and tank mass-balance consistency
  // ─────────────────────────────────────────────────────────────────────────
  it('4. should maintain exact mass balance consistency (Net = Inflow - Outflow - Leak)', () => {
    const leakState = createInitialSimulationState('leak');
    // Leak scenario: Inflow = 18 L/min, Outflow = 18 L/min, Leak = 10.5 L/min
    const expectedNet = Number((18.0 - 18.0 - 10.5).toFixed(2));
    assert.strictEqual(leakState.netFlowRateLpm, expectedNet);
    assert.strictEqual(leakState.netFlowRateLpm, -10.5);

    // After 60 seconds (1 minute), volume must decrease by exactly 10.5 Litres
    const stateAfter60s = advanceSimulationStep(leakState, 60.0);
    const volumeDelta = Number((leakState.tankVolumeLitres - stateAfter60s.tankVolumeLitres).toFixed(2));
    assert.strictEqual(volumeDelta, 10.5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: Reproducible scenario initial states
  // ─────────────────────────────────────────────────────────────────────────
  it('5. should reproduce identical initial states across repeated calls', () => {
    const stateA = createInitialSimulationState('normal');
    const stateB = createInitialSimulationState('normal');

    assert.deepStrictEqual(stateA, stateB);

    const stepA = advanceSimulationStep(stateA, 5.0);
    const stepB = advanceSimulationStep(stateB, 5.0);

    assert.deepStrictEqual(stepA, stepB);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: Pause, resume, and reset behaviour
  // ─────────────────────────────────────────────────────────────────────────
  it('6. should properly support resetting to scenario baseline', () => {
    const state = createInitialSimulationState('leak');
    const advanced = advanceSimulationStep(state, 30.0);

    assert.notStrictEqual(advanced.tankVolumeLitres, state.tankVolumeLitres);
    assert.strictEqual(advanced.stepCount, 1);

    // Resetting regenerates the initial state
    const resetState = createInitialSimulationState(advanced.scenarioId);
    assert.strictEqual(resetState.tankVolumeLitres, state.tankVolumeLitres);
    assert.strictEqual(resetState.stepCount, 0);
    assert.strictEqual(resetState.elapsedTimeSec, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: Invalid or unavailable measurements
  // ─────────────────────────────────────────────────────────────────────────
  it('7. should represent unavailable measurements as null, not zero', () => {
    const state = createInitialSimulationState('sensor_fault');
    const flowReading = state.readings['sensor-fs01'];

    assert.strictEqual(flowReading.validity, 'unavailable');
    assert.strictEqual(flowReading.value, null);
    assert.notStrictEqual(flowReading.value, 0); // Must not silently convert to 0!
    assert.strictEqual(flowReading.formattedValue, 'UNAVAILABLE');
    assert.strictEqual(flowReading.severity, 'unknown');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: Separation of measurement validity, severity, and connection state
  // ─────────────────────────────────────────────────────────────────────────
  it('8. should completely separate validity, severity, and connection state', () => {
    const state = createInitialSimulationState('sensor_fault');
    const flowReading = state.readings['sensor-fs01'];

    assert.strictEqual(flowReading.source, 'simulated');
    assert.strictEqual(flowReading.validity, 'unavailable');
    assert.strictEqual(flowReading.severity, 'unknown');
    assert.strictEqual(flowReading.connectionState, 'simulated_disconnected');

    // In normal state:
    const normalState = createInitialSimulationState('normal');
    const normalFlow = normalState.readings['sensor-fs01'];
    assert.strictEqual(normalFlow.validity, 'valid');
    assert.strictEqual(normalFlow.severity, 'normal');
    assert.strictEqual(normalFlow.connectionState, 'simulated_online');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: Threshold-boundary behaviour
  // ─────────────────────────────────────────────────────────────────────────
  it('9. should correctly evaluate warning and critical threshold boundaries', () => {
    const thresholds = {
      criticalLow: 10.0,
      warningLow: 25.0,
      warningHigh: 90.0,
      criticalHigh: 98.0,
    };

    assert.strictEqual(evaluateAlarmSeverity(5.0, thresholds), 'critical'); // Below criticalLow
    assert.strictEqual(evaluateAlarmSeverity(15.0, thresholds), 'warning'); // Between criticalLow and warningLow
    assert.strictEqual(evaluateAlarmSeverity(50.0, thresholds), 'normal');  // Nominal
    assert.strictEqual(evaluateAlarmSeverity(95.0, thresholds), 'warning'); // Between warningHigh and criticalHigh
    assert.strictEqual(evaluateAlarmSeverity(99.0, thresholds), 'critical'); // Above criticalHigh
    assert.strictEqual(evaluateAlarmSeverity(null, thresholds), 'unknown');  // Null
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10: Out-of-operating-range flow readings
  // ─────────────────────────────────────────────────────────────────────────
  it('10. should flag readings exceeding the physical sensor operating range', () => {
    // Normal flow (18 L/min) is within 1.0 - 30.0 L/min
    const normalState = createInitialSimulationState('normal');
    const normalFlow = normalState.readings['sensor-fs01'];
    assert.strictEqual(normalFlow.isOutOfOperatingRange, false);

    // Initial state during leak where flow is 28.5 L/min (high warning, but within 30 L/min range)
    const leakState = createInitialSimulationState('leak');
    const leakFlow = leakState.readings['sensor-fs01'];
    assert.strictEqual(leakFlow.value, 28.5);
    assert.strictEqual(leakFlow.severity, 'warning'); // > 25.0 L/min warning threshold
    assert.strictEqual(leakFlow.isOutOfOperatingRange, false); // Still within 30 L/min physical rating

    // When flow exceeds physical sensor rating (> 30.0 L/min), isOutOfOperatingRange must be true
    const customBurstState = {
      ...normalState,
      outflowRateLpm: 33.0,
      leakRateLpm: 0.0,
    };
    const burstStep = advanceSimulationStep(customBurstState, 1.0);
    const burstFlow = burstStep.readings['sensor-fs01'];
    assert.strictEqual(burstFlow.value, 33.0);
    assert.strictEqual(burstFlow.isOutOfOperatingRange, true);
    assert.strictEqual(burstFlow.severity, 'critical'); // Exceeds critical threshold (> 32 L/min)
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 11: No false physical-connection or physical-fault claims in simulation mode
  // ─────────────────────────────────────────────────────────────────────────
  it('11. should never claim physical connection or physical fault in simulated telemetry', () => {
    const state = createInitialSimulationState('restricted_flow');

    for (const [key, reading] of Object.entries(state.readings)) {
      assert.strictEqual(reading.source, 'simulated', `Reading ${key} must have source = 'simulated'`);
      assert.notStrictEqual(reading.faultOrigin, 'physical_detected', `Reading ${key} must not claim physical detection`);
      assert.notStrictEqual(reading.connectionState, 'offline', `Reading ${key} must not be unmanaged offline`);
    }

    assert.strictEqual(state.readings['controller-esp32'].source, 'simulated');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 12: Consistent telemetry values between engine and state
  // ─────────────────────────────────────────────────────────────────────────
  it('12. should maintain complete consistency between hydraulic state and telemetry readings', () => {
    const state = createInitialSimulationState('normal');

    // Volume in tank reading matches engine tankVolumeLitres
    assert.strictEqual(state.readings['tank'].value, state.tankVolumeLitres);

    // Ultrasonic height reading in cm matches tankWaterHeight in m * 100
    assert.strictEqual(
      state.readings['sensor-us01'].value,
      Number((state.tankWaterHeight * 100).toFixed(1))
    );

    // Flow sensor reading matches primary flow
    assert.strictEqual(state.readings['sensor-fs01'].value, 18.0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 13: TDS exact boundary evaluations (499, 500, 501, 799, 800, 801, 850)
  // ─────────────────────────────────────────────────────────────────────────
  it('13. should evaluate TDS threshold boundaries with mathematical precision', () => {
    const tdsThresholds = SENSOR_CONFIG['sensor-tds01'].alarmThresholds;
    // Configured thresholds: warningHigh = 500, criticalHigh = 800

    assert.strictEqual(evaluateAlarmSeverity(499, tdsThresholds), 'normal');
    assert.strictEqual(evaluateAlarmSeverity(500, tdsThresholds), 'normal'); // boundary > 500
    assert.strictEqual(evaluateAlarmSeverity(501, tdsThresholds), 'warning');
    assert.strictEqual(evaluateAlarmSeverity(650, tdsThresholds), 'warning');
    assert.strictEqual(evaluateAlarmSeverity(799, tdsThresholds), 'warning');
    assert.strictEqual(evaluateAlarmSeverity(800, tdsThresholds), 'warning'); // boundary > 800
    assert.strictEqual(evaluateAlarmSeverity(801, tdsThresholds), 'critical');
    assert.strictEqual(evaluateAlarmSeverity(850, tdsThresholds), 'critical'); // Scenario value
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 14: Turbidity exact boundary evaluations (4.9, 5.0, 5.1, 24.9, 25.0, 25.1, 38.5)
  // ─────────────────────────────────────────────────────────────────────────
  it('14. should evaluate Turbidity threshold boundaries with mathematical precision', () => {
    const turbThresholds = SENSOR_CONFIG['sensor-turb01'].alarmThresholds;
    // Configured thresholds: warningHigh = 5.0, criticalHigh = 25.0

    assert.strictEqual(evaluateAlarmSeverity(4.9, turbThresholds), 'normal');
    assert.strictEqual(evaluateAlarmSeverity(5.0, turbThresholds), 'normal'); // boundary > 5.0
    assert.strictEqual(evaluateAlarmSeverity(5.1, turbThresholds), 'warning');
    assert.strictEqual(evaluateAlarmSeverity(15.0, turbThresholds), 'warning');
    assert.strictEqual(evaluateAlarmSeverity(24.9, turbThresholds), 'warning');
    assert.strictEqual(evaluateAlarmSeverity(25.0, turbThresholds), 'warning'); // boundary > 25.0
    assert.strictEqual(evaluateAlarmSeverity(25.1, turbThresholds), 'critical');
    assert.strictEqual(evaluateAlarmSeverity(38.5, turbThresholds), 'critical'); // Scenario value
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 15: Leak scenario hydraulic topology trace
  // ─────────────────────────────────────────────────────────────────────────
  it('15. should verify mutual consistency of FS-01 flow, pressures, and mass balance in leak scenario', () => {
    const leakState = createInitialSimulationState('leak');

    // 1. Inflow, Outflow, and Leak rates
    assert.strictEqual(leakState.inflowRateLpm, 18.0);
    assert.strictEqual(leakState.outflowRateLpm, 18.0);
    assert.strictEqual(leakState.leakRateLpm, 10.5);

    // 2. Net flow deficit: 18.0 - 18.0 - 10.5 = -10.5 L/min
    assert.strictEqual(leakState.netFlowRateLpm, -10.5);

    // 3. Primary flow at FS-01 (upstream of breach) = outflow + leak = 28.5 L/min
    assert.strictEqual(leakState.readings['sensor-fs01'].value, 28.5);
    assert.strictEqual(leakState.readings['sensor-fs01'].severity, 'warning'); // > 25.0 L/min warning
    assert.strictEqual(leakState.readings['sensor-fs01'].isOutOfOperatingRange, false); // <= 30.0 L/min envelope

    // 4. Downstream pressure P2 collapses due to loss of resistance
    assert.strictEqual(leakState.readings['sensor-pt02'].value, 0.60);
    assert.strictEqual(leakState.readings['sensor-pt02'].severity, 'warning'); // < 1.00 bar warning

    // 5. Mass-balance over 60 seconds: deltaV = -10.5 * (60 / 60) = -10.5 L
    let currentState = leakState;
    for (let i = 0; i < 60; i++) {
      currentState = advanceSimulationStep(currentState, 1.0);
    }
    const expectedVolume = Number((leakState.tankVolumeLitres - 10.5).toFixed(2));
    assert.strictEqual(currentState.tankVolumeLitres, expectedVolume);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 16: Zero-volume empty-tank boundaries & dry cavitation
  // ─────────────────────────────────────────────────────────────────────────
  it('16. should enforce empty-tank physical boundaries and dry pump cavitation', () => {
    // 1. Boundary calculations at 0 height
    assert.strictEqual(calculateTankVolume(0), 0);
    assert.strictEqual(calculateLevelPercentage(0), 0.0);

    // 2. Negative height clamps safely to 0
    assert.strictEqual(calculateTankVolume(-0.2), 0);
    assert.strictEqual(calculateLevelPercentage(-0.1), 0.0);

    // 3. Dry tank state triggering pump cavitation
    const dryState = {
      ...createInitialSimulationState('low_level'),
      tankWaterHeight: 0.04, // Below 0.05m dry threshold
      tankVolumeLitres: 10.0,
    };
    const stepAfterDry = advanceSimulationStep(dryState, 1.0);

    // Cavitating pump: flow drops to 0, head pressure collapses, motor unloaded
    assert.strictEqual(stepAfterDry.readings['sensor-fs01'].value, 0.0);
    assert.strictEqual(stepAfterDry.readings['sensor-pt01'].value, 0.20);
    assert.strictEqual(stepAfterDry.readings['sensor-pt02'].value, 0.00);
    assert.strictEqual(stepAfterDry.readings['motor'].value, 1.2);
    assert.strictEqual(stepAfterDry.readings['motor'].severity, 'warning'); // < 1.5A unloaded warning
  });
});
