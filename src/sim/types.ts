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
export interface VoltageSource extends Base {
  kind: 'vsource';
  /** DC value, used when there is no waveform. */
  volts: number;
  /** Time-varying output (a function generator). Replaces `volts` in transient and at t = 0 for DC. */
  wave?: Waveform;
}

export type WaveShape = 'square' | 'sine' | 'triangle';

/** Function-generator output: offset + a shape swinging `vpp` peak to peak. */
export interface Waveform {
  shape: WaveShape;
  /** Hz. */
  freq: number;
  /** Peak-to-peak amplitude in volts. */
  vpp: number;
  /** DC offset in volts (the middle of the swing). */
  offset: number;
  /** Square wave: fraction of each period spent high (default 0.5). */
  duty?: number;
}
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

/**
 * NPN transistor, as a switch-friendly piecewise model: a base-emitter junction that turns on
 * at `vbe`, then either the active region (collector current = beta × base current) or
 * saturation (`vcesat` from collector to emitter). `a` is the collector, `b` the emitter.
 */
export interface Npn extends Base { kind: 'npn'; base: NodeId; beta: number; vbe: number; vcesat: number }
/** N-channel MOSFET as a switch: on (`ron` from drain to source) while Vgs is above `vth`. `a` drain, `b` source. */
export interface Nmos extends Base { kind: 'nmos'; gate: NodeId; vth: number; ron: number }
/**
 * Linear regulator: holds `out` at `vout` above `b` (its ground), taking the same current from
 * `a` (its input); below `vout + dropout` in, the output follows the input down by `dropout`.
 */
export interface Regulator extends Base { kind: 'regulator'; out: NodeId; vout: number; dropout: number }

export type Component =
  | Resistor
  | VoltageSource
  | CurrentSource
  | Wire
  | Switch
  | Diode
  | Capacitor
  | Npn
  | Nmos
  | Regulator;

/** The third terminal of a three-legged component, if it has one. */
export const thirdNode = (c: Component): NodeId | undefined =>
  c.kind === 'npn' ? c.base : c.kind === 'nmos' ? c.gate : c.kind === 'regulator' ? c.out : undefined;

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
/** States of the three-legged parts: transistor off / active / saturated; MOSFET off / on; regulator regulating / in dropout. */
export type ActiveState = 'off' | 'active' | 'sat' | 'on' | 'reg' | 'dropout';

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
  /** States of transistors, MOSFETs and regulators. */
  activeStates: Record<string, ActiveState>;
  faults: Fault[];
}
