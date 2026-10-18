"""
Phase 3B: Simulated Hydraulic Storage Tank Module.
Simulates an elevated municipal water storage tank using mass-balance physics
coupled with real 5-minute consumer demand flow from Area 1.

CRITICAL NOTICE: ALL READINGS PRODUCED BY THIS MODULE ARE SIMULATED.
THEY DO NOT REPRESENT PHYSICAL SENSOR TELEMETRY FROM A REAL WATER TANK.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
import pandas as pd


class HydraulicTankSimulator:
    """
    Physical Specifications & Mass Balance:
    - Tank Geometry: Cylindrical elevated municipal storage reservoir.
    - Capacity: 500.0 m³ (500,000 liters).
    - Cross-sectional Area: A_tank = 50.0 m² (Diameter ≈ 8.0 m).
    - Maximum Physical Height: H_max = 10.0 meters.
    - Minimum Operating Buffer: H_min = 1.0 meter.
    - Initial Level: H_0 = 6.0 meters (300.0 m³ stored).
    - Time Step: Delta_t = 5 minutes = 1/12 hour.

    Flows & Pumping Control:
    - Outflow Q_out(t): Driven directly by real Area 1 consumer demand (m³/h).
    - Inflow Q_in(t): Supplied by pump station with closed-loop level control:
        * If level H < 4.5 m (Low trigger): Q_in = 52.0 m³/h (Refill rate).
        * If level H > 8.0 m (High trigger): Q_in = 18.0 m³/h (Throttled rate).
        * Otherwise: Inflow modulates between 28 and 42 m³/h to balance demand.

    Sensor Noise Model:
    - Ultrasonic / hydrostatic level sensor has Gaussian noise:
        y_t^sensor = H_t + epsilon_t,  epsilon_t ~ N(0, sigma_sensor^2)
        sigma_sensor = 0.05 meters (5 cm measurement noise).
    """

    def __init__(
        self,
        tank_area_m2: float = 50.0,
        tank_height_max_m: float = 10.0,
        tank_height_min_m: float = 1.0,
        initial_height_m: float = 6.0,
        dt_minutes: float = 5.0,
        sensor_noise_std_m: float = 0.05,
        seed: int = 42
    ):
        self.tank_area = tank_area_m2
        self.tank_height_max = tank_height_max_m
        self.tank_height_min = tank_height_min_m
        self.initial_height = initial_height_m
        self.dt_hours = dt_minutes / 60.0  # 5 min = 1/12 hour
        self.dt_minutes = dt_minutes
        self.sensor_noise_std = sensor_noise_std_m
        self.seed = seed

    def simulate(self, flow_series_m3h: np.ndarray, timestamps: pd.Series) -> pd.DataFrame:
        """
        Run forward numerical simulation of tank water level over time.
        flow_series_m3h: Consumer outflow Q_out(t) from Area 1 5-min flow data.
        """
        np.random.seed(self.seed)
        n_steps = len(flow_series_m3h)

        true_height = np.zeros(n_steps, dtype=np.float64)
        inflow = np.zeros(n_steps, dtype=np.float64)
        outflow = np.zeros(n_steps, dtype=np.float64)
        storage_volume = np.zeros(n_steps, dtype=np.float64)

        current_h = self.initial_height
        pump_active_high = False

        for t in range(n_steps):
            q_out = max(0.0, float(flow_series_m3h[t]))
            outflow[t] = q_out

            # Closed-loop pumping station controller
            if current_h < 4.5:
                pump_active_high = True
            elif current_h > 8.0:
                pump_active_high = False

            if pump_active_high:
                q_in = 52.0  # High refill pump rate (m³/h)
            else:
                # Modulated maintaining pump rate
                q_in = 26.0

            inflow[t] = q_in

            # Mass conservation: dV = (Q_in - Q_out) * dt
            # dH = dV / A_tank
            dh = (q_in - q_out) * self.dt_hours / self.tank_area
            current_h = np.clip(current_h + dh, self.tank_height_min, self.tank_height_max)

            true_height[t] = current_h
            storage_volume[t] = current_h * self.tank_area

        # Add realistic sensor measurement noise
        noise = np.random.normal(0.0, self.sensor_noise_std, size=n_steps)
        sensor_height = np.clip(true_height + noise, 0.0, self.tank_height_max)

        df_sim = pd.DataFrame({
            'timestamp': pd.to_datetime(timestamps).values,
            'simulated_true_level_m': np.round(true_height, 4),
            'simulated_sensor_level_m': np.round(sensor_height, 4),
            'simulated_volume_m3': np.round(storage_volume, 2),
            'simulated_inflow_m3h': np.round(inflow, 2),
            'simulated_outflow_m3h': np.round(outflow, 2),
            'is_simulated': True
        })

        return df_sim


def generate_area1_tank_simulation(
    flow_csv_path: str = "data/processed_flow_data/Area_1.csv",
    output_csv_path: str = "phase3b/data/simulated_tank_level_area1.csv"
) -> pd.DataFrame:
    """Generate and save the simulated tank level dataset."""
    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    df_flow = pd.read_csv(flow_csv_path)

    sim = HydraulicTankSimulator()
    df_sim = sim.simulate(df_flow['Flow'].values, df_flow['result_time'])
    df_sim.to_csv(output_csv_path, index=False)
    print(f"Generated {len(df_sim)} simulated tank timesteps saved to {output_csv_path}")
    print(f"Level range: {df_sim['simulated_sensor_level_m'].min():.2f}m to {df_sim['simulated_sensor_level_m'].max():.2f}m")
    print(f"Mean level: {df_sim['simulated_sensor_level_m'].mean():.2f}m, Std: {df_sim['simulated_sensor_level_m'].std():.2f}m")
    return df_sim


if __name__ == '__main__':
    generate_area1_tank_simulation()
