/**
 * Renders a schematic as SVG with IEC-style symbols (rectangular resistors), as used
 * in European and Aalto course material.
 */
import { formatSI } from '../lib/units';
import { toCircuit, type Pt, type Schematic, type SchPart } from './model';

const G = 44; // pixels per grid unit
const PAD = 1.6; // grid units of padding around the drawing

export interface Highlight {
  parts?: string[];
  nodes?: { at: Pt; label: string }[];
}

interface Props {
  schematic: Schematic;
  highlight?: Highlight;
  className?: string;
  title?: string;
}

function valueText(p: SchPart): string {
  if (p.label !== undefined) return p.label;
  switch (p.kind) {
    case 'resistor': return formatSI(p.ohms, 'Ω');
    case 'vsource': return formatSI(p.volts, 'V');
    case 'isource': return formatSI(p.amps, 'A');
    case 'capacitor': return formatSI(p.farads, 'F');
    case 'diode': return p.led ? `${p.led.color} LED` : `${p.vf} V`;
    case 'switch': return p.closed ? 'closed' : 'open';
    case 'wire': return '';
  }
}

/** The symbol drawn along the x axis from 0 to L, centred at L/2. */
function Symbol({ part, L }: { part: SchPart; L: number }) {
  const c = L / 2;
  const lead = (from: number, to: number) => <line x1={from} y1={0} x2={to} y2={0} />;
  switch (part.kind) {
    case 'wire':
      return lead(0, L);
    case 'resistor':
      return (
        <>
          {lead(0, c - 22)}
          <rect x={c - 22} y={-8} width={44} height={16} className="sch-body" />
          {lead(c + 22, L)}
        </>
      );
    case 'vsource':
      return (
        <>
          {lead(0, c - 5)}
          <line x1={c - 5} y1={-17} x2={c - 5} y2={17} />
          <line x1={c + 5} y1={-9} x2={c + 5} y2={9} strokeWidth={4} />
          {lead(c + 5, L)}
          {/* + marker on the p1 side, opposite the label (symmetric, so it reads the same when rotated) */}
          <line x1={c - 20} y1={22} x2={c - 12} y2={22} strokeWidth={1.5} />
          <line x1={c - 16} y1={18} x2={c - 16} y2={26} strokeWidth={1.5} />
        </>
      );
    case 'isource':
      return (
        <>
          {lead(0, c - 16)}
          <circle cx={c} cy={0} r={16} className="sch-body" />
          <line x1={c - 9} y1={0} x2={c + 7} y2={0} />
          <path d={`M${c + 9} 0 l-7 -5 v10 z`} className="sch-fill" />
          {lead(c + 16, L)}
        </>
      );
    case 'capacitor':
      return (
        <>
          {lead(0, c - 5)}
          <line x1={c - 5} y1={-16} x2={c - 5} y2={16} strokeWidth={3} />
          <line x1={c + 5} y1={-16} x2={c + 5} y2={16} strokeWidth={3} />
          {lead(c + 5, L)}
        </>
      );
    case 'diode':
      return (
        <>
          {lead(0, c - 10)}
          <path d={`M${c - 10} -12 L${c - 10} 12 L${c + 10} 0 Z`} className="sch-body" />
          <line x1={c + 10} y1={-12} x2={c + 10} y2={12} />
          {lead(c + 10, L)}
          {part.led && (
            <g strokeWidth={1.5}>
              <line x1={c - 2} y1={16} x2={c + 6} y2={26} />
              <path d={`M${c + 8} 28 l-6 -1 l4 -4 z`} className="sch-fill" />
              <line x1={c + 6} y1={14} x2={c + 14} y2={24} />
              <path d={`M${c + 16} 26 l-6 -1 l4 -4 z`} className="sch-fill" />
            </g>
          )}
        </>
      );
    case 'switch':
      return (
        <>
          {lead(0, c - 16)}
          <circle cx={c - 16} cy={0} r={3} className="sch-fill" />
          <circle cx={c + 16} cy={0} r={3} className="sch-fill" />
          {part.closed
            ? <line x1={c - 16} y1={0} x2={c + 16} y2={0} />
            : <line x1={c - 16} y1={0} x2={c + 14} y2={-15} />}
          {lead(c + 16, L)}
        </>
      );
  }
}

