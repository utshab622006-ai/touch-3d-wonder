import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Lightformer, Text, Text3D } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type Phase = "Day" | "Golden hour" | "Night" | "Misty rain";
export type ZoneId = "entrance" | "product" | "assets" | "unity" | "contact";

export const ZONES: { id: ZoneId; pos: [number, number, number]; cam: [number, number, number] }[] = [
  { id: "entrance", pos: [0, 4, -24], cam: [0, 16, 46] },
  { id: "product", pos: [-22, 0, -2], cam: [-8, 12, 18] },
  { id: "assets", pos: [22, 0, -4], cam: [34, 12, 14] },
  { id: "unity", pos: [-14, 0, -26], cam: [-2, 12, -8] },
  { id: "contact", pos: [16, 0, -28], cam: [28, 11, -12] },
];

/* ---------- Auto day cycle ---------- */
type Pal = { sky: string; sun: string; sunI: number; amb: number; sunPos: [number, number, number]; neon: number; grass: string; tip: string; fogNear: number; fogFar: number; rain: number };
const PHASES: { name: Phase; p: Pal }[] = [
  { name: "Day", p: { sky: "#9fd6f2", sun: "#fff1d0", sunI: 2.6, amb: 0.55, sunPos: [30, 45, 20], neon: 0.1, grass: "#5f9e36", tip: "#d7e36a", fogNear: 70, fogFar: 190, rain: 0 } },
  { name: "Golden hour", p: { sky: "#f59a5f", sun: "#ff8a3d", sunI: 2.4, amb: 0.45, sunPos: [-50, 14, 10], neon: 0.9, grass: "#8a8a2c", tip: "#ffb347", fogNear: 50, fogFar: 160, rain: 0 } },
  { name: "Night", p: { sky: "#0d1236", sun: "#8ea6ff", sunI: 0.55, amb: 0.3, sunPos: [15, 40, -20], neon: 3, grass: "#26463a", tip: "#5c8f7a", fogNear: 40, fogFar: 140, rain: 0 } },
  { name: "Misty rain", p: { sky: "#6d7a86", sun: "#d0dbe6", sunI: 0.9, amb: 0.55, sunPos: [10, 40, 10], neon: 1.3, grass: "#3f7440", tip: "#94bf6a", fogNear: 14, fogFar: 85, rain: 1 } },
];
const PHASE_SECONDS = 18;

type Live = { sky: THREE.Color; sun: THREE.Color; grass: THREE.Color; tip: THREE.Color; sunI: number; amb: number; sunPos: THREE.Vector3; neon: number; fogNear: number; fogFar: number; rain: number; dim: number };

const rand = (seed: number) => { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); };
const inDistrict = (x: number, z: number) =>
  ZONES.slice(1).some((d) => Math.hypot(x - d.pos[0], z - d.pos[2]) < 10) || Math.hypot(x, z - 6) < 5 || Math.abs(z - 12) < 3.2;

