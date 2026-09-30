import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Lightformer, Text3D } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type Weather = "day" | "sunset" | "night" | "rain";
export type ZoneId = "entrance" | "product" | "arcade" | "contact";

export const ZONES: { id: ZoneId; pos: [number, number, number]; cam: [number, number, number] }[] = [
  { id: "entrance", pos: [0, 4, -20], cam: [0, 14, 42] },
  { id: "product", pos: [-18, 0, -4], cam: [-6, 9, 14] },
  { id: "arcade", pos: [18, 0, -6], cam: [30, 9, 10] },
  { id: "contact", pos: [0, 0, -22], cam: [10, 9, -6] },
];

type Pal = { sky: string; fog: [number, number]; sun: string; sunI: number; amb: number; sunPos: [number, number, number]; neon: number; grass: string; grassTip: string };
const PALETTE: Record<Weather, Pal> = {
  day: { sky: "#9fd6f2", fog: [60, 170], sun: "#fff3d6", sunI: 2.4, amb: 0.55, sunPos: [30, 45, 20], neon: 0.15, grass: "#4f9a3c", grassTip: "#b6e06a" },
  sunset: { sky: "#f5a36a", fog: [45, 150], sun: "#ff8a45", sunI: 2.1, amb: 0.4, sunPos: [-50, 12, 10], neon: 1, grass: "#6c8f35", grassTip: "#f2c56a" },
  night: { sky: "#0b1030", fog: [40, 130], sun: "#8fa8ff", sunI: 0.5, amb: 0.28, sunPos: [15, 40, -20], neon: 3.2, grass: "#23452f", grassTip: "#4f8a6a" },
  rain: { sky: "#6a7682", fog: [18, 90], sun: "#d0dbe6", sunI: 0.9, amb: 0.5, sunPos: [10, 40, 10], neon: 1.4, grass: "#3f7440", grassTip: "#86b86a" },
};

const rand = (seed: number) => { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); };
const inDistrict = (x: number, z: number) =>
  ZONES.slice(1).some((d) => Math.hypot(x - d.pos[0], z - d.pos[2]) < 9) || Math.hypot(x, z - 10) < 5;

