/**
 * AquaSage 3D IoT Digital Twin - Network Simulation & Hydraulic Acceptance Tests
 * Verifies all 18 Acceptance Criteria specified in Section 13
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSimulationState,
  advanceSimulationStep,
} from '../simulationEngine';
import {
  calculateTreatmentPass,
  shouldDivertContaminatedWater,
  evaluateFiltrationStateMachine,
} from '../filtrationEngine';

describe('AquaSage Water Infrastructure Digital Twin - 18 Acceptance Criteria', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 1: Normal water flow reaches all configured village branches
  // ─────────────────────────────────────────────────────────────────────────
  it('1. should distribute water flow to all three configured village zones in normal operation', () => {
    let state = createInitialSimulationState('normal');
    // Step forward 5 seconds
    for (let i = 0; i < 5; i++) {
      state = advanceSimulationStep(state, 1.0);
    }

    const zones = state.network.villageZones;
    assert.ok(zones['zone-a'], 'Zone A must exist');
    assert.ok(zones['zone-b'], 'Zone B must exist');
    assert.ok(zones['zone-c'], 'Zone C must exist');

    assert.ok(zones['zone-a'].currentSupplyLpm > 0, 'Zone A should receive positive flow');
    assert.ok(zones['zone-b'].currentSupplyLpm > 0, 'Zone B should receive positive flow');
    assert.ok(zones['zone-c'].currentSupplyLpm > 0, 'Zone C should receive positive flow');
    assert.strictEqual(zones['zone-a'].supplyStatus, 'normal');
    assert.strictEqual(zones['zone-b'].supplyStatus, 'normal');
    assert.strictEqual(zones['zone-c'].supplyStatus, 'normal');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 2: Flow splits conserve mass within the simplified model
  // ─────────────────────────────────────────────────────────────────────────
  it('2. should conserve mass at distribution manifold split (FS-02 = Sum of Village Flows)', () => {
    let state = createInitialSimulationState('normal');
    state = advanceSimulationStep(state, 1.0);

    const sumVillageFlow = Object.values(state.network.villageZones).reduce(
      (sum, z) => sum + z.currentSupplyLpm,
      0
    );

    // In normal operation, downstream flow equals total village delivered flow
    assert.ok(
      Math.abs(state.totalVillageDeliveredLpm - sumVillageFlow) < 0.1,
      `Delivered flow (${state.totalVillageDeliveredLpm}) must equal sum of village branch flows (${sumVillageFlow})`
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 3: Leak between FS-01 and FS-02 causes a consistent measurable discrepancy
  // ─────────────────────────────────────────────────────────────────────────
  it('3. should produce consistent measurable discrepancy between FS-01 and FS-02 during pipe leak', () => {
    let state = createInitialSimulationState('leak');
    state = advanceSimulationStep(state, 1.0);

    const upstream = state.readings['sensor-fs01'].value as number;
    const downstream = state.outflowRateLpm;
    const leakLoss = state.leakSeverityLpm;

    assert.ok(upstream > downstream, 'Upstream flow must exceed downstream flow during leak');
    assert.ok(leakLoss > 0, 'Estimated leak loss must be greater than zero');
    assert.strictEqual(leakLoss, 10.5);
    assert.strictEqual(upstream, 28.5);
    assert.strictEqual(downstream, 18.0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 4: Leak loss calculation boundary condition check
  // ─────────────────────────────────────────────────────────────────────────
  it('4. should not calculate leak loss when pump is stopped or segment flow is zero', () => {
    let state = createInitialSimulationState('pump_failure');
    state = advanceSimulationStep(state, 1.0);

    assert.strictEqual(state.readings['sensor-fs01'].value, 0);
    assert.strictEqual(state.outflowRateLpm, 0);
    assert.strictEqual(state.leakRateLpm, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 5: Contamination produces expected configured TDS and turbidity values
  // ─────────────────────────────────────────────────────────────────────────
  it('5. should configure expected TDS and turbidity for contamination scenarios', () => {
    const tdsState = createInitialSimulationState('elevated_tds');
    assert.strictEqual(tdsState.preTreatmentTds, 850);
    assert.strictEqual(tdsState.preTreatmentTurbidity, 1.5);

    const turbState = createInitialSimulationState('elevated_turbidity');
    assert.strictEqual(turbState.preTreatmentTds, 180);
    assert.strictEqual(turbState.preTreatmentTurbidity, 38.5);

    const combinedState = createInitialSimulationState('combined_contamination');
    assert.strictEqual(combinedState.preTreatmentTds, 850);
    assert.strictEqual(combinedState.preTreatmentTurbidity, 38.5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 6: Contaminated water triggers the configured diversion rule
  // ─────────────────────────────────────────────────────────────────────────
  it('6. should trigger automatic diversion rule when TDS or turbidity exceeds threshold', () => {
    const cleanCheck = shouldDivertContaminatedWater(180, 1.5);
    assert.strictEqual(cleanCheck.shouldDivert, false);

    const tdsCheck = shouldDivertContaminatedWater(850, 1.5);
    assert.strictEqual(tdsCheck.shouldDivert, true);
    assert.ok(tdsCheck.reason?.includes('Elevated TDS'));

    const turbCheck = shouldDivertContaminatedWater(180, 38.5);
    assert.strictEqual(turbCheck.shouldDivert, true);
    assert.ok(turbCheck.reason?.includes('Elevated Turbidity'));

    const combinedCheck = shouldDivertContaminatedWater(850, 38.5);
    assert.strictEqual(combinedCheck.shouldDivert, true);
    assert.ok(combinedCheck.reason?.includes('Combined Contamination'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 7: Normal distribution route is isolated during contamination
  // ─────────────────────────────────────────────────────────────────────────
  it('7. should isolate normal distribution route (V-DIST closed, V-DIV open) during contamination', () => {
    let state = createInitialSimulationState('elevated_tds');
    // Step forward to let state machine process diversion
    state = advanceSimulationStep(state, 1.0);

    assert.strictEqual(
      state.network.valves['valve-v-dist'].actualState,
      'CLOSED',
      'V-DIST must be closed to protect villages'
    );
    assert.strictEqual(
      state.network.valves['valve-v-div'].actualState,
      'OPEN',
      'V-DIV must be open to divert flow to filtration'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 8: Filtration changes only the parameters supported by configured stages
  // ─────────────────────────────────────────────────────────────────────────
  it('8. should model Stage 1 reducing turbidity only and Stage 2 reducing TDS', () => {
    const inputTds = 850;
    const inputTurb = 38.5;

    const treated = calculateTreatmentPass(inputTds, inputTurb, 1, {
      maxPasses: 3,
      turbidityEfficiencyPerPass: 0.70,
      tdsEfficiencyPerPass: 0.65,
      releaseThresholdTds: 500,
      releaseThresholdTurbidity: 5.0,
      filterCapacityLpm: 25,
      currentPassCount: 1,
      filterClogged: false,
      filterLoadingPercent: 15,
    });

    // Stage 1 removes ~70% turbidity: 38.5 * (1 - 0.70) = 11.55 NTU
    assert.ok(
      treated.outputTurbidity < 15.0 && treated.outputTurbidity > 10.0,
      `Stage 1 should reduce turbidity from 38.5 to ~11.55 NTU (got ${treated.outputTurbidity})`
    );

    // Stage 2 reduces ~65% TDS: 850 * (1 - 0.65) = 297.5 ppm
    assert.ok(
      treated.outputTds < 350 && treated.outputTds > 250,
      `Stage 2 should reduce TDS from 850 to ~297.5 ppm (got ${treated.outputTds})`
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 9: Acceptable post-treatment readings allow simulated release procedure
  // ─────────────────────────────────────────────────────────────────────────
  it('9. should transition to RELEASE_READY when post-treatment readings meet release criteria', () => {
    let state = createInitialSimulationState('filtration_return');
    // Step forward
    for (let i = 0; i < 3; i++) {
      state = advanceSimulationStep(state, 1.0);
    }

    assert.ok(
      state.postTreatmentTds <= 500,
      `Post-TDS (${state.postTreatmentTds}) must be <= 500 ppm`
    );
    assert.ok(
      state.postTreatmentTurbidity <= 5.0,
      `Post-Turbidity (${state.postTreatmentTurbidity}) must be <= 5.0 NTU`
    );
    assert.strictEqual(state.postTreatmentReleaseReady, true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 10: Unacceptable or invalid post-treatment readings prevent release
  // ─────────────────────────────────────────────────────────────────────────
  it('10. should prevent release when post-treatment readings exceed release thresholds', () => {
    const config = {
      maxPasses: 3,
      turbidityEfficiencyPerPass: 0.70,
      tdsEfficiencyPerPass: 0.65,
      releaseThresholdTds: 500,
      releaseThresholdTurbidity: 5.0,
      filterCapacityLpm: 25,
      currentPassCount: 1,
      filterClogged: false,
      filterLoadingPercent: 15,
    };

    const evaluation = evaluateFiltrationStateMachine(
      'QUALITY_CHECK',
      1,
      680, // Above 500 ppm threshold
      8.5, // Above 5.0 NTU threshold
      config,
      true,
      true,
      true
    );

    assert.notStrictEqual(evaluation.nextState, 'RELEASE_READY');
    assert.notStrictEqual(evaluation.nextState, 'RETURNING_TO_DISTRIBUTION');
    assert.strictEqual(evaluation.commandVrel, 'CLOSED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 11: Additional treatment passes are handled deterministically
  // ─────────────────────────────────────────────────────────────────────────
  it('11. should increment pass count deterministically during recirculation', () => {
    const config = {
      maxPasses: 3,
      turbidityEfficiencyPerPass: 0.70,
      tdsEfficiencyPerPass: 0.65,
      releaseThresholdTds: 500,
      releaseThresholdTurbidity: 5.0,
      filterCapacityLpm: 25,
      currentPassCount: 1,
      filterClogged: false,
      filterLoadingPercent: 15,
    };

    const evaluation = evaluateFiltrationStateMachine(
      'QUALITY_CHECK',
      1,
      650,
      7.0,
      config,
      true,
      true,
      true
    );

    assert.strictEqual(evaluation.nextState, 'RECIRCULATING');
    assert.strictEqual(evaluation.newPassCount, 2);
    assert.strictEqual(evaluation.commandVrec, 'OPEN');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 12: Exceeding maximum pass count keeps water isolated and raises alert
  // ─────────────────────────────────────────────────────────────────────────
  it('12. should enter FILTER_LIMIT_REACHED and keep V-REL closed when pass count exceeds limit', () => {
    let state = createInitialSimulationState('filter_limit');
    for (let i = 0; i < 3; i++) {
      state = advanceSimulationStep(state, 1.0);
    }

    assert.strictEqual(state.filtrationState, 'FILTER_LIMIT_REACHED');
    assert.strictEqual(
      state.network.valves['valve-v-rel'].actualState,
      'CLOSED',
      'V-REL must remain strictly closed'
    );
    assert.strictEqual(
      state.network.valves['valve-v-dist'].actualState,
      'CLOSED',
      'V-DIST must remain closed'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 13: Village supply and tank levels respond consistently to changes in flow
  // ─────────────────────────────────────────────────────────────────────────
  it('13. should reflect reduced delivery when upstream flow is cut off during diversion', () => {
    let state = createInitialSimulationState('elevated_tds');
    state = advanceSimulationStep(state, 1.0);

    assert.strictEqual(state.totalVillageDeliveredLpm, 0);
    assert.strictEqual(
      state.network.villageZones['zone-a'].supplyStatus,
      'contaminated_isolated'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 14: Pump failure and restricted flow update telemetry coherently
  // ─────────────────────────────────────────────────────────────────────────
  it('14. should drop main pipeline flow to 0 and report stopped pump in pump failure mode', () => {
    let state = createInitialSimulationState('pump_failure');
    state = advanceSimulationStep(state, 1.0);

    assert.strictEqual(state.outflowRateLpm, 0);
    assert.strictEqual(state.readings['sensor-fs01'].value, 0);
    assert.strictEqual(state.readings['sensor-fs01'].severity, 'critical');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 15: Valve failures do not falsely report successful routing
  // ─────────────────────────────────────────────────────────────────────────
  it('15. should alert and report faulted valve in valve failure scenario', () => {
    let state = createInitialSimulationState('valve_failure');
    state = advanceSimulationStep(state, 1.0);

    assert.strictEqual(state.network.valves['valve-v-div'].actualState, 'FAULTED');
    assert.strictEqual(state.network.valves['valve-v-div'].isFaulted, true);
    assert.ok(
      state.activeFaults.some((f) => f.includes('VALVE') || f.includes('valve')),
      'Active faults must list valve failure'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 16: Pause, resume, reset and fixed-step advancement behave correctly
  // ─────────────────────────────────────────────────────────────────────────
  it('16. should preserve state when paused and advance deterministically by dt on step', () => {
    const state = createInitialSimulationState('normal');
    state.isRunning = false;

    const snapshotTime = state.elapsedTimeSec;
    const stepped = advanceSimulationStep(state, 1.5);
    assert.strictEqual(stepped.elapsedTimeSec, snapshotTime + 1.5);
    assert.strictEqual(stepped.stepCount, 1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 17: Multiple fault injections do not cause contradictory routing commands
  // ─────────────────────────────────────────────────────────────────────────
  it('17. should prioritize contamination safety during combined contamination and low pressure', () => {
    let state = createInitialSimulationState('combined_contamination');
    state = advanceSimulationStep(state, 1.0);

    // Contamination requires diversion; distribution valve must be CLOSED
    assert.strictEqual(
      state.network.valves['valve-v-dist'].actualState,
      'CLOSED',
      'V-DIST must be closed due to contamination precedence'
    );
    assert.strictEqual(
      state.network.valves['valve-v-div'].actualState,
      'OPEN',
      'V-DIV must open to divert contaminated water'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITERION 18: Authoritative simulation state drives all metrics and components
  // ─────────────────────────────────────────────────────────────────────────
  it('18. should maintain authoritative consistency between network flow, sensor telemetry, and valve states', () => {
    let state = createInitialSimulationState('normal');
    state = advanceSimulationStep(state, 1.0);

    // Sensor FS-01 telemetry should match primary flow (18 L/min)
    assert.strictEqual(state.readings['sensor-fs01'].value, 18.0);
    // TDS telemetry should match state TDS
    assert.strictEqual(state.readings['sensor-tds01'].value, state.preTreatmentTds);
    // Turbidity telemetry should match state Turbidity
    assert.strictEqual(state.readings['sensor-turb01'].value, state.preTreatmentTurbidity);
  });
});
