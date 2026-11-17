import type { Arena } from "@/lib/sim/arena";
import { ROBOT, rayDirection, type Pose, type Sensors } from "@/lib/sim/physics";

/** Top-down map of the arena: walls, line, flag, rover and its three sensor rays. Pure SVG. */
export function Minimap({ arena, pose, sensors, trail, className, title }: { arena: Arena; pose: Pose; sensors: Sensors; trail?: Pose[]; className?: string; title: string }) {
  const { width: w, depth: d } = arena;
  const rays: [number, number][] = [
    [ROBOT.rayAngle, sensors.left],
    [0, sensors.front],
    [-ROBOT.rayAngle, sensors.right],
  ];
  const rayColor = (v: number) => (v < 0.3 ? "var(--color-coral)" : v < 0.6 ? "var(--color-warning)" : "var(--color-success)");
  return (
    <svg viewBox={`${-w / 2} ${-d / 2} ${w} ${d}`} role="img" aria-label={title} className={className}>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="var(--color-muted)" stroke="var(--color-border)" strokeWidth={0.08} />
      {arena.line && <polyline points={arena.line.map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="var(--color-foreground)" strokeWidth={0.22} strokeLinejoin="round" opacity={0.7} />}
      {arena.obstacles.map((b, i) => (
        <rect key={i} x={b.x - b.w / 2} y={b.z - b.d / 2} width={b.w} height={b.d} fill="var(--color-primary)" opacity={0.75} rx={0.05} />
      ))}
      <circle cx={arena.goal.x} cy={arena.goal.z} r={arena.goal.r} fill="var(--color-success)" opacity={0.35} />
      <circle cx={arena.goal.x} cy={arena.goal.z} r={0.14} fill="var(--color-success)" />
      {trail && trail.length > 1 && <polyline points={trail.map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="var(--color-coral)" strokeWidth={0.06} opacity={0.6} />}
      {rays.map(([a, v], i) => {
        const dir = rayDirection(pose.heading, a);
        const len = v * ROBOT.rayRange;
        return <line key={i} x1={pose.x} y1={pose.z} x2={pose.x + dir.x * len} y2={pose.z + dir.z * len} stroke={rayColor(v)} strokeWidth={0.07} strokeDasharray="0.15 0.1" />;
      })}
      <g transform={`translate(${pose.x} ${pose.z}) rotate(${(-pose.heading * 180) / Math.PI})`}>
        <circle r={ROBOT.radius} fill="var(--color-coral)" />
        <polygon points={`0,${-ROBOT.radius - 0.05} -0.14,${-ROBOT.radius + 0.18} 0.14,${-ROBOT.radius + 0.18}`} fill="var(--color-background)" />
      </g>
    </svg>
  );
}
