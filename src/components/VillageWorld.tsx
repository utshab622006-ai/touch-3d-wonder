import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Text } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type Weather = "day" | "sunset" | "night" | "rain";
export type ZoneId = "entrance" | "product" | "arcade" | "contact";

export const ZONES: { id: ZoneId; pos: [number, number, number]; cam: [number, number, number] }[] = [
  { id: "entrance", pos: [0, 0, 5], cam: [0, 9, 20] },
  { id: "product", pos: [-7, 0, -2], cam: [-2, 6, 7] },
  { id: "arcade", pos: [7, 0, -3], cam: [12, 6, 6] },
  { id: "contact", pos: [0, 0, -9], cam: [4, 5, -1] },
];

const PALETTE: Record<Weather, { sky: string; fog: [number, number]; sun: string; sunI: number; amb: number; sunPos: [number, number, number]; ground: string; neon: number }> = {
  day: { sky: "#9fd3ef", fog: [30, 80], sun: "#fff4dc", sunI: 2.2, amb: 0.6, sunPos: [12, 20, 8], ground: "#6fae5a", neon: 0.2 },
  sunset: { sky: "#f0a36f", fog: [22, 70], sun: "#ff9a52", sunI: 1.9, amb: 0.45, sunPos: [-18, 6, 6], ground: "#8a9a4e", neon: 0.8 },
  night: { sky: "#0c1024", fog: [18, 60], sun: "#8da6ff", sunI: 0.45, amb: 0.3, sunPos: [6, 18, -10], ground: "#2c4a3a", neon: 3 },
  rain: { sky: "#5c6975", fog: [8, 40], sun: "#c9d6e2", sunI: 0.8, amb: 0.55, sunPos: [4, 20, 4], ground: "#4f7a4c", neon: 1.2 },
};

function Building({ position, color, roof, height = 3, onSelect, label, neon, children }: {
  position: [number, number, number]; color: string; roof: string; height?: number; onSelect: () => void; label: string; neon: number; children?: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, d) => {
    if (!group.current) return;
    const s = THREE.MathUtils.damp(group.current.scale.y, hover ? 1.06 : 1, 8, d);
    group.current.scale.set(s, s, s);
  });
  return (
    <group
      ref={group}
      position={position}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
    >
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, height, 3]} />
        <meshStandardMaterial color={color} flatShading roughness={0.8} />
      </mesh>
      <mesh position={[0, height + 0.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.7, 1.6, 4]} />
        <meshStandardMaterial color={roof} flatShading />
      </mesh>
      <mesh position={[0, 0.9, 1.51]}>
        <planeGeometry args={[1, 1.8]} />
        <meshStandardMaterial color="#2a1c14" />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x, height * 0.62, 1.51]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial color="#ffe3a0" emissive="#ffb347" emissiveIntensity={neon} />
        </mesh>
      ))}
      <Text position={[0, height + 2.3, 0]} fontSize={0.45} color={hover ? "#7ff5ff" : "#ffffff"} outlineWidth={0.03} outlineColor="#0b1020" anchorX="center">
        {label}
      </Text>
      {children}
    </group>
  );
}

function Tree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.12, 0.18, 1, 5]} /><meshStandardMaterial color="#6b4a2f" flatShading /></mesh>
      <mesh position={[0, 1.4, 0]} castShadow><icosahedronGeometry args={[0.75, 0]} /><meshStandardMaterial color="#3f8f4a" flatShading /></mesh>
    </group>
  );
}

function Rain({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 1] = Math.random() * 25;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((_, raw) => {
    if (!ref.current || !active) return;
    const d = Math.min(raw, 0.05);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - 22 * d;
      if (y < 0) y = 25;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} visible={active}>
      <pointsMaterial color="#cfe6ff" size={0.08} transparent opacity={0.7} />
    </points>
  );
}

function CameraRig({ zone, yaw }: { zone: number; yaw: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame((state, raw) => {
    const d = Math.min(raw, 0.05);
    const z = ZONES[zone];
    const target = new THREE.Vector3(...z.pos);
    const base = new THREE.Vector3(...z.cam).sub(target);
    base.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current + state.pointer.x * 0.12);
    base.y += state.pointer.y * 1.2;
    const want = target.clone().add(base);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, want.x, 3, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, want.y, 3, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, want.z, 3, d);
    look.current.lerp(target.clone().add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.exp(-3 * d));
    camera.lookAt(look.current);
  });
  return null;
}