/* ---------- Swaying grass (instanced + shader) ---------- */
function Grass({ pal }: { pal: Pal }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 9000;
  const { geo, mat } = useMemo(() => {
    const g = new THREE.ConeGeometry(0.07, 0.7, 3, 1);
    g.translate(0, 0.35, 0);
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
    const uniforms = { uTime: { value: 0 }, uBase: { value: new THREE.Color() }, uTip: { value: new THREE.Color() } };
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = "uniform float uTime;\nvarying float vH;\n" + s.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vH = position.y / 0.7;
         vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
         float sway = sin(uTime*1.8 + wp.x*0.35 + wp.z*0.25) * 0.18 * vH * vH;
         transformed.x += sway; transformed.z += sway*0.5;`,
      );
      s.fragmentShader = "uniform vec3 uBase; uniform vec3 uTip;\nvarying float vH;\n" + s.fragmentShader.replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        "vec4 diffuseColor = vec4( mix(uBase, uTip, vH), opacity );",
      );
    };
    (m as THREE.MeshStandardMaterial & { userData: { u: typeof uniforms } }).userData.u = uniforms;
    return { geo: g, mat: m };
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const o = new THREE.Object3D(); let n = 0; let i = 0;
    while (n < COUNT && i < COUNT * 3) {
      i++;
      const x = (rand(i) - 0.5) * 110, z = (rand(i + 999) - 0.5) * 90;
      if (inDistrict(x, z) || Math.abs(x) < 1.5) continue;
      o.position.set(x, 0, z); o.rotation.y = rand(i + 7) * 6.28;
      const s = 0.6 + rand(i + 3) * 0.9; o.scale.set(s, s, s); o.updateMatrix();
      mesh.setMatrixAt(n++, o.matrix);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const u = mat.userData["u"] as { uTime: { value: number }; uBase: { value: THREE.Color }; uTip: { value: THREE.Color } };
    u.uTime.value = clock.elapsedTime; u.uBase.value.set(pal.grass); u.uTip.value.set(pal.grassTip);
  });
  return <instancedMesh ref={ref} args={[geo, mat, COUNT]} receiveShadow />;
}

/* ---------- Trees (instanced trunks + canopies) ---------- */
function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const out: { x: number; z: number; s: number; blossom: boolean }[] = [];
    for (let i = 0; out.length < 70 && i < 600; i++) {
      const x = (rand(i * 3.1) - 0.5) * 110, z = (rand(i * 5.7) - 0.5) * 80 - 5;
      if (inDistrict(x, z) || Math.abs(x) < 4) continue;
      out.push({ x, z, s: 0.8 + rand(i) * 0.9, blossom: rand(i * 9.3) > 0.55 });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D(); const c = new THREE.Color();
    let k = 0;
    data.forEach((t, i) => {
      o.position.set(t.x, 1.2 * t.s, t.z); o.scale.setScalar(t.s); o.rotation.set(0, 0, 0); o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 3; j++) {
        o.position.set(t.x + (rand(i + j) - 0.5) * 1.4 * t.s, (2.6 + j * 0.6) * t.s, t.z + (rand(i * 2 + j) - 0.5) * 1.4 * t.s);
        o.scale.setScalar(t.s * (1.3 - j * 0.2)); o.rotation.set(rand(j), rand(i), 0); o.updateMatrix();
        leaves.current!.setMatrixAt(k, o.matrix);
        leaves.current!.setColorAt(k, c.set(t.blossom ? ["#f7a8c4", "#f9c3d6", "#ec8fb4"][j]! : ["#3d8b3d", "#56a447", "#2f7a3a"][j]!));
        k++;
      }
    });
    trunks.current!.instanceMatrix.needsUpdate = true; leaves.current!.instanceMatrix.needsUpdate = true;
    if (leaves.current!.instanceColor) leaves.current!.instanceColor.needsUpdate = true;
  }, [data]);
  useFrame(({ clock }) => { if (leaves.current) leaves.current.rotation.z = Math.sin(clock.elapsedTime * 0.6) * 0.003; });
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, data.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, 2.4, 6]} />
        <meshStandardMaterial color="#6e4a32" flatShading />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, data.length * 3]} castShadow>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial flatShading roughness={0.85} />
      </instancedMesh>
    </>
  );
}

/* ---------- Stone paths ---------- */
function Paths() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stones = useMemo(() => {
    const pts: [number, number][] = [];
    const hub: [number, number] = [0, 6];
    const ends: [number, number][] = [[0, 22], [-18, -4], [18, -6], [0, -22]];
    ends.forEach(([ex, ez], e) => {
      const len = Math.hypot(ex - hub[0], ez - hub[1]); const n = Math.floor(len / 0.9);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const off = (rand(i + e * 50) - 0.5) * 1.6;
        const nx = -(ez - hub[1]) / len, nz = (ex - hub[0]) / len;
        pts.push([hub[0] + (ex - hub[0]) * t + nx * off, hub[1] + (ez - hub[1]) * t + nz * off]);
        pts.push([hub[0] + (ex - hub[0]) * t - nx * off * 0.6, hub[1] + (ez - hub[1]) * t - nz * off * 0.6]);
      }
    });
    return pts;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    stones.forEach(([x, z], i) => { o.position.set(x, 0.04, z); o.rotation.set(0, rand(i) * 3, 0); o.scale.set(0.8 + rand(i + 1) * 0.5, 1, 0.7 + rand(i + 2) * 0.5); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix); });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [stones]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stones.length]} receiveShadow>
      <cylinderGeometry args={[0.45, 0.5, 0.1, 7]} />
      <meshStandardMaterial color="#c9bfae" flatShading roughness={0.9} />
    </instancedMesh>
  );
}

/* ---------- Architecture ---------- */
function House({ position, rotation = 0, wall, roof, w = 3, h = 2.6, d = 3, neon, sign, tiers = 1 }: {
  position: [number, number, number]; rotation?: number; wall: string; roof: string; w?: number; h?: number; d?: number; neon: number; sign?: string; tiers?: number;
}) {
  return (
    <group position={position} rotation-y={rotation}>
      {Array.from({ length: tiers }, (_, t) => {
        const s = 1 - t * 0.18, y = t * h;
        return (
          <group key={t} position={[0, y, 0]}>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[w * s, h, d * s]} /><meshStandardMaterial color={wall} roughness={0.85} /></mesh>
            <mesh position={[0, h + 0.35, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[(w * s) * 0.95, 0.9, 4]} /><meshStandardMaterial color={roof} flatShading /></mesh>
            <mesh position={[0, h * 0.55, (d * s) / 2 + 0.01]}><planeGeometry args={[w * s * 0.6, h * 0.35]} /><meshStandardMaterial color="#ffe1a0" emissive="#ffb04d" emissiveIntensity={0.3 + neon * 0.6} /></mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.9, d / 2 + 0.3]} rotation-x={-0.4} castShadow><boxGeometry args={[w * 0.9, 0.08, 0.9]} /><meshStandardMaterial color={roof} /></mesh>
      {sign && (
        <mesh position={[0, h * tiers + 1.2, d / 2 * 0.8]}><boxGeometry args={[w * 0.7, 0.5, 0.1]} /><meshStandardMaterial color={sign} emissive={sign} emissiveIntensity={neon} toneMapped={false} /></mesh>
      )}
    </group>
  );
}

function Lantern({ position, neon, color = "#ffb347" }: { position: [number, number, number]; neon: number; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.06, 0.08, 2.2, 5]} /><meshStandardMaterial color="#3b2c24" /></mesh>
      <mesh position={[0, 2.35, 0]}><boxGeometry args={[0.4, 0.5, 0.4]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3 + neon} toneMapped={false} /></mesh>
      <mesh position={[0, 2.7, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.38, 0.25, 4]} /><meshStandardMaterial color="#2b2320" /></mesh>
    </group>
  );
}

function Fence({ from, to }: { from: [number, number]; to: [number, number] }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]); const n = Math.floor(len / 1.2);
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return (
    <group position={[from[0], 0, from[1]]} rotation-y={-ang}>
      {Array.from({ length: n + 1 }, (_, i) => (
        <mesh key={i} position={[i * 1.2, 0.45, 0]} castShadow><boxGeometry args={[0.12, 0.9, 0.12]} /><meshStandardMaterial color="#9a6b43" /></mesh>
      ))}
      <mesh position={[len / 2, 0.65, 0]}><boxGeometry args={[len, 0.08, 0.06]} /><meshStandardMaterial color="#b07c4f" /></mesh>
      <mesh position={[len / 2, 0.35, 0]}><boxGeometry args={[len, 0.08, 0.06]} /><meshStandardMaterial color="#b07c4f" /></mesh>
    </group>
  );
}

function Spinner({ position, children, speed = 0.8 }: { position: [number, number, number]; children: React.ReactNode; speed?: number }) {
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }, d) => { if (r.current) { r.current.rotation.y += d * speed; r.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.5 + position[0]) * 0.15; } });
  return <group ref={r} position={position}>{children}</group>;
}

function District({ index, onSelect, children }: { index: number; onSelect: (i: number) => void; children: React.ReactNode }) {
  const z = ZONES[index]!;
  return (
    <group position={z.pos} onClick={(e) => { e.stopPropagation(); onSelect(index); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => (document.body.style.cursor = "")}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow><circleGeometry args={[8.5, 24]} /><meshStandardMaterial color="#d9cdb6" roughness={0.95} /></mesh>
      {children}
    </group>
  );
}

function ProductHaven({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  return (
    <District index={1} onSelect={onSelect}>
      <House position={[-4, 0, -4]} rotation={0.4} wall="#f4ead8" roof="#e2574c" neon={neon} sign="#ffcf5a" />
      <House position={[0, 0, -5.5]} wall="#fff4e4" roof="#3a8fd8" neon={neon} tiers={2} sign="#5ad1ff" />
      <House position={[4.5, 0, -3.5]} rotation={-0.5} wall="#f0dcc2" roof="#5aa05a" neon={neon} />
      {[[-2.5, 1.5], [0, 2.5], [2.5, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x!, 0, z!]}>
          <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.6, 0.7, 1, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.3} /></mesh>
          <Spinner position={[0, 1.6, 0]}>
            <mesh castShadow>
              {i === 0 ? <torusKnotGeometry args={[0.3, 0.1, 80, 10]} /> : i === 1 ? <icosahedronGeometry args={[0.45, 0]} /> : <capsuleGeometry args={[0.2, 0.5, 4, 10]} />}
              <meshStandardMaterial color={["#ff5fa2", "#5ad1ff", "#ffcf5a"][i]} metalness={0.7} roughness={0.15} emissive={["#ff5fa2", "#5ad1ff", "#ffcf5a"][i]} emissiveIntensity={neon * 0.2} />
            </mesh>
          </Spinner>
        </group>
      ))}
      <Lantern position={[-6, 0, 2]} neon={neon} /><Lantern position={[6, 0, 2]} neon={neon} />
      <Fence from={[-8, 5]} to={[-3, 7]} />
    </District>
  );
}

function ArcadeAlley({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  const signs = ["#ff3fa4", "#00e5ff", "#b36bff", "#39ff88"];
  return (
    <District index={2} onSelect={onSelect}>
      {[[-5, -3, 3], [-1.5, -5, 4], [2.5, -4.5, 3], [5.5, -2, 2]].map(([x, z, t], i) => (
        <House key={i} position={[x!, 0, z!]} rotation={-x! * 0.07} wall={["#2d2547", "#3a2d5c", "#27324f", "#3c2a4a"][i]!} roof="#1b1630" neon={neon} tiers={t!} h={2.2} sign={signs[i]} />
      ))}
      {[-3, 0, 3].map((x, i) => (
        <group key={x} position={[x, 0, 2]} rotation-y={Math.PI}>
          <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[1, 1.8, 0.8]} /><meshStandardMaterial color="#1c1a2e" /></mesh>
          <mesh position={[0, 1.25, -0.41]} rotation-y={Math.PI}><planeGeometry args={[0.7, 0.5]} /><meshStandardMaterial color={signs[i]} emissive={signs[i]} emissiveIntensity={0.5 + neon} toneMapped={false} /></mesh>
        </group>
      ))}
      <Spinner position={[0, 2.2, -0.5]} speed={0.5}>
        <mesh><boxGeometry args={[1.4, 1.4, 1.4]} /><meshStandardMaterial color="#00e5ff" wireframe emissive="#00e5ff" emissiveIntensity={neon} /></mesh>
      </Spinner>
      <Lantern position={[-6.5, 0, 3]} neon={neon} color="#ff3fa4" /><Lantern position={[6.5, 0, 3]} neon={neon} color="#00e5ff" />
    </District>
  );
}

function ContactSquare({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  const cols = ["#ea4335", "#25d366", "#29a9eb", "#1877f2", "#ff0000", "#222222", "#e1306c", "#6e5494"];
  return (
    <District index={3} onSelect={onSelect}>
      <House position={[0, 0, -5]} wall="#f6e7d0" roof="#c8413a" neon={neon} w={4.5} tiers={2} sign="#ffcf5a" />
      {[-4, 4].map((x) => (
        <group key={x} position={[x, 0, -1]}>
          <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1, 2.4, 1]} /><meshStandardMaterial color="#d8322c" /></mesh>
          <mesh position={[0, 1.3, 0.51]}><planeGeometry args={[0.7, 1.5]} /><meshStandardMaterial color="#bfe8ff" emissive="#bfe8ff" emissiveIntensity={neon * 0.4} transparent opacity={0.8} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.3, 2]} castShadow receiveShadow><cylinderGeometry args={[1.6, 1.8, 0.6, 16]} /><meshStandardMaterial color="#b8c0cc" /></mesh>
      <mesh position={[0, 0.62, 2]}><cylinderGeometry args={[1.35, 1.35, 0.05, 16]} /><meshStandardMaterial color="#5ab8e8" metalness={0.6} roughness={0.1} /></mesh>
      {cols.map((c, i) => {
        const a = (i / cols.length) * Math.PI * 2;
        return (
          <Spinner key={i} position={[Math.cos(a) * 3.2, 2.3, 2 + Math.sin(a) * 3.2]} speed={1}>
            <mesh castShadow><boxGeometry args={[0.55, 0.55, 0.12]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.2 + neon * 0.3} /></mesh>
          </Spinner>
        );
      })}
      {[-6, 6].map((x) => <Lantern key={x} position={[x, 0, 3]} neon={neon} />)}
    </District>
  );
}

/* ---------- Mountain + sign ---------- */
function Mountain({ neon }: { neon: number }) {
  return (
    <group position={[0, 0, -62]}>
      <mesh position={[0, 11, 0]} castShadow receiveShadow><coneGeometry args={[34, 24, 9, 3]} /><meshStandardMaterial color="#4c8a45" flatShading /></mesh>
      <mesh position={[-34, 7, 6]}><coneGeometry args={[22, 16, 8, 2]} /><meshStandardMaterial color="#3f7a40" flatShading /></mesh>
      <mesh position={[34, 8, 4]}><coneGeometry args={[24, 18, 8, 2]} /><meshStandardMaterial color="#44803f" flatShading /></mesh>
      <mesh position={[0, 21, 0]}><coneGeometry args={[6, 5, 9]} /><meshStandardMaterial color="#f4f6fa" flatShading /></mesh>
      <group position={[0, 14.5, 12]} rotation-x={-0.18}>
        <Center>
          <Text3D font="/fonts/helvetiker_bold.typeface.json" size={3.2} height={0.7} bevelEnabled bevelSize={0.08} bevelThickness={0.1} letterSpacing={0.25} castShadow>
            MEWO STUDIOS
            <meshStandardMaterial color="#fdfbf5" emissive="#ffe9b0" emissiveIntensity={0.05 + neon * 0.35} roughness={0.4} />
          </Text3D>
        </Center>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-19 + i * 3.45, -2.6, -0.4]}><boxGeometry args={[0.18, 3, 0.18]} /><meshStandardMaterial color="#5a4a3a" /></mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- Weather FX ---------- */
function Rain({ active }: { active: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(); const arr = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) { arr[i * 3] = (Math.random() - 0.5) * 90; arr[i * 3 + 1] = Math.random() * 35; arr[i * 3 + 2] = (Math.random() - 0.5) * 80; }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); return g;
  }, []);
  useFrame((_, raw) => {
    if (!active) return; const d = Math.min(raw, 0.05);
    const p = geo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) - 28 * d; if (y < 0) y = 35; p.setY(i, y); }
    p.needsUpdate = true;
  });
  return <points geometry={geo} visible={active}><pointsMaterial color="#d6ebff" size={0.1} transparent opacity={0.75} /></points>;
}

function Puddles({ active }: { active: boolean }) {
  const spots: [number, number, number][] = [[2, 3, 1.2], [-6, 0, 0.9], [8, -2, 1], [-2, -12, 1.3], [12, -10, 0.8], [-12, -8, 1], [0, 14, 1.4]];
  return (
    <group visible={active}>
      {spots.map(([x, z, r], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.07, z]}><circleGeometry args={[r, 20]} /><meshStandardMaterial color="#8fa6bd" metalness={1} roughness={0.05} transparent opacity={0.75} /></mesh>
      ))}
    </group>
  );
}

function CameraRig({ zone, yaw, zoom }: { zone: number; yaw: React.MutableRefObject<number>; zoom: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 4, -20));
  useFrame((state, raw) => {
    const d = Math.min(raw, 0.05); const z = ZONES[zone]!;
    const target = new THREE.Vector3(...z.pos);
    const base = new THREE.Vector3(...z.cam).sub(target).multiplyScalar(zoom.current);
    base.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current + state.pointer.x * 0.1);
    base.y += state.pointer.y * 1.5;
    const want = target.clone().add(base);
    camera.position.set(THREE.MathUtils.damp(camera.position.x, want.x, 2.5, d), THREE.MathUtils.damp(camera.position.y, want.y, 2.5, d), THREE.MathUtils.damp(camera.position.z, want.z, 2.5, d));
    look.current.lerp(target.clone().add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.exp(-2.5 * d));
    camera.lookAt(look.current);
  });
  return null;
}

function Scene({ weather, zone, onSelect, yaw, zoom }: { weather: Weather; zone: number; onSelect: (i: number) => void; yaw: React.MutableRefObject<number>; zoom: React.MutableRefObject<number> }) {
  const p = PALETTE[weather];
  const night = weather === "night";
  return (
    <>
      <color attach="background" args={[p.sky]} />
      <fog attach="fog" args={[p.sky, ...p.fog]} />
      <ambientLight intensity={p.amb} />
      <hemisphereLight args={[p.sky, p.grass, 0.5]} />
      <directionalLight position={p.sunPos} color={p.sun} intensity={p.sunI} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={150} />
      <Environment resolution={64}>
        <Lightformer intensity={1.4} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.8} color={p.sun} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <CameraRig zone={zone} yaw={yaw} zoom={zoom} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[240, 240]} /><meshStandardMaterial color={p.grass} roughness={1} /></mesh>
      {[[-40, -25, 10], [40, -30, 12], [-45, 20, 8], [45, 18, 9]].map(([x, z, r], i) => (
        <mesh key={i} position={[x!, -r! * 0.6, z!]} receiveShadow><sphereGeometry args={[r!, 12, 8]} /><meshStandardMaterial color={p.grass} flatShading /></mesh>
      ))}
      <Grass pal={p} />
      <Trees />
      <Paths />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 6]} receiveShadow><circleGeometry args={[4, 24]} /><meshStandardMaterial color="#d9cdb6" /></mesh>
      <Lantern position={[-3, 0, 6]} neon={p.neon} /><Lantern position={[3, 0, 6]} neon={p.neon} />
      <Fence from={[-10, 12]} to={[-3, 14]} /><Fence from={[3, 14]} to={[10, 12]} />

      <ProductHaven neon={p.neon} onSelect={onSelect} />
      <ArcadeAlley neon={p.neon} onSelect={onSelect} />
      <ContactSquare neon={p.neon} onSelect={onSelect} />
      <Suspense fallback={null}><Mountain neon={p.neon} /></Suspense>

      {night && ([[-18, -4, "#ffb347"], [18, -6, "#ff3fa4"], [21, -8, "#00e5ff"], [0, -22, "#ffcf5a"], [0, 6, "#ffb347"], [0, 16, "#fff0c0"]] as const).map(([x, z, c], i) => (
        <pointLight key={i} position={[x, i === 5 ? 18 : 3, i === 5 ? -48 : z]} color={c} intensity={i === 5 ? 60 : 18} distance={i === 5 ? 40 : 14} />
      ))}
      <Rain active={weather === "rain"} />
      <Puddles active={weather === "rain"} />
    </>
  );
}

export function VillageWorld({ weather, zone, onSelect }: { weather: Weather; zone: number; onSelect: (i: number) => void }) {
  const yaw = useRef(0);
  const zoom = useRef(1);
  const drag = useRef<number | null>(null);
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 16, 48], fov: 50, far: 400 }}
      onPointerDown={(e) => { drag.current = e.clientX; }}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        yaw.current = THREE.MathUtils.clamp(yaw.current - (e.clientX - drag.current) * 0.006, -1.3, 1.3);
        drag.current = e.clientX;
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
      onWheel={(e) => { if (e.ctrlKey) zoom.current = THREE.MathUtils.clamp(zoom.current + e.deltaY * 0.002, 0.6, 1.5); }}
    >
      <Scene weather={weather} zone={zone} onSelect={onSelect} yaw={yaw} zoom={zoom} />
    </Canvas>
  );
}
