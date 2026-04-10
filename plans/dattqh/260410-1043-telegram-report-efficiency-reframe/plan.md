---
name: Telegram Report Efficiency Reframe
status: done
created: 2026-04-10
branch: main
blockedBy: []
blocks: []
---

# Telegram Report Efficiency Reframe

Reframe Telegram báo cáo gửi BGĐ từ "cảnh báo rủi ro" → "đo hiệu quả sử dụng quota". Mục tiêu: giúp BGĐ thấy rõ seat nào tối ưu, seat nào quá tải, seat nào lãng phí quota chưa tận dụng hết trước mốc reset 7 ngày.

## Context

- **Brainstorm report:** `plans/dattqh/reports/brainstorm-260410-1043-telegram-report-efficiency-reframe.md`
- **Vấn đề:** Wording hiện tại trong `telegram-service.ts` (L68, L132) dùng tone imperative + exclamation, framing sai (coi chạm 100% là rủi ro trong khi thực tế chạm 100% đúng lúc reset = tối ưu), và **miss hoàn toàn case lãng phí** — thứ BGĐ cần thấy nhất
- **Mục tiêu:** 3-bucket classification (Tối ưu / Quá tải / Lãng phí) + wording trung tính + waste cost quy đổi $

## Decisions (chốt từ brainstorm + red-team tune)

| # | Decision |
|---|---|
| Classification axis | **Unified projected_pct tại reset** (không dùng ratio 2-axis) |
| Ngưỡng | `projected >= 100` → overload, `85–99` → optimal, `<85` → waste |
| Cost | Flat `SEAT_MONTHLY_COST_USD = 125` (1 const, không map subscription) |
| 7d window | Fixed cycle (dùng `seven_day_resets_at`) — đã confirmed |
| Seat thiếu data | Bucket `unknown`: status `collecting` hoặc `hoursSinceReset < 24` |
| Waste calc | `waste_pct = max(0, 85 - projected_pct)` — tính từ ngưỡng 85%, không phải 100% |
| Wording "Quá tải" | Giữ nguyên |
| Alert L376 | Giữ nguyên (gửi operator, không phải BGĐ) |

## Architecture

```
┌─────────────────────────────────┐
│ quota-forecast-service.ts       │
│  - classifyEfficiency()  [MỚI]  │  ← compute bucket từ forecast + resets_at
│  - computeFleetEfficiency() [MỚI]│  ← aggregate + waste_usd
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ bld-metrics-service.ts          │
│  - FleetKpis.efficiency [MỚI]   │  ← extend type, wire vào
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ telegram-service.ts             │
│  - buildOverviewSection() REWRITE│  ← 3-bucket section
│  - buildReportHtml() — bỏ L132  │
└─────────────────────────────────┘
```

## Phases

| # | Phase | Status | Effort |
|---|---|---|---|
| 01 | [Extend forecast service với efficiency bucketing](./phase-01-forecast-efficiency-bucketing.md) | done | M |
| 02 | [Wire fleet metrics + rewrite telegram overview](./phase-02-fleet-metrics-telegram-wiring.md) | done | M |
| 03 | [Tests + verification](./phase-03-tests-and-verification.md) | done | S |

## Key Dependencies

- Phase 02 phụ thuộc Phase 01 (cần function `computeFleetEfficiency` trước)
- Phase 03 phụ thuộc Phase 01 + 02

## Success Criteria

- [x] Telegram báo cáo overview hiển thị 3 bucket rõ ràng (Tối ưu / Quá tải / Lãng phí)
- [x] Waste cost quy đổi $ cho bucket "Lãng phí"
- [x] Zero imperative tense + zero exclamation mark trong overview section
- [x] Unit tests cho `classifyEfficiency()` cover 4 case: optimal, overload, waste, unknown
- [x] Alert cá nhân L376 không đổi
- [x] Existing tests vẫn pass (160/160)

## Risks

- **Ngưỡng 85% là guess** — monitor 1-2 chu kỳ rồi tune
- **Cost $125 hardcode** — nếu pricing đổi, sửa 1 const. Chấp nhận tradeoff vì KISS
- **Guard 24h** — seat mới tạo trong 24h đầu sẽ show `unknown`, UX acceptable