/* ---------- Swaying grass ---------- */
function Grass({ live }: { live: React.MutableRefObject<Live> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 9000;
  const { geo, mat, uniforms } = useMemo(() => {
    const g = new THREE.ConeGeometry(0.08, 0.9, 3, 1); g.translate(0, 0.45, 0);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const u = { uTime: { value: 0 }, uBase: { value: new THREE.Color() }, uTip: { value: new THREE.Color() } };
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = "uniform float uTime;\nvarying float vH;\n" + s.vertexShader.replace("#include <begin_vertex>",
        `#include <begin_vertex>
         vH = position.y / 0.9;
         vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
         float sway = (sin(uTime*1.7 + wp.x*0.3 + wp.z*0.2) + 0.5*sin(uTime*3.1 + wp.x)) * 0.16 * vH * vH;
         transformed.x += sway; transformed.z += sway*0.6;`);
      s.fragmentShader = "uniform vec3 uBase; uniform vec3 uTip;\nvarying float vH;\n" + s.fragmentShader.replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( mix(uBase*0.7, uTip, vH), opacity );");
    };
    return { geo: g, mat: m, uniforms: u };
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const o = new THREE.Object3D(); let n = 0;
    for (let i = 0; n < COUNT && i < COUNT * 3; i++) {
      const x = (rand(i) - 0.5) * 120, z = (rand(i + 999) - 0.5) * 100 - 5;
      if (inDistrict(x, z)) continue;
      o.position.set(x, 0, z); o.rotation.set((rand(i + 5) - 0.5) * 0.3, rand(i + 7) * 6.28, 0);
      const s = 0.6 + rand(i + 3); o.scale.set(s, s * (0.8 + rand(i + 4) * 0.6), s); o.updateMatrix();
      mesh.setMatrixAt(n++, o.matrix);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; uniforms.uBase.value.copy(live.current.grass); uniforms.uTip.value.copy(live.current.tip); });
  return <instancedMesh ref={ref} args={[geo, mat, COUNT]} receiveShadow />;
}

/* ---------- Sakura / warm trees: dense multi-cluster canopies ---------- */
function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const CL = 9;
  const data = useMemo(() => {
    const out: { x: number; z: number; s: number; kind: number }[] = [];
    for (let i = 0; out.length < 85 && i < 900; i++) {
      const x = (rand(i * 3.1) - 0.5) * 120, z = (rand(i * 5.7) - 0.5) * 90 - 8;
      if (inDistrict(x, z) || Math.abs(x) < 3) continue;
      out.push({ x, z, s: 0.8 + rand(i) * 0.8, kind: rand(i * 9.3) < 0.55 ? 0 : rand(i * 2.2) < 0.5 ? 1 : 2 });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D(); const c = new THREE.Color();
    const sets = [["#ff9fc4", "#f77fb0", "#ffc2d9", "#ff6f9e"], ["#ff8a4c", "#f9b04a", "#ff6a3d", "#ffd06a"], ["#8fc24a", "#b8d450", "#6fa83c", "#d4de5a"]];
    let k = 0;
    data.forEach((t, i) => {
      o.position.set(t.x, 1.3 * t.s, t.z); o.rotation.set((rand(i) - 0.5) * 0.2, 0, (rand(i + 1) - 0.5) * 0.2); o.scale.setScalar(t.s); o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      for (let j = 0; j < CL; j++) {
        const a = (j / CL) * Math.PI * 2 + rand(i);
        const r = j === 0 ? 0 : 1.1 + rand(i * 7 + j) * 0.5;
        o.position.set(t.x + Math.cos(a) * r * t.s, (3 + (j === 0 ? 0.9 : rand(i + j * 3) * 0.9)) * t.s, t.z + Math.sin(a) * r * t.s);
        o.scale.setScalar(t.s * (j === 0 ? 1.4 : 0.75 + rand(i + j) * 0.35)); o.rotation.set(rand(j), rand(i + j), rand(i)); o.updateMatrix();
        leaves.current!.setMatrixAt(k, o.matrix);
        leaves.current!.setColorAt(k, c.set(sets[t.kind]![(i + j) % 4]!));
        k++;
      }
    });
    trunks.current!.instanceMatrix.needsUpdate = true; leaves.current!.instanceMatrix.needsUpdate = true;
    if (leaves.current!.instanceColor) leaves.current!.instanceColor.needsUpdate = true;
  }, [data]);
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, data.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.32, 2.6, 6]} />
        <meshStandardMaterial color="#5b3a2a" />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, data.length * CL]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.8} />
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
    const ends: [number, number][] = [[0, 26], ...ZONES.slice(1).map((z) => [z.pos[0], z.pos[2]] as [number, number])];
    ends.forEach(([ex, ez], e) => {
      const len = Math.hypot(ex - hub[0], ez - hub[1]); const n = Math.floor(len / 0.85);
      const nx = -(ez - hub[1]) / len, nz = (ex - hub[0]) / len;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        for (const side of [-1, 0, 1]) {
          const off = side * 0.9 + (rand(i + e * 50 + side) - 0.5) * 0.4;
          pts.push([hub[0] + (ex - hub[0]) * t + nx * off, hub[1] + (ez - hub[1]) * t + nz * off]);
        }
      }
    });
    return pts;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    stones.forEach(([x, z], i) => { o.position.set(x, 0.05, z); o.rotation.set(0, rand(i) * 3, 0); o.scale.set(0.9 + rand(i + 1) * 0.3, 1, 0.8 + rand(i + 2) * 0.3); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix); });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [stones]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stones.length]} receiveShadow castShadow>
      <cylinderGeometry args={[0.42, 0.46, 0.12, 6]} />
      <meshStandardMaterial color="#e6b98a" roughness={0.9} />
    </instancedMesh>
  );
}

/* ---------- Props ---------- */
function Lantern({ position, neon, color = "#ffb347" }: { position: [number, number, number]; neon: number; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[0.18, 1.8, 0.18]} /><meshStandardMaterial color="#6b4a3a" /></mesh>
      <mesh position={[0, 2.05, 0]}><boxGeometry args={[0.5, 0.55, 0.5]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4 + neon * 1.2} toneMapped={false} /></mesh>
      <mesh position={[0, 2.45, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.48, 0.3, 4]} /><meshStandardMaterial color="#3a2c4a" /></mesh>
    </group>
  );
}

