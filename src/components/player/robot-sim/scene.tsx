"use client";

/**
 * Three.js view of the arena. Loaded only on rover lessons (next/dynamic).
 * Reads `runner.live` each frame — no React state per frame — and stops
 * rendering while off-screen or in a hidden tab.
 */
import { useEffect, useRef } from "react";
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Fog, GridHelper, Group, HemisphereLight, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene as ThreeScene, SphereGeometry, TorusGeometry, Vector3, WebGLRenderer } from "three";
import { ROBOT, forwardOf, rayDirection, type Pose } from "@/lib/sim/physics";
import { prefersReducedMotion } from "@/lib/sound/sound";
import type { SimRunner } from "./runner";

const LIGHT = { sky: 0xe6edf6, ground: 0xdfe7f0, grid: 0xb8c4d4, wall: 0x4f5ed3, line: 0x1f2937 };
const DARK = { sky: 0x1b2030, ground: 0x242b3d, grid: 0x3a4357, wall: 0x7c86f0, line: 0xcbd5e1 };
const RAY_NEAR = new Color(0xf05a3c);
const RAY_FAR = new Color(0x2fa37a);

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function buildRover(): Group {
  const g = new Group();
  const body = new Mesh(new BoxGeometry(0.5, 0.2, 0.62), new MeshStandardMaterial({ color: 0xf26b4a, roughness: 0.55 }));
  body.position.y = 0.22;
  g.add(body);
  const cab = new Mesh(new BoxGeometry(0.34, 0.14, 0.26), new MeshStandardMaterial({ color: 0xfff1e8, roughness: 0.6 }));
  cab.position.set(0, 0.39, 0.04);
  g.add(cab);
  const eye = new Mesh(new SphereGeometry(0.07, 12, 12), new MeshStandardMaterial({ color: 0x1f2937, emissive: 0x2a78d6, emissiveIntensity: 0.6 }));
  eye.position.set(0, 0.3, -0.33);
  g.add(eye);
  const wheelGeo = new CylinderGeometry(0.11, 0.11, 0.08, 16);
  const wheelMat = new MeshStandardMaterial({ color: 0x1f2430, roughness: 0.9 });
  for (const [x, z] of [
    [-0.28, -0.2],
    [0.28, -0.2],
    [-0.28, 0.2],
    [0.28, 0.2],
  ]) {
    const w = new Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.11, z);
    g.add(w);
  }
  return g;
}

