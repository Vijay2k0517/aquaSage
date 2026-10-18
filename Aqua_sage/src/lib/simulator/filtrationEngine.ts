/**
 * AquaSage 3D IoT Digital Twin - Filtration & Diversion Control Engine
 *
 * Implements deterministic multi-pass treatment models, automated diversion
 * state machine, and verified post-treatment release logic.
 */

import { FiltrationState, FiltrationSystemConfig } from './networkTopology';

export interface TreatmentResult {
  inputTds: number;
  inputTurbidity: number;
  outputTds: number;
  outputTurbidity: number;
  passNumber: number;
  releaseCriteriaMet: boolean;
  filterLoadingIncreasePercent: number;
  notes: string;
}

/**
 * Calculates deterministic multi-stage water treatment results
 * Stage 1: Dual-media sand/anthracite removes suspended particles (turbidity)
 * Stage 2: Reverse Osmosis / Ion-Exchange reduces dissolved solids (TDS)
 */
export function calculateTreatmentPass(
  inputTds: number,
  inputTurbidity: number,
  passNumber: number,
  config: FiltrationSystemConfig
): TreatmentResult {
  // If filter is clogged, treatment efficiency degrades drastically
  const efficiencyMultiplier = config.filterClogged ? 0.25 : 1.0;

  // Stage 1: Turbidity reduction (does NOT remove dissolved ions)
  const effTurb = config.turbidityEfficiencyPerPass * efficiencyMultiplier;
  const rawOutputTurbidity = inputTurbidity * (1 - effTurb);
  const outputTurbidity = Number(Math.max(0.8, rawOutputTurbidity).toFixed(2));

  // Stage 2: TDS reduction via RO/Ion-Exchange
  const effTds = config.tdsEfficiencyPerPass * efficiencyMultiplier;
  const rawOutputTds = inputTds * (1 - effTds);
  const outputTds = Number(Math.max(120, rawOutputTds).toFixed(1));

  // Release criteria: TDS <= releaseThresholdTds AND Turbidity <= releaseThresholdTurbidity
  const releaseCriteriaMet =
    outputTds <= config.releaseThresholdTds &&
    outputTurbidity <= config.releaseThresholdTurbidity;

  const filterLoadingIncrease = config.filterClogged ? 2.0 : 8.0;

  let notes = '';
  if (releaseCriteriaMet) {
    notes = `Pass ${passNumber} satisfied release criteria (${outputTds} ppm, ${outputTurbidity} NTU). Certified release ready.`;
  } else {
    notes = `Pass ${passNumber} effluent (${outputTds} ppm, ${outputTurbidity} NTU) exceeds release thresholds. Recirculation required.`;
  }

  return {
    inputTds,
    inputTurbidity,
    outputTds,
    outputTurbidity,
    passNumber,
    releaseCriteriaMet,
    filterLoadingIncreasePercent: filterLoadingIncrease,
    notes,
  };
}

/**
 * Evaluates whether water parcel breaches diversion criteria
 */
export function shouldDivertContaminatedWater(
  tdsPpm: number,
  turbidityNtu: number,
  tdsThreshold: number = 500.0,
  turbidityThreshold: number = 5.0
): { shouldDivert: boolean; reason?: string } {
  const isHighTds = tdsPpm > tdsThreshold;
  const isHighTurbidity = turbidityNtu > turbidityThreshold;

  if (isHighTds && isHighTurbidity) {
    return {
      shouldDivert: true,
      reason: `Combined Contamination: TDS ${tdsPpm} ppm (>500) and Turbidity ${turbidityNtu} NTU (>5.0)`,
    };
  }
  if (isHighTds) {
    return {
      shouldDivert: true,
      reason: `Elevated TDS: ${tdsPpm} ppm breaches 500 ppm aesthetic/mineral threshold`,
    };
  }
  if (isHighTurbidity) {
    return {
      shouldDivert: true,
      reason: `Elevated Turbidity: ${turbidityNtu} NTU breaches 5.0 NTU clarity threshold`,
    };
  }

  return { shouldDivert: false };
}

/**
 * Deterministic State Machine for Automated Diversion and Multi-Pass Filtration
 */
