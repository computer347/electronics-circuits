/**
 * Bench power supply: a grey case with two live readouts (volts set, amps drawn), voltage and
 * current knobs, the OUTPUT button (it clicks in and lights up when you submit), and red, black
 * and green binding posts. Its leads run to the breadboard's rails.
 */
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useEased } from '../anim';
import { FONT_MONO } from './textures';

const W = 0.2, H = 0.105, D = 0.2;
/** Binding posts on the front panel, in the case's frame. */
const POSTS = {
  plus: new THREE.Vector3(0.035, 0.022, D / 2 + 0.008),
  minus: new THREE.Vector3(0.065, 0.022, D / 2 + 0.008),
  ground: new THREE.Vector3(0.05, 0.022, D / 2 + 0.008),
};

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 420;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f3234'; g.fillRect(0, 0, 800, 420);
  g.fillStyle = '#d6d8d4'; g.font = `bold 18px ${FONT_MONO}`;
  g.fillText('DC POWER SUPPLY · 0–30 V 3 A', 24, 26);
  g.font = `16px ${FONT_MONO}`; g.fillStyle = '#9a9e9c';
  g.fillText('VOLTAGE', 118, 318); g.fillText('CURRENT', 312, 318);
  g.fillText('OUTPUT', 494, 300);
  g.textAlign = 'center';
  g.fillText('+', 547, 400); g.fillText('GND', 610, 400); g.fillText('−', 674, 400);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Seven-segment style readouts, redrawn when the numbers change. */
function useReadout() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    let last = '';
    const draw = (volts: string, amps: string, on: boolean) => {
      const key = `${volts}|${amps}|${on}`;
      if (key === last) return;
      last = key;
      const g = c.getContext('2d')!;
      g.fillStyle = '#0b0c0c'; g.fillRect(0, 0, 512, 128);
      g.font = `bold 70px ${FONT_MONO}`; g.textBaseline = 'middle'; g.textAlign = 'right';
      g.fillStyle = 'rgba(255,60,40,0.12)'; g.fillText('88.88', 230, 66); g.fillText('8.888', 480, 66);
      g.fillStyle = on ? '#ff5a3c' : '#6b2a20'; g.fillText(volts, 230, 66);
      g.fillStyle = on ? '#4dff8a' : '#1d5a33'; g.fillText(amps, 480, 66);
      g.font = `bold 20px ${FONT_MONO}`; g.textAlign = 'left';
      g.fillStyle = '#9a9e9c'; g.fillText('V', 236, 96); g.fillText('A', 486, 96);
      t.needsUpdate = true;
    };
    return { t, draw };
  }, []);
}

function Knob({ at, turn }: { at: [number, number, number]; turn: number }) {
  return (
    <group position={at} rotation={[Math.PI / 2, 0, 0]}>
      <mesh rotation={[0, turn, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.013, 0.012, 28]} />
        <meshStandardMaterial color="#1b1c1d" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.0065, 0.006]} rotation={[0, turn, 0]}><boxGeometry args={[0.002, 0.001, 0.008]} /><meshBasicMaterial color="#e8e8e8" /></mesh>
    </group>
  );
}

function Post({ at, color }: { at: THREE.Vector3; color: string }) {
  return (
    <group position={at} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[0.0055, 0.0055, 0.014, 18]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
      <mesh position={[0, -0.008, 0]}><cylinderGeometry args={[0.0022, 0.0022, 0.006, 10]} /><meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} /></mesh>
    </group>
  );
}