function Scene({ weather, zone, onSelect, yaw }: { weather: Weather; zone: number; onSelect: (i: number) => void; yaw: React.MutableRefObject<number> }) {
  const p = PALETTE[weather];
  const spin = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (spin.current) spin.current.rotation.y += d * 0.8; });
  const trees = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const r = 13 + ((i * 37) % 5);
    return { pos: [Math.cos(a) * r, 0, Math.sin(a) * r] as [number, number, number], s: 0.8 + ((i * 13) % 6) / 10 };
  }), []);

  return (
    <>
      <color attach="background" args={[p.sky]} />
      <fog attach="fog" args={[p.sky, ...p.fog]} />
      <ambientLight intensity={p.amb} />
      <hemisphereLight args={[p.sky, p.ground, 0.4]} />
      <directionalLight position={p.sunPos} color={p.sun} intensity={p.sunI} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <Environment resolution={64}>
        <Lightformer intensity={1.5} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.8} color={p.sun} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <CameraRig zone={zone} yaw={yaw} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[20, 12]} />
        <meshStandardMaterial color={p.ground} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[20, 16, 2.2, 12]} />
        <meshStandardMaterial color="#7a5a3c" flatShading />
      </mesh>
      {/* paths */}
      {ZONES.slice(1).map((z) => {
        const len = Math.hypot(z.pos[0], z.pos[2] - 3);
        return (
          <mesh key={z.id} rotation-x={-Math.PI / 2} rotation-z={-Math.atan2(z.pos[0], -(z.pos[2] - 3))} position={[z.pos[0] / 2, 0.02, (z.pos[2] + 3) / 2]} receiveShadow>
            <planeGeometry args={[1.4, len]} />
            <meshStandardMaterial color="#d8c39a" />
          </mesh>
        );
      })}

      {/* Entrance lettering */}
      <group position={[0, 0.02, 6]} onClick={(e) => { e.stopPropagation(); onSelect(0); }}>
        <Text rotation-x={-Math.PI / 2} fontSize={1.5} color="#ffffff" outlineWidth={0.06} outlineColor="#1a2a55" anchorX="center" anchorY="middle" letterSpacing={0.05}>
          MEWO STUDIOS
        </Text>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[13, 2.6]} />
          <meshStandardMaterial color="#35507a" />
        </mesh>
      </group>

      <Building position={ZONES[1].pos} color="#e9e1d2" roof="#3a8fd8" label="Product Viz Center" onSelect={() => onSelect(1)} neon={p.neon} height={3.2}>
        <group ref={spin} position={[2.6, 0.8, 1.8]}>
          <mesh castShadow><torusKnotGeometry args={[0.35, 0.12, 64, 8]} /><meshStandardMaterial color="#ff4fa3" metalness={0.6} roughness={0.2} emissive="#ff4fa3" emissiveIntensity={p.neon * 0.3} /></mesh>
        </group>
      </Building>
      <Building position={ZONES[2].pos} color="#352a4f" roof="#ff4fa3" label="Unity Arcade" onSelect={() => onSelect(2)} neon={p.neon} height={3.8}>
        <mesh position={[0, 2.8, 1.52]}><planeGeometry args={[2.4, 0.5]} /><meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={p.neon} /></mesh>
        <mesh position={[-2.4, 0.6, 1.2]} castShadow><boxGeometry args={[0.8, 1.2, 0.8]} /><meshStandardMaterial color="#00e5ff" wireframe /></mesh>
      </Building>

      {/* Contact hub */}
      <group position={ZONES[3].pos} onClick={(e) => { e.stopPropagation(); onSelect(3); }}
        onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        <mesh position={[0, 0.2, 0]} receiveShadow castShadow><cylinderGeometry args={[2.6, 2.8, 0.4, 8]} /><meshStandardMaterial color="#b9c2cf" flatShading /></mesh>
        <mesh position={[0, 2.2, 0]} castShadow><cylinderGeometry args={[0.18, 0.18, 4, 6]} /><meshStandardMaterial color="#e05a3a" /></mesh>
        <mesh position={[0, 4.3, 0]}><octahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={p.neon} /></mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const cols = ["#ea4335", "#25d366", "#29a9eb", "#1877f2", "#ff0000", "#111111", "#e1306c", "#6e5494"];
          return (
            <mesh key={i} position={[Math.cos(a) * 2, 0.75, Math.sin(a) * 2]} castShadow>
              <boxGeometry args={[0.55, 0.55, 0.55]} />
              <meshStandardMaterial color={cols[i]} emissive={cols[i]} emissiveIntensity={p.neon * 0.25} flatShading />
            </mesh>
          );
        })}
        <Text position={[0, 5.3, 0]} fontSize={0.45} color="#ffffff" outlineWidth={0.03} outlineColor="#0b1020">Contact Hub</Text>
      </group>

      {trees.map((t, i) => <Tree key={i} position={t.pos} s={t.s} />)}
      {[[-3, 0, 2], [4, 0, 1], [-4, 0, -6], [5, 0, -8]].map((pos, i) => <Tree key={`i${i}`} position={pos as [number, number, number]} s={0.7} />)}
      {weather === "night" && [[-3, 0, 3], [3, 0, 3], [-2, 0, -5], [2, 0, -5]].map((pos, i) => (
        <pointLight key={i} position={[pos[0], 2, pos[2]]} color={i % 2 ? "#00e5ff" : "#ff4fa3"} intensity={6} distance={8} />
      ))}
      <Rain active={weather === "rain"} />
    </>
  );
}

export function VillageWorld({ weather, zone, onSelect }: { weather: Weather; zone: number; onSelect: (i: number) => void }) {
  const yaw = useRef(0);
  const drag = useRef<number | null>(null);
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 12, 26], fov: 50 }}
      onPointerDown={(e) => { drag.current = e.clientX; }}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        yaw.current -= (e.clientX - drag.current) * 0.006;
        yaw.current = THREE.MathUtils.clamp(yaw.current, -1.2, 1.2);
        drag.current = e.clientX;
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      <Scene weather={weather} zone={zone} onSelect={onSelect} yaw={yaw} />
    </Canvas>
  );
}
