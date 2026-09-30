import { Environment, Float, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type PointerState = { x: number; y: number; scroll: number };

function Crystal({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const delta = Math.min(rawDelta, 0.05);
    mesh.rotation.y += delta * 0.45;
    mesh.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2 + position[0]) * 0.16;
  });
  return (
    <mesh ref={ref} position={position} scale={scale} castShadow>
      <octahedronGeometry args={[0.62, 1]} />
      <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.2} metalness={0.45} clearcoat={1} />
    </mesh>
  );
}

function Terrain() {
  const heights = useMemo(
    () => Array.from({ length: 49 }, (_, i) => 0.16 + ((i * 17) % 9) * 0.035),
    [],
  );
  return (
    <group position={[0, -1.7, 0]}>
      <RoundedBox args={[11, 0.8, 8]} radius={0.35} smoothness={5} receiveShadow>
        <meshStandardMaterial color="#0d2330" roughness={0.72} metalness={0.38} />
      </RoundedBox>
      {heights.map((height, index) => {
        const x = (index % 7 - 3) * 1.35;
        const z = (Math.floor(index / 7) - 3) * 0.95;
        const nearRiver = Math.abs(x - z * 0.42) < 0.72;
        if (nearRiver) return null;
        return (
          <mesh key={`${x}-${z}`} position={[x, 0.48 + height / 2, z]} rotation-y={(index % 5) * 0.4} castShadow>
            <coneGeometry args={[0.16 + (index % 3) * 0.035, height + 0.32, 5]} />
            <meshStandardMaterial color={index % 4 === 0 ? "#24586a" : "#17404c"} roughness={0.76} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.44, 0]} rotation-x={-Math.PI / 2} rotation-z={-0.42}>
        <planeGeometry args={[0.44, 8.3, 1, 24]} />
        <meshStandardMaterial color="#40d9f2" emissive="#23b9d5" emissiveIntensity={1.7} transparent opacity={0.82} />
      </mesh>
      <gridHelper args={[10.5, 22, "#1c6576", "#123743"]} position={[0, 0.44, 0]} />
    </group>
  );
}

function CoreObject() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, rawDelta) => {
    const node = group.current;
    if (!node) return;
    const delta = Math.min(rawDelta, 0.05);
    node.rotation.y += delta * 0.16;
    node.rotation.z = Math.sin(clock.elapsedTime * 0.45) * 0.05;
  });
  return (
    <Float speed={1.6} rotationIntensity={0.22} floatIntensity={0.32}>
      <group ref={group} position={[0.4, 1, 0]}>
        <mesh castShadow>
          <icosahedronGeometry args={[1.65, 2]} />
          <meshPhysicalMaterial color="#101822" roughness={0.16} metalness={0.82} clearcoat={1} />
        </mesh>
        <mesh scale={1.72}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial color="#50e6ff" wireframe transparent opacity={0.5} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[2.35, 0.025, 8, 96]} />
          <meshBasicMaterial color="#ff4bc4" toneMapped={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2.7} rotation-y={0.4}>
          <torusGeometry args={[2.65, 0.018, 8, 96]} />
          <meshBasicMaterial color="#54f1ff" toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

function CameraRig({ pointer }: { pointer: React.RefObject<PointerState> }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const input = pointer.current;
    if (!input) return;
    const damp = 1 - Math.exp(-3.2 * delta);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, input.x * 1.25, damp);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.6 + input.y * 0.5 - input.scroll * 1.1, damp);
    target.set(0, 0.1 + input.scroll * 0.6, 0);
    camera.lookAt(target);
  });
  return null;
}

export function InteractiveScene() {
  const pointer = useRef<PointerState>({ x: 0, y: 0, scroll: 0 });

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    const onScroll = () => {
      pointer.current.scroll = Math.min(window.scrollY / window.innerHeight, 1);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <Canvas shadows dpr={[1, 1.65]} camera={{ position: [0, 4.6, 11.5], fov: 44 }} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 12, 27]} />
      <ambientLight intensity={0.55} color="#6695aa" />
      <directionalLight position={[5, 9, 7]} intensity={2.7} color="#b6efff" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-5, 2, 1]} intensity={18} distance={12} color="#ff2bb5" />
      <pointLight position={[4, 0, 2]} intensity={14} distance={10} color="#19ddff" />
      <Terrain />
      <CoreObject />
      <Crystal position={[-3.25, -0.2, 0.5]} color="#ff3fc1" scale={0.62} />
      <Crystal position={[3.25, 0.15, -1.3]} color="#45eaff" scale={0.8} />
      <Crystal position={[2.25, -0.55, 2.4]} color="#ffd166" scale={0.4} />
      <Environment resolution={128}>
        <Lightformer intensity={2.5} position={[0, 6, 2]} scale={[10, 3, 1]} />
        <Lightformer intensity={3} color="#24d7ff" position={[5, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer intensity={2} color="#ff3bbf" position={[-5, 0, 1]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
      </Environment>
      <CameraRig pointer={pointer} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.85} maxPolarAngle={1.35} rotateSpeed={0.45} />
    </Canvas>
  );
}