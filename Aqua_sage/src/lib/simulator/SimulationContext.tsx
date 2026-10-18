'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { SimulationState, ScenarioId, TelemetryReading } from './telemetryTypes';
import { createInitialSimulationState, advanceSimulationStep } from './simulationEngine';
import {
  HardwareTelemetryPayload,
  BackendAssessmentResponse,
  BackendAlert,
  SystemOperatingMode,
  BackendConnectionStatus,
} from './hardwareContract';
import {
  buildHardwarePayloadFromSimulation,
  sendSensorTelemetry,
  fetchLatestHardwareTelemetry,
  DEFAULT_ENDPOINT,
} from '@/lib/api/backendClient';

interface SimulationContextValue {
  state: SimulationState;
  operatingMode: SystemOperatingMode;
  setOperatingMode: (mode: SystemOperatingMode) => void;

  // Backend Integration State
  backendStatus: BackendConnectionStatus;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  lastTransmittedAt: number | null;
  lastBackendResponse: BackendAssessmentResponse | null;
  backendLatencyMs: number | null;
  backendErrorMessage: string | null;
  backendAlerts: BackendAlert[];
  isTransmitting: boolean;
  autoTransmit: boolean;
  setAutoTransmit: (enabled: boolean) => void;
  latestPayloadSent: HardwareTelemetryPayload | null;

  // Simulation & Event Actions
  setScenario: (id: ScenarioId) => void;
  togglePlayPause: () => void;
  pause: () => void;
  resume: () => void;
  step: (dtSeconds?: number) => void;
  reset: () => void;
  setSpeedMultiplier: (mult: number) => void;

  // 3D Physical Event Inputs
  injectLeak: (severityLpm?: number, locationNorm?: number) => Promise<void>;
  clearLeak: () => Promise<void>;
  injectContamination: (tds: number, turb: number) => Promise<void>;
  setTankWaterLevel: (percent: number) => Promise<void>;
  transmitTelemetryNow: () => Promise<void>;

  setLeakSeverity: (lpm: number) => void;
  setLeakLocation: (norm: number) => void;
  setContamination: (tds: number, turb: number) => void;
  toggleFilterClogged: () => void;
  toggleValve: (valveId: string) => void;
  getReading: (sensorId: string) => TelemetryReading | undefined;
}

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

