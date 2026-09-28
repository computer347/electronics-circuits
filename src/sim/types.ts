/**
 * Core circuit data model. Every view (schematic, breadboard, PCB, electron run)
 * renders this, and every simulator reads it.
 *
 * Sign convention: a component's current is the current flowing THROUGH it from
 * terminal `a` to terminal `b`. For a voltage source, `a` is + and `b` is -,
 * so a battery that is delivering power reports a NEGATIVE current.
 * Power is power ABSORBED: (V(a) - V(b)) * I(a->b). Sources delivering power are negative.
 */

export type NodeId = string;

/** Node names treated as ground (0 V reference). */
export const GROUND_NAMES: ReadonlySet<string> = new Set(['0', 'gnd', 'GND']);

interface Base {
  id: string;
  /** First terminal (+ for sources, anode for diodes). */
  a: NodeId;
  /** Second terminal (- for sources, cathode for diodes). */
  b: NodeId;
}

export interface Resistor extends Base { kind: 'resistor'; ohms: number }
export interface VoltageSource extends Base { kind: 'vsource'; volts: number }
/** Current `amps` flows through the source from a to b (SPICE convention). */
export interface CurrentSource extends Base { kind: 'isource'; amps: number }
/** Ideal wire (modelled as a tiny resistance so every branch has a current). */
export interface Wire extends Base { kind: 'wire' }
export interface Switch extends Base { kind: 'switch'; closed: boolean }
/**
 * Ideal constant-drop diode: conducts a->b once V(a)-V(b) reaches `vf`, blocks otherwise.
 * LEDs are diodes with `led` set; they can burn out above `maxAmps` or `maxReverseVolts`.
 */
export interface Diode extends Base {
  kind: 'diode';
  vf: number;
  led?: { color: LedColor };
  maxAmps?: number;
  maxReverseVolts?: number;
}
export interface Capacitor extends Base { kind: 'capacitor'; farads: number; initialVolts?: number }

export type Component =
  | Resistor
  | VoltageSource
  | CurrentSource
  | Wire
  | Switch
  | Diode
  | Capacitor;

export type ComponentKind = Component['kind'];

export interface Circuit {
  components: Component[];
}

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white';

/** Typical forward voltages for 5 mm LEDs at ~20 mA. */
export const LED_VF: Record<LedColor, number> = {
  red: 2.0,
  yellow: 2.1,
  green: 2.2,
  blue: 3.0,
  white: 3.0,
};

export type FaultKind =
  | 'short-circuit'
  | 'overcurrent'
  | 'reverse-overvoltage'
  | 'floating-node'
  | 'source-conflict'
  | 'no-convergence';

export interface Fault {
  kind: FaultKind;
  severity: 'error' | 'warning';
  component?: string;
  node?: NodeId;
  message: string;
}

export type DiodeState = 'on' | 'off';

export interface SolveResult {
  /** False when the equations had no unique solution (see faults). */
  ok: boolean;
  /** Simulation time in seconds (0 for a DC operating point). */
  time: number;
  nodeVoltages: Record<NodeId, number>;
  /** Current through each component, a -> b, in amperes. */
  currents: Record<string, number>;
  /** Power absorbed by each component, in watts. */
  power: Record<string, number>;
  diodeStates: Record<string, DiodeState>;
  faults: Fault[];
}
