---
type: brainstorm
date: 2026-04-05
slug: efficiency-card-friendly-metrics
status: ready-for-plan
---

# Redesign card "Hiệu suất sử dụng" — metric thân thiện

## Vấn đề
Card `DashboardEfficiency` (`packages/web/src/components/dashboard-efficiency.tsx`) dùng các metric kỹ thuật từ Claude budget windows (`Δ7d`, `Tác động 5h→7d`, `impact_ratio`) — manager và user thường không hiểu, không hành động được.

### Metric hiện tại (khó hiểu)
| Metric | Nghĩa kỹ thuật | Vấn đề |
|---|---|---|
| `TB sử dụng 37%` | avg `utilization_pct` (% budget 5h dùng mỗi phiên) | Nhãn mơ hồ — "dùng gì?" |
| `Tác động 5h→7d 0.04` | avg `impact_ratio` = Δ7d/Δ5h | Thuật ngữ hoàn toàn không user-facing |
| `Tỷ lệ lãng phí 30%` | `waste_sessions / total_sessions` | OK nhưng % trừu tượng |
| `TB Δ7d Sonnet 1.8%` | avg % quota 7d tiêu thụ / phiên | "Δ7d" là jargon; avg không phản ánh quota còn |
| Phiên đang chạy `Util 8% · Δ7d 0%` | delta_5h & delta_7d | Label không rõ |

## Audience & Goals
- **Audience:** Manager + user thường
- **Top 3 goals:** (1) Team/tôi dùng hiệu quả không, (2) Ai nhiều/ít nhất, (3) Peak hours (đã có card riêng)
- **Style:** Progress bar + số đơn giản, bỏ delta terminology

## Approach đã chọn: B — Practical Reframe

### Layout mới
```
Hiệu suất sử dụng        29/03 - 05/04 · [1 phiên đang mở]
────────────────────────────────────────────────────────
  7/10          38h           10           37%
Phiên hiệu quả  Tổng giờ dùng  Tổng phiên  Mức dùng TB

 Quota 7d (seat TK Đạt sẽ hết sớm nhất)
 ■■■□□□□□□□□□  15%  pace +3%/h
 🔴 Dự báo hết: Thứ 5 07/04 ~14:30 (còn ~28h)

 Quota 5h (phiên hiện tại)
 ■□□□□□□□□□□□  8%   ✅ Còn nhiều

Phiên đang chạy
  TK Đạt     Dùng 8% phiên · tốn 0% quota tuần

Theo người dùng
  Admin      10 phiên · 38h · hiệu quả 37% [TB]
```

### Rules tính metric

| Metric hiển thị | Công thức | Nguồn dữ liệu |
|---|---|---|
| **Phiên hiệu quả X/Y** | X = `total_sessions - waste_sessions`, Y = `total_sessions` | sẵn có |
| **Tổng giờ dùng** | `total_hours` (round) | sẵn có |
| **Tổng phiên** | `total_sessions` | sẵn có |
| **Mức dùng TB** | `round(avg_utilization)%` — giữ như cũ, đổi nhãn | sẵn có |
| **Quota 7d (team)** | `seven_day_pct` của seat có `forecast_at` sớm nhất (xem Forecast Algorithm) | `usage_snapshots` |
| **Quota 5h (phiên hiện tại)** | `five_hour_pct` / `delta_5h` mới nhất | snapshot/active session |
| **Trạng thái quota** | Theo `hours_to_full` (xem thresholds bên dưới) | derived |
| **Dự báo hết quota** | Linear regression `seven_day_pct` per seat, window 24h | `usage_snapshots` 24h gần nhất |
| **Session đang chạy label** | `Dùng {delta_5h}% phiên · tốn {delta_7d}% quota tuần` | chỉ rename |
| **Badge per-user** | `utilization ≥60% → Tốt`, `30-60% → TB`, `<30% → Thấp` | derived |

### Forecast Algorithm (quota 7d)

**Data source:** `usage_snapshots` — thu 5 phút/lần, có `seven_day_pct` per seat.

**Per-seat algorithm:**
```
1. Query usage_snapshots 24h gần nhất, seat_id, seven_day_pct NOT NULL
2. Nếu < 2 điểm → status: "collecting_data"
3. Linear regression simple trên (timestamp_hours, seven_day_pct):
     slope = Σ((x-x̄)(y-ȳ)) / Σ((x-x̄)²)   // %/hour
     current_pct = latest point value
4. Nếu slope ≤ 0 → status: "safe_decreasing" (usage đang rớt)
5. hours_to_full = (100 - current_pct) / slope
6. forecast_at = now + hours_to_full
```

**Status thresholds:**
| hours_to_full | Status | Display |
|---|---|---|
| > 168h (>1 tuần) | ✅ safe | "Đủ dùng ≥1 tuần" |
| 48h–168h | 🟡 watch | "Dự báo hết: {day} {date}" |
| 24h–48h | 🟠 warning | "⚠️ Dự báo hết: {day} ~{HH:MM}" |
| 6h–24h | 🔴 critical | "🔴 Hết trong ~{N}h (~{HH:MM})" |
| <6h | 🚨 imminent | "🚨 Gần hết! ~{N}h nữa" |

