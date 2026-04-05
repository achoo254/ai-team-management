import type { SparklinePoint } from "@/hooks/use-dashboard";

/**
 * Bar chart of 5h window utilization over recent closed cycles.
 * Each bar = 1 closed 5h window, colored by tier (matches legend above).
 * No external chart lib — plain SVG, accessible, scales with container.
 *
 * Tier colors (same as tier legend):
 *   ≥80% emerald (Đầy) | 50-80% sky (Khá) | 10-50% amber (Thấp) | <10% red (Lãng phí)
 */
interface Props {
  data: SparklinePoint[];
  height?: number;
}

const Y_MAX = 100;
const MARGIN_X = 4;
const MARGIN_TOP = 4;
const MARGIN_BOTTOM = 4;

/** Tailwind text-* class per utilization tier (reused as fill via currentColor). */
function tierColor(pct: number): string {
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-sky-500";
  if (pct >= 10) return "text-amber-500";
  return "text-red-500";
}

/** Short time label: "04/05 15h" (day/month + hour, local tz). */
function shortTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  return `${dd}/${mm} ${hh}h`;
}

export function Sparkline5hCycles({ data, height = 64 }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-12 text-[10px] text-muted-foreground">
        Cần tối thiểu 2 chu kỳ để vẽ biểu đồ biến động
      </div>
    );
  }

  const W = 300;
  const H = height;
  const innerW = W - MARGIN_X * 2;
  const innerH = H - MARGIN_TOP - MARGIN_BOTTOM;
  const n = data.length;
  // Gap between bars — scales down with density so dense charts stay readable
  const gap = n > 20 ? 1 : n > 12 ? 1.5 : 2;
  const barW = Math.max(1, (innerW - gap * (n - 1)) / n);

  const bars = data.map((p, i) => {
    const pct = Math.min(100, Math.max(0, p.utilization_pct));
    const barH = (pct / Y_MAX) * innerH;
    return {
      x: MARGIN_X + i * (barW + gap),
      y: MARGIN_TOP + innerH - barH,
      w: barW,
      h: barH,
      pct: p.utilization_pct,
      seat: p.seat_label,
      when: p.window_end,
      colorClass: tierColor(pct),
    };
  });

  // 80% target line (goal: Đầy)
  const targetY = MARGIN_TOP + innerH - (80 / Y_MAX) * innerH;

  const latest = bars[n - 1];
  const oldest = bars[0];

  return (
    <div className="relative w-full max-w-xl">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height }}
        role="img"
        aria-label={`Biến động 5h peak qua ${n} chu kỳ gần nhất`}
      >
        {/* 80% target line */}
        <line
          x1={MARGIN_X}
          x2={W - MARGIN_X}
          y1={targetY}
          y2={targetY}
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeDasharray="4 2"
          className="text-emerald-500"
        />
        <text
          x={W - MARGIN_X - 1}
          y={targetY - 3}
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.45"
          className="text-emerald-500"
          style={{ fontSize: 7 }}
        >
          80%
        </text>

        {/* Bars */}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={Math.max(b.h, 0.5)}
            rx={barW >= 3 ? 1 : 0}
            fill="currentColor"
            className={b.colorClass}
            opacity={i === n - 1 ? 1 : 0.85}
          >
            <title>{`${b.seat} · ${shortTime(b.when)} · ${b.pct}%`}</title>
          </rect>
        ))}

        {/* Latest bar emphasis: thin ring on top */}
        <rect
          x={latest.x - 0.5}
          y={latest.y - 0.5}
          width={latest.w + 1}
          height={Math.max(latest.h, 0.5) + 1}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          className={latest.colorClass}
          opacity="0.5"
          rx={barW >= 3 ? 1 : 0}
        />
      </svg>

      {/* Axis labels: time-based, not count-based */}
      <div className="flex justify-between text-[9px] text-muted-foreground/70 pt-0.5 tabular-nums">
        <span>{shortTime(oldest.when)}</span>
        <span>
          Mới nhất · <b className="text-foreground">{latest.pct}%</b> ({latest.seat})
        </span>
      </div>

      {/* Tier legend (matches bar colors) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground/80 pt-1">
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />Đầy ≥80%</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-sky-500" />Khá 50-80%</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />Thấp 10-50%</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-red-500" />Lãng phí &lt;10%</span>
      </div>
    </div>
  );
}