export function SimulationProvider({
  children,
  initialScenarioId = 'normal',
}: {
  children: React.ReactNode;
  initialScenarioId?: ScenarioId;
}) {
  const [state, setState] = useState<SimulationState>(() =>
    createInitialSimulationState(initialScenarioId)
  );
  const [operatingMode, setOperatingMode] = useState<SystemOperatingMode>('simulation');

  // Backend Telemetry State
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>('pending');
  const [backendUrl, setBackendUrl] = useState<string>(DEFAULT_ENDPOINT);
  const [lastTransmittedAt, setLastTransmittedAt] = useState<number | null>(null);
  const [lastBackendResponse, setLastBackendResponse] = useState<BackendAssessmentResponse | null>(null);
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);
  const [backendErrorMessage, setBackendErrorMessage] = useState<string | null>(null);
  const [backendAlerts, setBackendAlerts] = useState<BackendAlert[]>([]);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [autoTransmit, setAutoTransmit] = useState<boolean>(true);
  const [latestPayloadSent, setLatestPayloadSent] = useState<HardwareTelemetryPayload | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const operatingModeRef = useRef(operatingMode);
  operatingModeRef.current = operatingMode;

  const backendUrlRef = useRef(backendUrl);
  backendUrlRef.current = backendUrl;

  // Core transmission function to POST /api/v1/sensor-data
  const transmitPayload = useCallback(
    async (payloadToTransmit?: HardwareTelemetryPayload) => {
      const payload = payloadToTransmit || buildHardwarePayloadFromSimulation(stateRef.current);
      setLatestPayloadSent(payload);
      setIsTransmitting(true);
      setBackendStatus('pending');

      const res = await sendSensorTelemetry(payload, backendUrlRef.current);

      setIsTransmitting(false);
      setLastTransmittedAt(Date.now());
      setBackendLatencyMs(res.latencyMs);

      if (res.ok && res.data.status !== 'error') {
        setBackendStatus('connected');
        setBackendErrorMessage(null);
        setLastBackendResponse(res.data);

        // Update alerts returned by backend
        if (res.data.assessment?.alerts) {
          setBackendAlerts(res.data.assessment.alerts);
        } else {
          setBackendAlerts([]);
        }

        // If backend commands diversion, update 3D valve state
        if (res.data.assessment?.diversion_required || res.data.assessment?.valve_divert_state === 'OPEN') {
          setState((prev) => {
            const network = { ...prev.network };
            if (network.valves['valve-v-div']) {
              network.valves['valve-v-div'].actualState = 'OPEN';
              network.valves['valve-v-div'].commandedState = 'OPEN';
            }
            if (network.valves['valve-v-dist']) {
              network.valves['valve-v-dist'].actualState = 'CLOSED';
              network.valves['valve-v-dist'].commandedState = 'CLOSED';
            }
            return {
              ...prev,
              network,
              filtrationState: 'DIVERTING',
            };
          });
        }
      } else {
        // Backend unavailable, timeout, or error
        setBackendStatus('offline');
        const errorMsg =
          res.data.message ||
          res.data.error ||
          `Backend connection refused or timed out (${res.status || '503'})`;
        setBackendErrorMessage(errorMsg);
        setLastBackendResponse(res.data);
      }
    },
    []
  );

  // Set scenario and reset to its initial state
  const setScenario = useCallback((id: ScenarioId) => {
    const newState = createInitialSimulationState(id);
    setState(newState);
    // Transmit telemetry representing new scenario
    setTimeout(() => {
      transmitPayload(buildHardwarePayloadFromSimulation(newState));
    }, 50);
  }, [transmitPayload]);

  // Pause simulation
  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  // Resume simulation
  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  // Single manual deterministic step
  const step = useCallback((dtSeconds: number = 1.0) => {
    setState((prev) => {
      const next = advanceSimulationStep(prev, dtSeconds);
      return next;
    });
  }, []);

  // Reset to initial state of current scenario
  const reset = useCallback(() => {
    const resetState = createInitialSimulationState('normal');
    setState(resetState);
    setBackendAlerts([]);
    setBackendErrorMessage(null);
    setLastBackendResponse(null);
    setTimeout(() => {
      transmitPayload(buildHardwarePayloadFromSimulation(resetState));
    }, 50);
  }, [transmitPayload]);

  // Set simulation speed (1x, 2x, 5x)
  const setSpeedMultiplier = useCallback((mult: number) => {
    setState((prev) => ({ ...prev, speedMultiplier: mult }));
  }, []);

  // ────────────────────────────────────────────────────────────
  // 3D PHYSICAL EVENT INPUT INTERFACES
  // ────────────────────────────────────────────────────────────

  // 1. Inject a physical pipeline leak at selectable point
  const injectLeak = useCallback(
    async (severityLpm: number = 5.5, locationNorm: number = 0.5) => {
      if (operatingModeRef.current === 'hardware') return;

      const clampedLpm = Math.max(1.0, Math.min(15.0, severityLpm));
      let updatedState: SimulationState;

      setState((prev) => {
        const primaryFlow = prev.inflowRateLpm || 18.0;
        const newOutflow = Math.max(0, primaryFlow - clampedLpm);

        updatedState = {
          ...prev,
          scenarioId: 'leak',
          leakSeverityLpm: clampedLpm,
          leakRateLpm: clampedLpm,
          leakLocationNorm: locationNorm,
          outflowRateLpm: newOutflow,
          estimatedLeakLossLpm: clampedLpm,
        };
        return updatedState;
      });

      // Send simulated sensor telemetry to FastAPI backend
      setTimeout(() => {
        const payload = buildHardwarePayloadFromSimulation(stateRef.current);
        transmitPayload(payload);
      }, 50);
    },
    [transmitPayload]
  );

  // Clear pipe leak and restore normal hydraulic flow
  const clearLeak = useCallback(async () => {
    if (operatingModeRef.current === 'hardware') return;

    setState((prev) => ({
      ...prev,
      scenarioId: 'normal',
      leakSeverityLpm: 0,
      leakRateLpm: 0,
      outflowRateLpm: prev.inflowRateLpm,
      estimatedLeakLossLpm: 0,
    }));

    setTimeout(() => {
      const payload = buildHardwarePayloadFromSimulation(stateRef.current);
      transmitPayload(payload);
    }, 50);
  }, [transmitPayload]);

  // 2. Inject raw-water contamination (TDS and Turbidity)
  const injectContamination = useCallback(
    async (tds: number, turb: number) => {
      if (operatingModeRef.current === 'hardware') return;

      const clampedTds = Math.max(50, Math.min(2500, tds));
      const clampedTurb = Math.max(0.5, Math.min(100, turb));

      setState((prev) => ({
        ...prev,
        scenarioId: clampedTds > 500 && clampedTurb > 5.0 ? 'combined_contamination' : clampedTds > 500 ? 'elevated_tds' : 'elevated_turbidity',
        preTreatmentTds: clampedTds,
        preTreatmentTurbidity: clampedTurb,
      }));

      setTimeout(() => {
        const payload = buildHardwarePayloadFromSimulation(stateRef.current);
        transmitPayload(payload);
      }, 50);
    },
    [transmitPayload]
  );

  // 3. Set Tank Water Level percentage (affects HC-SR04 distance consistently)
  const setTankWaterLevel = useCallback(
    async (percent: number) => {
      if (operatingModeRef.current === 'hardware') return;

      const clampedPct = Math.max(0, Math.min(100, percent));
      const heightM = (clampedPct / 100) * 1.0;

      setState((prev) => ({
        ...prev,
        tankWaterHeight: heightM,
        tankLevelPercentage: clampedPct,
      }));

      setTimeout(() => {
        const payload = buildHardwarePayloadFromSimulation(stateRef.current);
        transmitPayload(payload);
      }, 50);
    },
    [transmitPayload]
  );

  // Dynamic leak severity adjustment slider
  const setLeakSeverity = useCallback((lpm: number) => {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(20, lpm));
      const newOutflow = Math.max(0, prev.inflowRateLpm - clamped);
      return {
        ...prev,
        leakSeverityLpm: clamped,
        leakRateLpm: clamped,
        outflowRateLpm: newOutflow,
        estimatedLeakLossLpm: clamped,
      };
    });
  }, []);

  const setLeakLocation = useCallback((norm: number) => {
    setState((prev) => ({
      ...prev,
      leakLocationNorm: Math.max(0, Math.min(1, norm)),
    }));
  }, []);

  const setContamination = useCallback((tds: number, turb: number) => {
    setState((prev) => {
      const clampedTds = Math.max(50, Math.min(2000, tds));
      const clampedTurb = Math.max(0.5, Math.min(100, turb));
      return {
        ...prev,
        preTreatmentTds: clampedTds,
        preTreatmentTurbidity: clampedTurb,
      };
    });
  }, []);

  const toggleFilterClogged = useCallback(() => {
    setState((prev) => {
      const isClogged = !prev.network.filtrationConfig.filterClogged;
      const network = { ...prev.network };
      network.filtrationConfig.filterClogged = isClogged;
      network.filtrationConfig.filterLoadingPercent = isClogged ? 96.0 : 15.0;
      return { ...prev, network };
    });
  }, []);

  const toggleValve = useCallback((valveId: string) => {
    setState((prev) => {
      const network = { ...prev.network };
      const valve = network.valves[valveId];
      if (valve) {
        const nextState = valve.actualState === 'OPEN' ? 'CLOSED' : 'OPEN';
        valve.commandedState = nextState;
        valve.actualState = nextState;
      }
      return { ...prev, network };
    });
  }, []);

  // Timer: Advances simulation and transmits telemetry periodically
  useEffect(() => {
    if (!state.isRunning) return;

    const intervalMs = Math.max(200, 1000 / (state.speedMultiplier || 1));
    const timer = setInterval(() => {
      setState((prev) => {
        if (!prev.isRunning) return prev;
        return advanceSimulationStep(prev, prev.timeStepSec);
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [state.isRunning, state.speedMultiplier]);

  // Periodic Telemetry Transmitter (every 3 seconds when running and autoTransmit is enabled)
  useEffect(() => {
    if (!state.isRunning || !autoTransmit) return;

    const transmitTimer = setInterval(() => {
      if (operatingModeRef.current === 'simulation') {
        transmitPayload();
      } else {
        // Hardware Mode: Poll latest live physical reading
        fetchLatestHardwareTelemetry(backendUrlRef.current).then((res) => {
          if (res.ok && res.data) {
            setBackendStatus('connected');
            setLastTransmittedAt(Date.now());
            // Update sensor readings from physical hardware
            const waterLevel = res.data.tank?.water_level_percent;
            if (waterLevel !== undefined) {
              const h = (waterLevel / 100) * 1.0;
              setState((prev) => ({
                ...prev,
                tankWaterHeight: h,
                tankLevelPercentage: waterLevel,
              }));
            }
          } else {
            setBackendStatus('offline');
          }
        });
      }
    }, 3000);

    return () => clearInterval(transmitTimer);
  }, [state.isRunning, autoTransmit, transmitPayload]);

  // Initial check on mount
  useEffect(() => {
    transmitPayload();
  }, [transmitPayload]);

  const getReading = useCallback(
    (sensorId: string): TelemetryReading | undefined => {
      const reading = stateRef.current.readings[sensorId];
      if (!reading) return undefined;
      // In hardware mode, label source as physical
      if (operatingModeRef.current === 'hardware') {
        return {
          ...reading,
          source: 'physical',
          faultOrigin: 'physical_detected',
        };
      }
      return reading;
    },
    []
  );

  const value = useMemo<SimulationContextValue>(
    () => ({
      state,
      operatingMode,
      setOperatingMode,
      backendStatus,
      backendUrl,
      setBackendUrl,
      lastTransmittedAt,
      lastBackendResponse,
      backendLatencyMs,
      backendErrorMessage,
      backendAlerts,
      isTransmitting,
      autoTransmit,
      setAutoTransmit,
      latestPayloadSent,
      setScenario,
      togglePlayPause,
      pause,
      resume,
      step,
      reset,
      setSpeedMultiplier,
      injectLeak,
      clearLeak,
      injectContamination,
      setTankWaterLevel,
      transmitTelemetryNow: transmitPayload,
      setLeakSeverity,
      setLeakLocation,
      setContamination,
      toggleFilterClogged,
      toggleValve,
      getReading,
    }),
    [
      state,
      operatingMode,
      backendStatus,
      backendUrl,
      lastTransmittedAt,
      lastBackendResponse,
      backendLatencyMs,
      backendErrorMessage,
      backendAlerts,
      isTransmitting,
      autoTransmit,
      latestPayloadSent,
      setScenario,
      togglePlayPause,
      pause,
      resume,
      step,
      reset,
      setSpeedMultiplier,
      injectLeak,
      clearLeak,
      injectContamination,
      setTankWaterLevel,
      transmitPayload,
      setLeakSeverity,
      setLeakLocation,
      setContamination,
      toggleFilterClogged,
      toggleValve,
      getReading,
    ]
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}

export function useTelemetry(sensorId: string): TelemetryReading | undefined {
  const { getReading } = useSimulation();
  return getReading(sensorId);
}