**Team aggregation:** chạy per seat → chọn seat có `forecast_at` sớm nhất → hiển thị lên card chính kèm tên seat.

**Lý do chọn linear regression 24h:**
- Đơn giản O(n), không cần lib — tự code 10 dòng
- 24h đủ smooth 5h-window noise, đủ nhạy với burst mới
- Rolling window tự hồi → slope sẽ flatten tự nhiên khi usage ổn định → forecast tự correct
- Giả định conservative: slope ổn định → nếu team slow down thì forecast sẽ "safer" dần (về phía an toàn)

### Rationale các quyết định
1. **Bỏ "Tác động 5h→7d"** — `impact_ratio` = Δ7d/Δ5h chỉ có ý nghĩa engineering. User không hành động được.
2. **Đổi "lãng phí 30%" → "phiên hiệu quả 7/10"** — số đếm dễ cảm nhận hơn %, khung tích cực.
3. **Bỏ Sonnet/Opus split** — dữ liệu Opus gần như 0, phân tách gây nhiễu thị giác. Chỉ show 7d tổng + 5h hiện tại.
4. **Forecast per-seat, show worst** — bottleneck seat quyết định khi nào team kẹt. Hiển thị tên seat giúp manager biết can thiệp seat nào.
5. **24h window linear regression** — đơn giản, nhạy, KISS. Wording "~" để không cam kết chính xác.
6. **Giữ peak hours heatmap** — card riêng đã trả lời "khi nào peak".

## Backend impact
Endpoint `GET /api/dashboard/efficiency` (`packages/api/src/routes/dashboard.ts:305-330`).

**Cần thêm trong response:**
```ts
quota_forecast: {
  seven_day: {
    worst_seat: { seat_id, seat_name, current_pct, slope_per_hour }
    hours_to_full: number | null    // null if safe/decreasing/collecting
    forecast_at: string | null      // ISO date
    status: "safe" | "watch" | "warning" | "critical" | "imminent" | "safe_decreasing" | "collecting"
  },
  five_hour: {
    current_pct: number  // max across active sessions
    status: "safe" | "warning" | "critical"
  }
}
```

**Logic tính (server-side):**
1. Lấy danh sách seats trong range
2. Per seat: query `usage_snapshots` last 24h, seven_day_pct NOT NULL, sort by time
3. Linear regression → slope + current_pct
4. Compute hours_to_full, forecast_at, status
5. Pick seat với forecast_at sớm nhất (hoặc status nghiêm trọng nhất)

**Có thể bỏ:** `avg_impact_ratio`, `avg_delta_7d_sonnet/opus` — grep toàn repo trước khi xoá (alerts/notifications có thể dùng).

## Frontend impact
File thay đổi: `packages/web/src/components/dashboard-efficiency.tsx`
- Thay 4-box + 2-box grid bằng: 4-box + 2 progress bar
- Thêm component `QuotaBar` (progress + color + status label)
- Rename labels session đang chạy & per-user
- Add helper `getUserBadge(util)` returning `{label, variant}`

Shared types: update `packages/shared/types.ts` `EfficiencySummary` interface.

## Risks & trade-offs
| Risk | Mitigation |
|---|---|
| Forecast sai khi pace burst (weekend, lễ) | Wording "~{N}h nữa"; không cam kết phút chính xác |
| Rolling window 7d tự hồi → linear overestimate | Conservative có lợi (cảnh báo sớm); re-run mỗi request luôn fresh |
| Seat có snapshot thiếu (mới thêm, inactive) | Status "collecting" + skip khỏi worst-seat selection |
| Linear regression nhiễu khi <5 điểm | Fallback 2-point slope nếu < 5 điểm |
| Hiển thị 1 seat có thể che seat khác nguy hiểm | Tooltip show top 3 seats nếu có nhiều seats ở status critical |
| API shape thay đổi break caller khác | Grep `avg_impact_ratio`/`avg_delta_7d` trước khi xoá |

## Success criteria
- User không cần hỏi nghĩa bất kỳ nhãn nào trong card (usability test 3 người)
- Manager nhìn card trong <10s biết team có OK không
- Card < 200 LOC
- Không metric mới nào bị negative (negative delta_7d không thể xảy ra nhưng max cần clamp)

## Next steps
1. Grep `avg_impact_ratio`, `avg_delta_7d_sonnet`, `avg_delta_7d_opus` toàn repo
2. Confirm `usage_snapshots` có đủ density 5-min (no gaps) cho linear regression
3. Tạo plan `/ck:plan` với phases:
   - Phase 1: forecast service — linear regression helper + per-seat computation
   - Phase 2: backend — extend `/api/dashboard/efficiency` với `quota_forecast`, drop legacy fields
   - Phase 3: shared types update
   - Phase 4: frontend redesign card + new `QuotaForecastBar` component
   - Phase 5: unit tests forecast algorithm (edge cases: <2 points, slope=0, slope<0, >100%)

## Unresolved questions
- Badge per-user: threshold 60%/30% có phù hợp không, hay để configurable?
- Tooltip có show top 3 seats nguy hiểm không, hay chỉ 1 seat worst?
- Khi nào bắt đầu báo push notification nếu status = critical? (có thể tích hợp vào alert-service sau)
- Linear regression fallback: <5 điểm → 2-point slope, OR skip forecast?