function Bench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[2, 0.12, 0.6]} /><meshStandardMaterial color="#c8844f" /></mesh>
      <mesh position={[0, 0.9, -0.28]} castShadow><boxGeometry args={[2, 0.5, 0.1]} /><meshStandardMaterial color="#c8844f" /></mesh>
      {[-0.85, 0.85].map((x) => <mesh key={x} position={[x, 0.25, 0]}><boxGeometry args={[0.12, 0.5, 0.5]} /><meshStandardMaterial color="#4a3a5a" /></mesh>)}
    </group>
  );
}

function Fence({ from, to }: { from: [number, number]; to: [number, number] }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]); const n = Math.floor(len / 1.2);
  return (
    <group position={[from[0], 0, from[1]]} rotation-y={-Math.atan2(to[1] - from[1], to[0] - from[0])}>
      {Array.from({ length: n + 1 }, (_, i) => <mesh key={i} position={[i * 1.2, 0.45, 0]} castShadow><boxGeometry args={[0.14, 0.9, 0.14]} /><meshStandardMaterial color="#b0703f" /></mesh>)}
      <mesh position={[len / 2, 0.65, 0]}><boxGeometry args={[len, 0.1, 0.07]} /><meshStandardMaterial color="#c8844f" /></mesh>
      <mesh position={[len / 2, 0.35, 0]}><boxGeometry args={[len, 0.1, 0.07]} /><meshStandardMaterial color="#c8844f" /></mesh>
    </group>
  );
}

function Spinner({ position, children, speed = 0.8 }: { position: [number, number, number]; children: React.ReactNode; speed?: number }) {
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }, d) => { if (r.current) { r.current.rotation.y += d * speed; r.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.5 + position[0]) * 0.18; } });
  return <group ref={r} position={position}>{children}</group>;
}

function River() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (mat.current) mat.current.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime) * 0.04; });
  return (
    <group position={[0, 0, 12]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} receiveShadow><planeGeometry args={[200, 5]} /><meshStandardMaterial ref={mat} color="#2fb3b0" emissive="#2fb3b0" metalness={0.3} roughness={0.08} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><planeGeometry args={[200, 6.4]} /><meshStandardMaterial color="#f2d7a0" /></mesh>
      {/* Taiko bridge */}
      <group rotation-y={Math.PI / 2}>
        {Array.from({ length: 9 }, (_, i) => {
          const t = (i - 4) / 4; const y = 0.9 * (1 - t * t) + 0.15;
          return <mesh key={i} position={[t * 3.8, y, 0]} rotation-z={-t * 0.45} castShadow><boxGeometry args={[0.9, 0.16, 2.4]} /><meshStandardMaterial color="#d8412f" /></mesh>;
        })}
        {[-1.25, 1.25].map((z) => Array.from({ length: 5 }, (_, i) => {
          const t = (i - 2) / 2; const y = 0.9 * (1 - t * t) + 0.15;
          return <mesh key={`${z}${i}`} position={[t * 3.8, y + 0.45, z]}><boxGeometry args={[0.14, 0.9, 0.14]} /><meshStandardMaterial color="#e05a3a" /></mesh>;
        }))}
      </group>
    </group>
  );
}

