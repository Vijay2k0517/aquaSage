import type { Metadata } from 'next';
import { SimulatorShell } from '@/components/simulator/SimulatorShell';

export const metadata: Metadata = {
  title: 'AquaSage Simulator — 3D IoT Digital Twin',
  description: 'Interactive 3D representation of the AquaSage water monitoring infrastructure',
};

export default function SimulatorPage() {
  return <SimulatorShell />;
}
