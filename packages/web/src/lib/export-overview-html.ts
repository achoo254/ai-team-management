/**
 * Generates a self-contained HTML report from Overview tab data.
 * No external dependencies — inline CSS, runs offline.
 */

import type {
  FleetKpis,
  WwHistoryPoint,
  DdHistoryPoint,
  SeatStatsResponse,
  RebalanceSuggestion,
} from "@repo/shared/types";

interface ExportData {
  kpis: FleetKpis;
  wwHistory: WwHistoryPoint[];
  ddHistory: DdHistoryPoint[];
  seatStats: SeatStatsResponse | null;
  suggestions: RebalanceSuggestion[];
}

function fmtPct(v: number): string { return `${v.toFixed(1)}%`; }
function fmtUsd(v: number): string { return `$${v.toFixed(0)}`; }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function sign(v: number): string { return v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`; }

function kpiColor(label: string, value: number): string {
  if (label === "utilPct") return value >= 70 ? "#22c55e" : value >= 50 ? "#eab308" : "#ef4444";
  if (label === "wwDelta" || label === "ddDelta") return value >= 0 ? "#22c55e" : "#ef4444";
  return "#94a3b8";
}

function suggestionText(s: RebalanceSuggestion): string {
  if (s.type === "move_member") return `Di chuyển thành viên từ ${s.fromSeatLabel} → ${s.toSeatLabel}: ${s.reason}`;
  if (s.type === "add_seat") return `Thêm seat mới ($${s.estimatedMonthlyCost}/tháng): ${s.reason}`;
  return `Cân bằng lại: ${s.reason}`;
}

export function generateOverviewHtml(data: ExportData): string {
  const { kpis, wwHistory, ddHistory, seatStats, suggestions } = data;
  const now = new Date().toLocaleString("vi-VN", { dateStyle: "full", timeStyle: "short" });

  // Build WW history table rows
  const wwRows = wwHistory.map(p =>
    `<tr><td>${fmtDate(p.week_start)}</td><td>${fmtPct(p.utilPct)}</td><td>${fmtUsd(p.wasteUsd)}</td></tr>`
  ).join("");

  // Build DD history table rows (last 14 days)
  const ddRows = ddHistory.slice(-14).map(p =>
    `<tr><td>${fmtDate(p.date)}</td><td>${fmtPct(p.avgPeak5h)}</td></tr>`
  ).join("");

  // Build seat waste rows
  const wasteRows = seatStats?.topWaste.map(s =>
    `<tr><td>${s.seatLabel}</td><td>${fmtPct(s.utilPct)}</td><td>${fmtUsd(s.wasteUsd)}</td><td>${fmtPct(s.wastePct)}</td></tr>`
  ).join("") ?? "";

  // Build burndown risk rows
  const burndownRows = seatStats?.burndownRisk.map(s =>
    `<tr><td>${s.seatLabel}</td><td>${s.consecutiveDays} ngày</td><td>${fmtPct(s.latestUtilPct)}</td></tr>`
  ).join("") ?? "";

  // Build degradation rows
  const degradationRows = seatStats?.degradationWatch.map(s =>
    `<tr><td>${s.seatLabel}</td><td>${fmtPct(s.currentUtilPct)}</td><td>${fmtPct(s.lastWeekUtilPct)}</td><td style="color:#ef4444">-${s.dropPp.toFixed(1)}pp</td></tr>`
  ).join("") ?? "";

  // Build suggestion items
  const suggestionItems = suggestions.map(s =>
    `<li>${suggestionText(s)}</li>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo tổng quan — Claude Teams</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--bg:#f8fafc;--fg:#1e293b;--muted:#64748b;--subtle:#94a3b8;--card:#fff;--border:#e2e8f0;--th-bg:#f1f5f9;--hover:#f1f5f950}
  @media(prefers-color-scheme:dark){:root{--bg:#0f172a;--fg:#e2e8f0;--muted:#64748b;--subtle:#94a3b8;--card:#1e293b;--border:#334155;--th-bg:#1e293b;--hover:#1e293b50}}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg);padding:2rem;max-width:1100px;margin:0 auto;line-height:1.5}
  h1{font-size:1.5rem;font-weight:700;margin-bottom:.25rem}
  h2{font-size:1.1rem;font-weight:600;margin:2rem 0 .75rem;color:var(--subtle);text-transform:uppercase;letter-spacing:.05em;font-size:.75rem}
  .meta{color:var(--muted);font-size:.8rem;margin-bottom:2rem}
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem}
  .kpi{background:var(--card);border:1px solid var(--border);border-radius:.75rem;padding:1.25rem}
  .kpi-label{font-size:.75rem;color:var(--subtle);margin-bottom:.25rem}
  .kpi-value{font-size:1.75rem;font-weight:700}
  .kpi-sub{font-size:.7rem;color:var(--muted);margin-top:.25rem}
  table{width:100%;border-collapse:collapse;margin-bottom:1.5rem;font-size:.85rem}
  th{text-align:left;padding:.5rem .75rem;background:var(--th-bg);border-bottom:2px solid var(--border);color:var(--subtle);font-weight:600;font-size:.75rem;text-transform:uppercase}
  td{padding:.5rem .75rem;border-bottom:1px solid var(--border)}
  tr:hover td{background:var(--hover)}
  .section{background:var(--card);border:1px solid var(--border);border-radius:.75rem;padding:1.25rem;margin-bottom:1.5rem}
  .section h3{font-size:.9rem;font-weight:600;margin-bottom:.75rem}
  ul{padding-left:1.25rem}
  li{margin-bottom:.5rem;font-size:.85rem}
  .empty{color:var(--muted);font-style:italic;font-size:.85rem}
  @media print{:root{--bg:#fff;--fg:#1e293b;--card:#f8fafc;--border:#e2e8f0;--th-bg:#f1f5f9;--subtle:#475569}}
  @media(max-width:640px){.kpi-grid{grid-template-columns:1fr 1fr}.kpi-value{font-size:1.25rem}}
</style>
</head>
<body>
<h1>Báo cáo tổng quan — Claude Teams</h1>
<p class="meta">Xuất lúc ${now} · ${kpis.billableCount} seat active</p>

<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Mức sử dụng đội seat</div>
    <div class="kpi-value" style="color:${kpiColor("utilPct", kpis.utilPct)}">${fmtPct(kpis.utilPct)}</div>
    <div class="kpi-sub">${kpis.billableCount} seat active · ${kpis.utilPct >= 70 ? "khoẻ" : kpis.utilPct >= 50 ? "TB" : "kém"}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Lãng phí / tháng</div>
    <div class="kpi-value">${fmtUsd(kpis.wasteUsd)}</div>
    <div class="kpi-sub">trên ${fmtUsd(kpis.totalCostUsd)} tổng chi phí</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Thay đổi tuần</div>
    <div class="kpi-value" style="color:${kpiColor("wwDelta", kpis.wwDelta)}">${sign(kpis.wwDelta)}</div>
    <div class="kpi-sub">${kpis.wwDelta >= 0 ? "Dùng nhiều hơn tuần trước" : "Dùng ít hơn tuần trước"}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Thay đổi ngày</div>
    <div class="kpi-value" style="color:${kpiColor("ddDelta", kpis.ddDelta ?? 0)}">${kpis.ddDelta != null ? sign(kpis.ddDelta) : "N/A"}</div>
    <div class="kpi-sub">${kpis.ddDelta != null ? (kpis.ddDelta >= 0 ? "Hôm nay dùng nhiều hơn" : "Hôm nay dùng ít hơn") : "Chưa đủ dữ liệu"}</div>
  </div>
  ${kpis.worstForecast ? `<div class="kpi">
    <div class="kpi-label">Nguy cơ hết quota</div>
    <div class="kpi-value" style="color:#ef4444">${kpis.worstForecast.hours_to_full != null ? (kpis.worstForecast.hours_to_full / 24).toFixed(1) : "?"} ngày</div>
    <div class="kpi-sub">${kpis.worstForecast.seat_label}</div>
  </div>` : ""}
</div>

<h2>Xu hướng tuần / tuần</h2>
<table>
  <thead><tr><th>Tuần bắt đầu</th><th>Sử dụng</th><th>Lãng phí</th></tr></thead>
  <tbody>${wwRows || '<tr><td colspan="3" class="empty">Chưa có dữ liệu</td></tr>'}</tbody>
</table>

<h2>Xu hướng ngày / ngày (14 ngày gần nhất)</h2>
<table>
  <thead><tr><th>Ngày</th><th>Peak 5h TB</th></tr></thead>
  <tbody>${ddRows || '<tr><td colspan="2" class="empty">Chưa có dữ liệu</td></tr>'}</tbody>
</table>

${wasteRows ? `<h2>Seat lãng phí nhiều nhất</h2>
<table>
  <thead><tr><th>Seat</th><th>Sử dụng</th><th>Lãng phí</th><th>Tỷ lệ lãng phí</th></tr></thead>
  <tbody>${wasteRows}</tbody>
</table>` : ""}

${burndownRows ? `<h2>Rủi ro burndown (dùng liên tục nhiều ngày)</h2>
<table>
  <thead><tr><th>Seat</th><th>Liên tục</th><th>Sử dụng gần nhất</th></tr></thead>
  <tbody>${burndownRows}</tbody>
</table>` : ""}

${degradationRows ? `<h2>Seat suy giảm hiệu suất</h2>
<table>
  <thead><tr><th>Seat</th><th>Tuần này</th><th>Tuần trước</th><th>Giảm</th></tr></thead>
  <tbody>${degradationRows}</tbody>
</table>` : ""}

${suggestionItems ? `<div class="section">
  <h3>Đề xuất hành động</h3>
  <ul>${suggestionItems}</ul>
</div>` : ""}

<p class="meta" style="margin-top:2rem;text-align:center">— Generated by Claude Teams Dashboard —</p>
</body>
</html>`;
}