function PartView({ part, hot }: { part: SchPart; hot: boolean }) {
  const [x1, y1] = [part.p1[0] * G, part.p1[1] * G];
  const [x2, y2] = [part.p2[0] * G, part.p2[1] * G];
  const L = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const value = valueText(part);
  const showId = part.kind !== 'wire';

  return (
    <g className={hot ? 'sch-part hot' : 'sch-part'}>
      <g transform={`translate(${x1} ${y1}) rotate(${angle})`}>
        <Symbol part={part} L={L} />
      </g>
      {showId && (horizontal ? (
        <>
          <text x={mx} y={my - 36} textAnchor="middle" className="sch-id">{part.id}</text>
          <text x={mx} y={my - 21} textAnchor="middle" className="sch-value">{value}</text>
        </>
      ) : (
        <>
          <text x={mx + 28} y={my - 3} className="sch-id">{part.id}</text>
          <text x={mx + 28} y={my + 13} className="sch-value">{value}</text>
        </>
      ))}
    </g>
  );
}

function Ground({ at }: { at: Pt }) {
  const x = at[0] * G;
  const y = at[1] * G;
  return (
    <g className="sch-part">
      <line x1={x} y1={y} x2={x} y2={y + 12} />
      <line x1={x - 13} y1={y + 12} x2={x + 13} y2={y + 12} />
      <line x1={x - 8} y1={y + 17} x2={x + 8} y2={y + 17} />
      <line x1={x - 3} y1={y + 22} x2={x + 3} y2={y + 22} />
    </g>
  );
}

export function SchematicView({ schematic, highlight, className, title }: Props) {
  const { junctions } = toCircuit(schematic);
  const pts: Pt[] = [
    ...schematic.parts.flatMap((p) => [p.p1, p.p2]),
    ...(schematic.grounds ?? []),
    ...(schematic.labels ?? []).map((l) => l.at),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD + 0.6; // extra room for labels on the right
  const h = Math.max(...ys) - minY + PAD;
  const hotParts = new Set(highlight?.parts ?? []);
  const hotPoints = new Set((highlight?.nodes ?? []).map((n) => `${n.at[0]},${n.at[1]}`));

  return (
    <svg
      className={`schematic ${className ?? ''}`}
      viewBox={`${minX * G} ${minY * G} ${w * G} ${h * G}`}
      role="img"
      aria-label={title ?? 'Circuit schematic'}
    >
      {schematic.parts.map((p) => <PartView key={p.id} part={p} hot={hotParts.has(p.id)} />)}
      {(schematic.grounds ?? []).map((g) => <Ground key={`g${g[0]},${g[1]}`} at={g} />)}
      {junctions.map((j) => <circle key={`j${j[0]},${j[1]}`} cx={j[0] * G} cy={j[1] * G} r={4} className="sch-dot" />)}
      {(schematic.labels ?? []).filter((l) => !hotPoints.has(`${l.at[0]},${l.at[1]}`)).map((l) => (
        <g key={`l${l.name}`} className="sch-node">
          <circle cx={l.at[0] * G} cy={l.at[1] * G} r={4} />
          <text x={l.at[0] * G + 9} y={l.at[1] * G - 9}>{l.name}</text>
        </g>
      ))}
      {(highlight?.nodes ?? []).map((n) => (
        <g key={`h${n.label}`} className="sch-node hot">
          <circle cx={n.at[0] * G} cy={n.at[1] * G} r={6} />
          <text x={n.at[0] * G + 10} y={n.at[1] * G - 10}>{n.label}</text>
        </g>
      ))}
    </svg>
  );
}