export function BenchSupply({ position, rotY, volts, amps, on, pressed, plusTo, minusTo }: {
  position: THREE.Vector3; rotY: number; volts: number; amps: number; on: boolean;
  /** The OUTPUT button is pushed in (you just submitted). */
  pressed: boolean;
  /** Where the + and − leads end (the breadboard's rails), in world space. */
  plusTo: THREE.Vector3; minusTo: THREE.Vector3;
}) {
  const panel = useMemo(panelTexture, []);
  const readout = useReadout();
  const button = useRef<THREE.Mesh>(null);
  const push = useEased(pressed ? 1 : 0, 0.18);
  useFrame(() => {
    readout.draw(on ? volts.toFixed(2) : '0.00', on ? amps.toFixed(3) : '0.000', on);
    if (button.current) button.current.position.z = D / 2 + 0.006 - push.value * 0.004;
  });

  const world = useMemo(() => new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1)), [position, rotY]);
  const leads = useMemo(() => [[POSTS.plus, plusTo, '#d8322c'], [POSTS.minus, minusTo, '#1b1b1b']].map(([from, to, color]) => {
    const a = (from as THREE.Vector3).clone().applyMatrix4(world);
    const b = to as THREE.Vector3;
    const out = (from as THREE.Vector3).clone().add(new THREE.Vector3(0, -0.005, 0.04)).applyMatrix4(world);
    const onDesk = a.clone().lerp(b, 0.55).setY(0.006);
    // A real lead: a banana plug in the binding post, cable over the desk, then a crocodile clip
    // biting a short wire that's pushed into the breadboard's rail.
    const pin = b.clone().add(new THREE.Vector3(0, 0.012, 0));
    const clipAt = pin.clone().add(new THREE.Vector3(0, 0.006, 0));
    const curve = new THREE.CatmullRomCurve3([a.clone().add(new THREE.Vector3(0, 0, 0.012).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)))), out, onDesk, clipAt.clone().add(new THREE.Vector3(0, 0.03, 0.03)), clipAt.clone().add(new THREE.Vector3(0, 0.012, 0.014))]);
    const end = curve.getPoint(1), dir = curve.getTangent(1);
    return { geom: new THREE.TubeGeometry(curve, 64, 0.0024, 8, false), color: color as string, end, dir, pin: b, clipAt };
  }), [world, plusTo, minusTo, rotY]);

  return (
    <>
      <group position={position} rotation={[0, rotY, 0]}>
        <RoundedBox args={[W, H, D]} radius={0.006} smoothness={3} position={[0, H / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#b9bcb8" roughness={0.5} metalness={0.15} />
        </RoundedBox>
        {/* feet, and vents along the top */}
        {[-1, 1].map((k) => <mesh key={k} position={[k * (W / 2 - 0.02), -0.002, D / 2 - 0.02]}><boxGeometry args={[0.02, 0.006, 0.012]} /><meshStandardMaterial color="#1b1b1b" /></mesh>)}
        {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[-0.06 + i * 0.02, H + 0.0005, -0.03]}><boxGeometry args={[0.012, 0.001, 0.08]} /><meshStandardMaterial color="#4a4d4c" /></mesh>)}
        <mesh position={[0, H / 2, D / 2 + 0.0005]}>
          <planeGeometry args={[W - 0.01, H - 0.01]} />
          <meshStandardMaterial map={panel} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.071, D / 2 + 0.001]}>
          <planeGeometry args={[0.16, 0.034]} />
          <meshBasicMaterial map={readout.t} toneMapped={false} />
        </mesh>
        <Knob at={[-0.058, 0.04, D / 2 + 0.007]} turn={volts / 30 * 4 - 2} />
        <Knob at={[-0.012, 0.04, D / 2 + 0.007]} turn={0.6} />
        <mesh ref={button} position={[0.03, 0.045, D / 2 + 0.006]} castShadow>
          <boxGeometry args={[0.022, 0.012, 0.008]} />
          <meshStandardMaterial color={on && pressed ? '#ff48b0' : '#e7e2d6'} emissive="#ff48b0" emissiveIntensity={pressed ? 0.8 : 0} roughness={0.4} />
        </mesh>
        <Post at={POSTS.plus} color="#c0392b" />
        <Post at={POSTS.ground} color="#2e9e4f" />
        <Post at={POSTS.minus} color="#1b1b1b" />
        {/* banana plugs pushed into the + and − posts: an insulated sleeve the lead comes out of */}
        {([[POSTS.plus, '#d8322c'], [POSTS.minus, '#1b1b1b']] as const).map(([at, c]) => (
          <group key={c} position={at} rotation={[Math.PI / 2, 0, 0]}>
            <mesh position={[0, -0.012, 0]} castShadow><cylinderGeometry args={[0.0042, 0.0048, 0.016, 16]} /><meshStandardMaterial color={c} roughness={0.45} /></mesh>
            <mesh position={[0, -0.0215, 0]}><cylinderGeometry args={[0.003, 0.0042, 0.004, 16]} /><meshStandardMaterial color={c} roughness={0.45} /></mesh>
          </group>
        ))}
      </group>
      {leads.map((l, i) => (
        <group key={i}>
          <mesh geometry={l.geom} castShadow><meshStandardMaterial color={l.color} roughness={0.5} /></mesh>
          <CrocClip at={l.clipAt} dir={l.dir} color={l.color} pin={l.pin} />
        </group>
      ))}
    </>
  );
}

/**
 * The board end of a supply lead: a crocodile clip in its rubber boot, its jaws biting a short
 * bare wire pushed into the rail hole (you can't push a fat lead into a breadboard).
 */
function CrocClip({ at, dir, color, pin }: { at: THREE.Vector3; dir: THREE.Vector3; color: string; pin: THREE.Vector3 }) {
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate().normalize()), [dir]);
  return (
    <group>
      {/* the bare wire standing in the hole */}
      <mesh position={pin.clone().add(new THREE.Vector3(0, 0.009, 0))}><cylinderGeometry args={[0.0007, 0.0007, 0.018, 8]} /><meshStandardMaterial color="#c9ccd2" metalness={0.85} roughness={0.3} /></mesh>
      <group position={at} quaternion={quat}>
        {/* the rubber boot, then the steel jaws */}
        <mesh position={[0, -0.014, 0]} castShadow><cylinderGeometry args={[0.0042, 0.0034, 0.022, 12]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
        <mesh position={[0, 0.002, 0.0012]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.004, 0.012, 0.0012]} /><meshStandardMaterial color="#b9bdc2" metalness={0.85} roughness={0.3} /></mesh>
        <mesh position={[0, 0.002, -0.0012]} rotation={[-0.18, 0, 0]}><boxGeometry args={[0.004, 0.012, 0.0012]} /><meshStandardMaterial color="#b9bdc2" metalness={0.85} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}