/* ---------- Multi-story Japanese architecture ---------- */
function Pagoda({ position, rotation = 0, tiers = 3, w = 4.4, wall, roof, trim = "#d8412f", neon, sign, name, kanji }: {
  position: [number, number, number]; rotation?: number; tiers?: number; w?: number; wall: string; roof: string; trim?: string; neon: number; sign: string; name?: string; kanji?: string;
}) {
  const h = 2.2;
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow><boxGeometry args={[w + 1.4, 0.5, w + 1.4]} /><meshStandardMaterial color="#b9a58c" /></mesh>
      {Array.from({ length: tiers }, (_, t) => {
        const s = 1 - t * 0.16, y = 0.5 + t * h, ww = w * s;
        return (
          <group key={t} position={[0, y, 0]}>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[ww, h, ww]} /><meshStandardMaterial color={wall} roughness={0.8} /></mesh>
            {[-1, 1].map((sx) => <mesh key={sx} position={[sx * ww * 0.5, h / 2, ww * 0.5]} castShadow><boxGeometry args={[0.22, h, 0.22]} /><meshStandardMaterial color={trim} /></mesh>)}
            {Array.from({ length: 3 }, (_, k) => (
              <mesh key={k} position={[(k - 1) * ww * 0.3, h * 0.5, ww / 2 + 0.01]}>
                <planeGeometry args={[ww * 0.22, h * 0.45]} />
                <meshStandardMaterial color="#ffe2a8" emissive="#ffb04d" emissiveIntensity={0.35 + neon * 0.9} toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[0, h * 0.14, ww / 2 + 0.25]}><boxGeometry args={[ww + 0.2, 0.1, 0.5]} /><meshStandardMaterial color={trim} /></mesh>
            {/* flared roof */}
            <mesh position={[0, h + 0.3, 0]} rotation-y={Math.PI / 4} scale={[1, 0.45, 1]} castShadow><coneGeometry args={[ww * 0.98, 1.6, 4, 1, true]} /><meshStandardMaterial color={roof} side={THREE.DoubleSide} /></mesh>
            <mesh position={[0, h + 0.05, 0]}><boxGeometry args={[ww * 0.95, 0.12, ww * 0.95]} /><meshStandardMaterial color="#2a2233" /></mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.5 + tiers * h + 0.9, 0]}><cylinderGeometry args={[0.05, 0.1, 1.6, 6]} /><meshStandardMaterial color="#ffcf5a" metalness={0.8} roughness={0.3} /></mesh>
      {/* Vertical kanji neon sign */}
      {kanji && (
        <group position={[w * 0.55, 3.2, w * 0.5 + 0.2]}>
          <mesh><boxGeometry args={[0.8, 3.4, 0.12]} /><meshStandardMaterial color="#1a1328" /></mesh>
          <Text position={[0, 0, 0.08]} fontSize={0.6} lineHeight={1} maxWidth={0.6} color={sign} anchorX="center" anchorY="middle" textAlign="center">
            {kanji.split("").join("\n")}
            <meshStandardMaterial color={sign} emissive={sign} emissiveIntensity={0.6 + neon * 1.5} toneMapped={false} />
          </Text>
        </group>
      )}
      {name && (
        <group position={[0, 0.5 + h * 0.95, w / 2 + 0.35]}>
          <mesh><boxGeometry args={[w * 0.95, 0.6, 0.1]} /><meshStandardMaterial color="#1a1328" /></mesh>
          <Text position={[0, 0, 0.07]} fontSize={0.26} maxWidth={w * 0.9} color={sign} anchorX="center" anchorY="middle" textAlign="center">
            {name.toUpperCase()}
            <meshStandardMaterial color={sign} emissive={sign} emissiveIntensity={0.6 + neon * 1.5} toneMapped={false} />
          </Text>
        </group>
      )}
    </group>
  );
}

function Shop({ position, rotation = 0, wall, awning, neon }: { position: [number, number, number]; rotation?: number; wall: string; awning: string; neon: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow><boxGeometry args={[3, 3.2, 2.6]} /><meshStandardMaterial color={wall} /></mesh>
      <mesh position={[0, 3.45, 0]} rotation-y={Math.PI / 4} scale={[1, 0.4, 1]} castShadow><coneGeometry args={[2.4, 1.6, 4]} /><meshStandardMaterial color="#c8413a" /></mesh>
      <mesh position={[0, 1.2, 1.31]}><planeGeometry args={[2.2, 1.4]} /><meshStandardMaterial color="#ffe2a8" emissive="#ffb04d" emissiveIntensity={0.3 + neon} toneMapped={false} /></mesh>
      <mesh position={[0, 2.15, 1.6]} rotation-x={0.5} castShadow><boxGeometry args={[3, 0.08, 0.9]} /><meshStandardMaterial color={awning} /></mesh>
      <mesh position={[0, 2.8, 1.32]}><planeGeometry args={[1.8, 0.4]} /><meshStandardMaterial color={awning} emissive={awning} emissiveIntensity={neon} toneMapped={false} /></mesh>
    </group>
  );
}

/* ---------- Rainbow aura for selected district ---------- */
function RainbowAura({ index }: { index: number | null }) {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const strength = useRef(0);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float uTime; uniform float uAlpha; varying vec2 vUv;
      vec3 hsv(float h){ vec3 k=vec3(1.,2./3.,1./3.); vec3 p=abs(fract(vec3(h)+k)*6.-3.); return clamp(p-1.,0.,1.); }
      void main(){ float bands = 0.6+0.4*sin(vUv.y*18.-uTime*4.); vec3 c=hsv(vUv.x*2.+uTime*0.15)*2.2*bands;
        gl_FragColor=vec4(c, pow(1.-vUv.y,1.6)*uAlpha); }`,
  }), []);
  const last = useRef<number>(0);
  useFrame(({ clock }, raw) => {
    const d = Math.min(raw, 0.05);
    if (index !== null) last.current = index;
    strength.current = THREE.MathUtils.damp(strength.current, index !== null ? 1 : 0, 3, d);
    mat.uniforms["uTime"]!.value = clock.elapsedTime; mat.uniforms["uAlpha"]!.value = strength.current * 0.75;
    const z = ZONES[last.current]!;
    if (group.current) { group.current.position.set(z.pos[0], 0, z.pos[2]); group.current.rotation.y += d * 0.3; }
    if (light.current) { light.current.color.setHSL((clock.elapsedTime * 0.12) % 1, 1, 0.6); light.current.intensity = strength.current * 60; }
  });
  return (
    <group ref={group}>
      <mesh position={[0, 4, 0]} material={mat}><cylinderGeometry args={[9.5, 9.5, 8, 64, 1, true]} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]} material={mat}><ringGeometry args={[8.6, 9.8, 64]} /></mesh>
      <pointLight ref={light} position={[0, 7, 0]} distance={26} decay={1.4} />
    </group>
  );
}

function District({ index, onSelect, children }: { index: number; onSelect: (i: number) => void; children: React.ReactNode }) {
  const z = ZONES[index]!;
  return (
    <group position={z.pos} onClick={(e) => { e.stopPropagation(); onSelect(index); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => (document.body.style.cursor = "")}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} receiveShadow><circleGeometry args={[9.5, 32]} /><meshStandardMaterial color="#efb27a" roughness={0.95} /></mesh>
      {children}
    </group>
  );
}

function ProductMarket({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  const cols = ["#ff5fa2", "#5ad1ff", "#ffcf5a"];
  return (
    <District index={1} onSelect={onSelect}>
      <Pagoda position={[0, 0, -4]} tiers={4} wall="#fff1de" roof="#c8413a" neon={neon} sign="#ffd36a" name="3D Product Visualization Market" kanji="製品館" />
      <Shop position={[-6, 0, -1]} rotation={0.6} wall="#f7e2c6" awning="#ff5fa2" neon={neon} />
      <Shop position={[6, 0, -1]} rotation={-0.6} wall="#f4dcc0" awning="#5ad1ff" neon={neon} />
      {cols.map((c, i) => (
        <group key={i} position={[(i - 1) * 2.8, 0, 3]}>
          <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.6, 0.7, 1, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.3} /></mesh>
          <Spinner position={[0, 1.7, 0]}>
            <mesh castShadow>
              {i === 0 ? <torusKnotGeometry args={[0.3, 0.1, 80, 10]} /> : i === 1 ? <icosahedronGeometry args={[0.45, 0]} /> : <capsuleGeometry args={[0.2, 0.5, 4, 10]} />}
              <meshStandardMaterial color={c} metalness={0.7} roughness={0.15} emissive={c} emissiveIntensity={neon * 0.3} />
            </mesh>
          </Spinner>
        </group>
      ))}
      <Lantern position={[-8, 0, 4]} neon={neon} /><Lantern position={[8, 0, 4]} neon={neon} />
      <Bench position={[-4, 0, 6.5]} rotation={Math.PI} /><Bench position={[4, 0, 6.5]} rotation={Math.PI} />
    </District>
  );
}

function AssetMall({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  return (
    <District index={2} onSelect={onSelect}>
      <Pagoda position={[0, 0, -4]} tiers={3} w={5.4} wall="#3a2d5c" roof="#1f1836" trim="#ff3fa4" neon={neon} sign="#00e5ff" name="Game Asset Mall" kanji="素材堂" />
      <Pagoda position={[-6, 0, 0]} rotation={0.5} tiers={2} w={3.4} wall="#2d2547" roof="#1f1836" trim="#b36bff" neon={neon} sign="#ff3fa4" />
      <Pagoda position={[6, 0, 0]} rotation={-0.5} tiers={2} w={3.4} wall="#27324f" roof="#1f1836" trim="#39ff88" neon={neon} sign="#39ff88" />
      <Spinner position={[0, 2.4, 3]} speed={0.5}>
        <mesh><boxGeometry args={[1.6, 1.6, 1.6]} /><meshStandardMaterial color="#00e5ff" wireframe emissive="#00e5ff" emissiveIntensity={1 + neon} toneMapped={false} /></mesh>
      </Spinner>
      <Lantern position={[-8, 0, 4]} neon={neon} color="#ff3fa4" /><Lantern position={[8, 0, 4]} neon={neon} color="#00e5ff" />
    </District>
  );
}

function UnityHub({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  const signs = ["#ff3fa4", "#00e5ff", "#b36bff", "#39ff88"];
  return (
    <District index={3} onSelect={onSelect}>
      <Pagoda position={[0, 0, -4]} tiers={5} w={4} wall="#f2e3cc" roof="#2a3a6a" trim="#d8412f" neon={neon} sign="#ff3fa4" name="Unity C# Arcade Hub" kanji="遊戯場" />
      {signs.map((c, i) => (
        <group key={c} position={[(i - 1.5) * 2.2, 0, 3]} rotation-y={Math.PI}>
          <mesh position={[0, 1, 0]} castShadow><boxGeometry args={[1.1, 2, 0.9]} /><meshStandardMaterial color="#1c1a2e" /></mesh>
          <mesh position={[0, 1.35, -0.46]} rotation-y={Math.PI}><planeGeometry args={[0.8, 0.6]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8 + neon} toneMapped={false} /></mesh>
        </group>
      ))}
      <Lantern position={[-7, 0, 5]} neon={neon} color="#b36bff" /><Lantern position={[7, 0, 5]} neon={neon} color="#39ff88" />
    </District>
  );
}

function ContactSquare({ neon, onSelect }: { neon: number; onSelect: (i: number) => void }) {
  const cols = ["#ea4335", "#25d366", "#29a9eb", "#1877f2", "#ff0000", "#222222", "#e1306c", "#6e5494"];
  return (
    <District index={4} onSelect={onSelect}>
      <Pagoda position={[0, 0, -5]} tiers={2} w={5} wall="#f6e7d0" roof="#c8413a" neon={neon} sign="#ffd36a" name="Post & Social Square" kanji="郵便" />
      {[-4.5, 4.5].map((x) => (
        <group key={x} position={[x, 0, -0.5]}>
          <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1, 2.4, 1]} /><meshStandardMaterial color="#d8322c" /></mesh>
          <mesh position={[0, 1.3, 0.51]}><planeGeometry args={[0.7, 1.5]} /><meshStandardMaterial color="#bfe8ff" emissive="#bfe8ff" emissiveIntensity={neon * 0.5} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.3, 2.5]} castShadow receiveShadow><cylinderGeometry args={[1.8, 2, 0.6, 16]} /><meshStandardMaterial color="#d7c9b4" /></mesh>
      <mesh position={[0, 0.62, 2.5]}><cylinderGeometry args={[1.55, 1.55, 0.05, 16]} /><meshStandardMaterial color="#3fc0d8" metalness={0.5} roughness={0.08} /></mesh>
      {cols.map((c, i) => {
        const a = (i / cols.length) * Math.PI * 2;
        return (
          <Spinner key={c} position={[Math.cos(a) * 3.4, 2.4, 2.5 + Math.sin(a) * 3.4]} speed={1}>
            <mesh castShadow><boxGeometry args={[0.6, 0.6, 0.14]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.3 + neon * 0.4} /></mesh>
          </Spinner>
        );
      })}
      <Bench position={[-5, 0, 5]} rotation={Math.PI - 0.4} /><Bench position={[5, 0, 5]} rotation={Math.PI + 0.4} />
    </District>
  );
}

/* ---------- Mountain + Hollywood sign ---------- */
function Mountain({ neon }: { neon: number }) {
  return (
    <group position={[0, 0, -72]}>
      <mesh position={[0, 12, 0]} castShadow receiveShadow><coneGeometry args={[36, 26, 10, 4]} /><meshStandardMaterial color="#5c8f3a" flatShading /></mesh>
      <mesh position={[-38, 8, 8]}><coneGeometry args={[24, 18, 9, 3]} /><meshStandardMaterial color="#6d8c35" flatShading /></mesh>
      <mesh position={[38, 9, 6]}><coneGeometry args={[26, 20, 9, 3]} /><meshStandardMaterial color="#4f8238" flatShading /></mesh>
      <mesh position={[0, 23, 0]}><coneGeometry args={[6.5, 5, 10]} /><meshStandardMaterial color="#f8f4ff" flatShading /></mesh>
      <group position={[0, 15.5, 13]} rotation-x={-0.2}>
        <Center>
          <Text3D font="/fonts/helvetiker_bold.typeface.json" size={3.4} height={0.9} bevelEnabled bevelSize={0.1} bevelThickness={0.12} letterSpacing={0.25} castShadow>
            MEWO STUDIOS
            <meshStandardMaterial color="#fde9f2" emissive="#ffd6a0" emissiveIntensity={0.05 + neon * 0.45} roughness={0.35} />
          </Text3D>
        </Center>
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-20 + i * 3.6, -2.8, -0.5]}><boxGeometry args={[0.2, 3.2, 0.2]} /><meshStandardMaterial color="#5a4a3a" /></mesh>)}
      </group>
    </group>
  );
}

/* ---------- Weather FX ---------- */
function Rain({ live }: { live: React.MutableRefObject<Live> }) {
  const pts = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(); const arr = new Float32Array(3500 * 3);
    for (let i = 0; i < 3500; i++) { arr[i * 3] = (rand(i) - 0.5) * 100; arr[i * 3 + 1] = rand(i + 1) * 35; arr[i * 3 + 2] = (rand(i + 2) - 0.5) * 90; }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); return g;
  }, []);
  useFrame((_, raw) => {
    const r = live.current.rain;
    if (pts.current) pts.current.visible = r > 0.05;
    if (matRef.current) matRef.current.opacity = r * 0.75;
    if (r < 0.05) return;
    const d = Math.min(raw, 0.05); const p = geo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) - 30 * d; if (y < 0) y = 35; p.setY(i, y); }
    p.needsUpdate = true;
  });
  return <points ref={pts} geometry={geo}><pointsMaterial ref={matRef} color="#d6ebff" size={0.1} transparent /></points>;
}

function Puddles({ live }: { live: React.MutableRefObject<Live> }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.visible = live.current.rain > 0.3; });
  const spots: [number, number, number][] = [[2, 3, 1.2], [-6, 0, 0.9], [8, -2, 1], [-2, -12, 1.3], [12, -10, 0.8], [-12, -8, 1], [0, 20, 1.4]];
  return (
    <group ref={g}>
      {spots.map(([x, z, r], i) => <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.09, z]}><circleGeometry args={[r, 20]} /><meshStandardMaterial color="#9fb6cc" metalness={1} roughness={0.04} transparent opacity={0.8} /></mesh>)}
    </group>
  );
}

function CameraRig({ zone, yaw, zoom }: { zone: number; yaw: React.MutableRefObject<number>; zoom: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 4, -24));
  useFrame((state, raw) => {
    const d = Math.min(raw, 0.05); const z = ZONES[zone]!;
    const target = new THREE.Vector3(...z.pos);
    const base = new THREE.Vector3(...z.cam).sub(target).multiplyScalar(zoom.current);
    base.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current + state.pointer.x * 0.1);
    base.y += state.pointer.y * 1.5;
    const want = target.clone().add(base);
    camera.position.set(THREE.MathUtils.damp(camera.position.x, want.x, 2.2, d), THREE.MathUtils.damp(camera.position.y, want.y, 2.2, d), THREE.MathUtils.damp(camera.position.z, want.z, 2.2, d));
    look.current.lerp(target.clone().add(new THREE.Vector3(0, 2, 0)), 1 - Math.exp(-2.2 * d));
    camera.lookAt(look.current);
  });
  return null;
}

function Scene({ zone, selected, onSelect, onPhase, yaw, zoom }: {
  zone: number; selected: number | null; onSelect: (i: number) => void; onPhase: (p: Phase) => void; yaw: React.MutableRefObject<number>; zoom: React.MutableRefObject<number>;
}) {
  const { scene } = useThree();
  const live = useRef<Live>({ sky: new THREE.Color(), sun: new THREE.Color(), grass: new THREE.Color(), tip: new THREE.Color(), sunI: 2, amb: 0.5, sunPos: new THREE.Vector3(), neon: 0, fogNear: 60, fogFar: 180, rain: 0, dim: 1 });
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ground = useRef<THREE.MeshStandardMaterial>(null);
  const nightLights = useRef<THREE.Group>(null);
  const [neon, setNeon] = useState(0.1);
  const lastPhase = useRef(-1);
  const tmp = useMemo(() => new THREE.Color(), []);

  useMemo(() => { scene.background = new THREE.Color(); scene.fog = new THREE.Fog("#ffffff", 60, 180); }, [scene]);

  useFrame(({ clock }, raw) => {
    const d = Math.min(raw, 0.05);
    const t = (clock.elapsedTime / PHASE_SECONDS) % PHASES.length;
    const i = Math.floor(t); const f = THREE.MathUtils.smoothstep(t - i, 0.65, 1);
    const a = PHASES[i]!.p, b = PHASES[(i + 1) % PHASES.length]!.p;
    const L = live.current;
    const mix = (x: number, y: number) => x + (y - x) * f;
    L.sky.set(a.sky).lerp(tmp.set(b.sky), f); L.sun.set(a.sun).lerp(tmp.set(b.sun), f);
    L.grass.set(a.grass).lerp(tmp.set(b.grass), f); L.tip.set(a.tip).lerp(tmp.set(b.tip), f);
    L.sunI = mix(a.sunI, b.sunI); L.amb = mix(a.amb, b.amb); L.neon = mix(a.neon, b.neon);
    L.fogNear = mix(a.fogNear, b.fogNear); L.fogFar = mix(a.fogFar, b.fogFar); L.rain = mix(a.rain, b.rain);
    L.sunPos.set(mix(a.sunPos[0], b.sunPos[0]), mix(a.sunPos[1], b.sunPos[1]), mix(a.sunPos[2], b.sunPos[2]));
    L.dim = THREE.MathUtils.damp(L.dim, selected !== null ? 0.3 : 1, 2.5, d);

    const bg = scene.background as THREE.Color; bg.copy(L.sky).multiplyScalar(0.4 + 0.6 * L.dim);
    const fog = scene.fog as THREE.Fog; fog.color.copy(bg); fog.near = L.fogNear * (0.6 + 0.4 * L.dim); fog.far = L.fogFar;
    if (sun.current) { sun.current.color.copy(L.sun); sun.current.intensity = L.sunI * L.dim; sun.current.position.copy(L.sunPos); }
    if (amb.current) amb.current.intensity = L.amb * (0.5 + 0.5 * L.dim);
    if (hemi.current) { hemi.current.color.copy(L.sky); hemi.current.groundColor.copy(L.grass); hemi.current.intensity = 0.5 * L.dim; }
    if (ground.current) ground.current.color.copy(L.grass).multiplyScalar(0.85);
    if (nightLights.current) { const k = THREE.MathUtils.clamp((L.neon - 1) / 2, 0, 1); nightLights.current.children.forEach((c, j) => { (c as THREE.PointLight).intensity = k * (j === 4 ? 80 : 25); }); }

    const phaseIdx = f > 0.5 ? (i + 1) % PHASES.length : i;
    if (phaseIdx !== lastPhase.current) { lastPhase.current = phaseIdx; onPhase(PHASES[phaseIdx]!.name); }
    const q = Math.round(L.neon * 2) / 2; if (q !== neon) setNeon(q);
  });

  return (
    <>
      <ambientLight ref={amb} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={160} />
      <Environment resolution={64}>
        <Lightformer intensity={1.2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.8} color="#ffb070" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <CameraRig zone={zone} yaw={yaw} zoom={zoom} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[260, 260]} /><meshStandardMaterial ref={ground} roughness={1} /></mesh>
      <Grass live={live} />
      <Trees />
      <Paths />
      <River />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 6]} receiveShadow><circleGeometry args={[4.5, 32]} /><meshStandardMaterial color="#efb27a" /></mesh>
      <Lantern position={[-3.5, 0, 6]} neon={neon} /><Lantern position={[3.5, 0, 6]} neon={neon} />
      <Lantern position={[-2, 0, 17]} neon={neon} /><Lantern position={[2, 0, 17]} neon={neon} />
      <Fence from={[-12, 16]} to={[-3, 18]} /><Fence from={[3, 18]} to={[12, 16]} />
      <Bench position={[-6, 0, 20]} /><Bench position={[6, 0, 20]} />

      <Suspense fallback={null}>
      <ProductMarket neon={neon} onSelect={onSelect} />
      <AssetMall neon={neon} onSelect={onSelect} />
      <UnityHub neon={neon} onSelect={onSelect} />
      <ContactSquare neon={neon} onSelect={onSelect} />
      </Suspense>
      <Suspense fallback={null}><Mountain neon={neon} /></Suspense>
      <RainbowAura index={selected !== null && selected > 0 ? selected : null} />

      <group ref={nightLights}>
        {ZONES.slice(1).map((z, i) => <pointLight key={z.id} position={[z.pos[0], 4, z.pos[2] + 3]} color={["#ffb347", "#ff3fa4", "#b36bff", "#ffcf5a"][i]!} intensity={25} distance={16} />)}
        <pointLight position={[0, 20, -50]} color="#fff0c0" intensity={80} distance={45} />
      </group>
      <Rain live={live} />
      <Puddles live={live} />

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.85} intensity={0.9} resolutionScale={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.55} />
      </EffectComposer>
    </>
  );
}

export function VillageWorld({ zone, selected, onSelect, onPhase }: { zone: number; selected: number | null; onSelect: (i: number) => void; onPhase: (p: Phase) => void }) {
  const yaw = useRef(0);
  const zoom = useRef(1);
  const drag = useRef<number | null>(null);
  return (
    <Canvas
      shadows
      dpr={[1, 1.25]}
      performance={{ min: 0.6 }}
      gl={{ toneMapping: THREE.NoToneMapping, antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ position: [0, 18, 52], fov: 48, far: 400 }}
      onPointerDown={(e) => { drag.current = e.clientX; }}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        yaw.current = THREE.MathUtils.clamp(yaw.current - (e.clientX - drag.current) * 0.006, -1.3, 1.3);
        drag.current = e.clientX;
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      <Scene zone={zone} selected={selected} onSelect={onSelect} onPhase={onPhase} yaw={yaw} zoom={zoom} />
    </Canvas>
  );
}