export default function Scene({ runner, topView, onUnavailable }: { runner: SimRunner; topView: boolean; onUnavailable: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const topRef = useRef(topView);
  useEffect(() => {
    topRef.current = topView;
  }, [topView]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    } catch {
      onUnavailable();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const arena = runner.arena;
    const scene = new ThreeScene();
    const camera = new PerspectiveCamera(50, 16 / 10, 0.1, 100);
    const theme = isDark() ? DARK : LIGHT;
    scene.background = new Color(theme.sky);
    scene.fog = new Fog(theme.sky, 14, 30);

    scene.add(new HemisphereLight(0xffffff, 0x8899aa, 0.95));
    const sun = new DirectionalLight(0xffffff, 1.1);
    sun.position.set(4, 9, 5);
    scene.add(sun);

    const groundMat = new MeshStandardMaterial({ color: theme.ground, roughness: 1 });
    const ground = new Mesh(new PlaneGeometry(arena.width, arena.depth), groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new GridHelper(Math.max(arena.width, arena.depth), Math.max(arena.width, arena.depth), theme.grid, theme.grid);
    grid.position.y = 0.002;
    scene.add(grid);

    const wallMat = new MeshStandardMaterial({ color: theme.wall, roughness: 0.5 });
    const wallH = 0.6;
    const addWall = (x: number, z: number, w: number, d: number) => {
      const m = new Mesh(new BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      scene.add(m);
    };
    for (const b of arena.obstacles) addWall(b.x, b.z, b.w, b.d);
    // Boundary rails
    const t = 0.12;
    addWall(0, -arena.depth / 2 - t / 2, arena.width + 2 * t, t);
    addWall(0, arena.depth / 2 + t / 2, arena.width + 2 * t, t);
    addWall(-arena.width / 2 - t / 2, 0, t, arena.depth);
    addWall(arena.width / 2 + t / 2, 0, t, arena.depth);

    if (arena.line) {
      const lineMat = new MeshBasicMaterial({ color: theme.line });
      for (let i = 0; i < arena.line.length - 1; i++) {
        const a = arena.line[i]!;
        const b = arena.line[i + 1]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z) + 0.25;
        const seg = new Mesh(new PlaneGeometry(len, 0.25), lineMat);
        seg.rotation.x = -Math.PI / 2;
        seg.rotation.z = -Math.atan2(b.z - a.z, b.x - a.x);
        seg.position.set((a.x + b.x) / 2, 0.006, (a.z + b.z) / 2);
        scene.add(seg);
      }
    }

    const goal = new Group();
    const ring = new Mesh(new TorusGeometry(arena.goal.r, 0.05, 10, 40), new MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    goal.add(ring);
    const pole = new Mesh(new CylinderGeometry(0.03, 0.03, 1.2, 8), new MeshStandardMaterial({ color: 0xffffff }));
    pole.position.y = 0.6;
    goal.add(pole);
    const flag = new Mesh(new ConeGeometry(0.22, 0.4, 3), new MeshStandardMaterial({ color: 0xf2b541 }));
    flag.rotation.z = -Math.PI / 2;
    flag.position.set(0.2, 1.05, 0);
    goal.add(flag);
    goal.position.set(arena.goal.x, 0, arena.goal.z);
    scene.add(goal);

    const rover = buildRover();
    scene.add(rover);

    const rayMats = [0, 1, 2].map(() => new LineBasicMaterial({ color: RAY_FAR }));
    const rays = rayMats.map((m) => {
      const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
      const l = new Line(geo, m);
      scene.add(l);
      return l;
    });

    const TRAIL_MAX = 1200;
    const trailGeo = new BufferGeometry();
    trailGeo.setAttribute("position", new BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new Line(trailGeo, new LineBasicMaterial({ color: 0xf26b4a, transparent: true, opacity: 0.7 }));
    scene.add(trail);
    let trailSeen = -1;

    const reduced = prefersReducedMotion();
    const camPos = new Vector3();
    const camTarget = new Vector3();
    const wantPos = new Vector3();
    const wantTarget = new Vector3();
    let firstFrame = true;

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const themeObs = new MutationObserver(() => {
      const th = isDark() ? DARK : LIGHT;
      (scene.background as Color).set(th.sky);
      scene.fog!.color.set(th.sky);
      groundMat.color.set(th.ground);
      wallMat.color.set(th.wall);
      grid.material.color.set(th.grid);
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const updateCamera = (pose: Pose) => {
      if (topRef.current) {
        wantPos.set(0, Math.max(arena.width, arena.depth) * 1.05, 0.01);
        wantTarget.set(0, 0, 0);
      } else {
        const f = forwardOf(pose.heading);
        wantPos.set(pose.x - f.x * 3.4, 2.3, pose.z - f.z * 3.4);
        wantTarget.set(pose.x + f.x * 1.2, 0.35, pose.z + f.z * 1.2);
      }
      const k = firstFrame || reduced ? 1 : 0.12;
      camPos.lerp(wantPos, k);
      camTarget.lerp(wantTarget, k);
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      firstFrame = false;
    };

    let last = performance.now();
    const frame = (now: number) => {
      const live = runner.live;
      const p = live.pose;
      rover.position.set(p.x, 0, p.z);
      rover.rotation.y = p.heading;
      const readings = [live.sensors.left, live.sensors.front, live.sensors.right];
      const angles = [ROBOT.rayAngle, 0, -ROBOT.rayAngle];
      rays.forEach((l, i) => {
        const d = rayDirection(p.heading, angles[i]!);
        const len = readings[i]! * ROBOT.rayRange;
        const pos = l.geometry.attributes.position as BufferAttribute;
        pos.setXYZ(0, p.x, 0.3, p.z);
        pos.setXYZ(1, p.x + d.x * len, 0.3, p.z + d.z * len);
        pos.needsUpdate = true;
        rayMats[i]!.color.copy(RAY_NEAR).lerp(RAY_FAR, Math.min(1, readings[i]! / 0.7));
      });
      if (live.trailVersion !== trailSeen) {
        trailSeen = live.trailVersion;
        const pts = live.trail.slice(-TRAIL_MAX);
        const pos = trailGeo.attributes.position as BufferAttribute;
        pts.forEach((q, i) => pos.setXYZ(i, q.x, 0.02, q.z));
        pos.needsUpdate = true;
        trailGeo.setDrawRange(0, pts.length);
      }
      if (!reduced) {
        const s = 1 + Math.sin(now / 350) * 0.04;
        ring.scale.set(s, s, 1);
      }
      updateCamera(p);
      last = now;
      renderer.render(scene, camera);
    };

    let visible = true;
    const apply = () => renderer.setAnimationLoop(visible && document.visibilityState === "visible" ? frame : null);
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      apply();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", apply);
    apply();
    void last;

    return () => {
      renderer.setAnimationLoop(null);
      io.disconnect();
      ro.disconnect();
      themeObs.disconnect();
      document.removeEventListener("visibilitychange", apply);
      scene.traverse((o) => {
        if (o instanceof Mesh || o instanceof Line) {
          o.geometry.dispose();
          const m = o.material as Material | Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [runner, onUnavailable]);

  return <div ref={host} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />;
}