export function evaluateFiltrationStateMachine(
  currentState: FiltrationState,
  passCount: number,
  currentTds: number,
  currentTurbidity: number,
  config: FiltrationSystemConfig,
  valveVdivOpen: boolean,
  valveVdistClosed: boolean,
  isSensorValid: boolean = true
): {
  nextState: FiltrationState;
  newPassCount: number;
  newTds: number;
  newTurbidity: number;
  commandVdiv: 'OPEN' | 'CLOSED';
  commandVdist: 'OPEN' | 'CLOSED';
  commandVrec: 'OPEN' | 'CLOSED';
  commandVrel: 'OPEN' | 'CLOSED';
  eventDescription?: string;
} {
  // Failsafe: If post-treatment sensor readings are invalid or missing, never release water
  if (!isSensorValid) {
    return {
      nextState: 'SENSOR_INVALID',
      newPassCount: passCount,
      newTds: currentTds,
      newTurbidity: currentTurbidity,
      commandVdiv: 'OPEN',
      commandVdist: 'CLOSED',
      commandVrec: 'CLOSED',
      commandVrel: 'CLOSED',
      eventDescription: 'Failsafe: Sensor invalid or disconnected. Treated water release strictly prevented.',
    };
  }

  const diversionCheck = shouldDivertContaminatedWater(
    currentTds,
    currentTurbidity,
    config.releaseThresholdTds,
    config.releaseThresholdTurbidity
  );

  switch (currentState) {
    case 'IDLE': {
      if (diversionCheck.shouldDivert) {
        return {
          nextState: 'DIVERTING',
          newPassCount: 0,
          newTds: currentTds,
          newTurbidity: currentTurbidity,
          commandVdiv: 'OPEN',
          commandVdist: 'CLOSED',
          commandVrec: 'CLOSED',
          commandVrel: 'CLOSED',
          eventDescription: `Contamination Detected! Command V-DIST CLOSED, V-DIV OPEN. ${diversionCheck.reason}`,
        };
      }
      return {
        nextState: 'IDLE',
        newPassCount: 0,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'CLOSED',
        commandVdist: 'OPEN',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
      };
    }

    case 'DIVERTING': {
      // Once diversion valve is open and distribution valve is verified closed
      if (valveVdivOpen && valveVdistClosed) {
        return {
          nextState: 'FILTERING',
          newPassCount: 1,
          newTds: currentTds,
          newTurbidity: currentTurbidity,
          commandVdiv: 'OPEN',
          commandVdist: 'CLOSED',
          commandVrec: 'CLOSED',
          commandVrel: 'CLOSED',
          eventDescription: 'Routing contaminated water into Stage 1 & 2 Filtration Train. Pass 1 initiated.',
        };
      }
      return {
        nextState: 'DIVERTING',
        newPassCount: passCount,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'OPEN',
        commandVdist: 'CLOSED',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
      };
    }

    case 'FILTERING': {
      // Execute treatment pass
      const result = calculateTreatmentPass(currentTds, currentTurbidity, passCount, config);
      return {
        nextState: 'QUALITY_CHECK',
        newPassCount: passCount,
        newTds: result.outputTds,
        newTurbidity: result.outputTurbidity,
        commandVdiv: 'OPEN',
        commandVdist: 'CLOSED',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
        eventDescription: `Pass ${passCount} filtration complete. Evaluating post-treatment quality.`,
      };
    }

    case 'QUALITY_CHECK': {
      const releaseCriteriaMet =
        currentTds <= config.releaseThresholdTds &&
        currentTurbidity <= config.releaseThresholdTurbidity;

      if (releaseCriteriaMet) {
        return {
          nextState: 'RELEASE_READY',
          newPassCount: passCount,
          newTds: currentTds,
          newTurbidity: currentTurbidity,
          commandVdiv: 'OPEN',
          commandVdist: 'CLOSED',
          commandVrec: 'CLOSED',
          commandVrel: 'OPEN',
          eventDescription: `Post-treatment readings verified (${currentTds} ppm, ${currentTurbidity} NTU). Batch release-ready. Command V-REL OPEN.`,
        };
      }

      // If release criteria not met, check pass limit
      if (passCount < config.maxPasses) {
        return {
          nextState: 'RECIRCULATING',
          newPassCount: passCount + 1,
          newTds: currentTds,
          newTurbidity: currentTurbidity,
          commandVdiv: 'OPEN',
          commandVdist: 'CLOSED',
          commandVrec: 'OPEN',
          commandVrel: 'CLOSED',
          eventDescription: `Effluent failed release thresholds. Initiating recirculation pass ${passCount + 1} of ${config.maxPasses}. Command V-REC OPEN.`,
        };
      } else {
        // Exceeded max passes: strict isolation, never release
        return {
          nextState: 'FILTER_LIMIT_REACHED',
          newPassCount: passCount,
          newTds: currentTds,
          newTurbidity: currentTurbidity,
          commandVdiv: 'OPEN',
          commandVdist: 'CLOSED',
          commandVrec: 'CLOSED',
          commandVrel: 'CLOSED',
          eventDescription: `CRITICAL ALARM: Maximum filtration passes (${config.maxPasses}) reached without meeting release criteria. Water kept strictly isolated.`,
        };
      }
    }

    case 'RECIRCULATING': {
      // Re-enter filtering state for next pass
      return {
        nextState: 'FILTERING',
        newPassCount: passCount,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'OPEN',
        commandVdist: 'CLOSED',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
        eventDescription: `Recirculation pass ${passCount} entering filter stages.`,
      };
    }

    case 'RELEASE_READY': {
      return {
        nextState: 'RETURNING_TO_DISTRIBUTION',
        newPassCount: passCount,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'CLOSED',
        commandVdist: 'OPEN',
        commandVrec: 'CLOSED',
        commandVrel: 'OPEN',
        eventDescription: 'Treated water safely blending into distribution trunk. Restoring normal village distribution.',
      };
    }

    case 'RETURNING_TO_DISTRIBUTION': {
      // After safe return to distribution, transition back to IDLE
      return {
        nextState: 'IDLE',
        newPassCount: 0,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'CLOSED',
        commandVdist: 'OPEN',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
        eventDescription: 'Normal network operation restored. Diversion valve closed, normal distribution active.',
      };
    }

    case 'FILTER_LIMIT_REACHED': {
      // Water stays isolated unless manually reset or overridden
      return {
        nextState: 'FILTER_LIMIT_REACHED',
        newPassCount: passCount,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'OPEN',
        commandVdist: 'CLOSED',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
      };
    }

    default:
      return {
        nextState: 'IDLE',
        newPassCount: 0,
        newTds: currentTds,
        newTurbidity: currentTurbidity,
        commandVdiv: 'CLOSED',
        commandVdist: 'OPEN',
        commandVrec: 'CLOSED',
        commandVrel: 'CLOSED',
      };
  }
}
