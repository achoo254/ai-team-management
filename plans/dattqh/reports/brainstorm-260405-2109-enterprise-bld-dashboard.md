---
type: brainstorm
date: 2026-04-05
slug: enterprise-bld-dashboard
status: design-approved
---

# Enterprise BLD Dashboard — Brainstorm Summary

## Problem
Dashboard hiện tại phục vụ tốt team ops nhưng **chưa sẵn sàng** trình BLD. Thiếu executive KPIs, không có narrative, không quy ra tiền. Trình BLD bây giờ = phản hồi "số nhiều quá, đâu là câu trả lời".

## Goal
Build executive-layer dashboard + weekly PDF digest để BLD:
1. Xem fleet health qua 1-2 KPIs
2. Quyết định rebalance seats / tăng-giảm license
3. Thấy waste $ cụ thể → ROI argument

## Constraints
- Cost: $125/seat/month (company pays monthly), **loại seats có email personal-domain** (gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com...)
- Delivery digest: PDF export link + alert settings mở rộng
- Phase P1 (data quality) làm trước

## Current Dashboard — điểm mạnh tận dụng
- Snapshot 5-min granular, 6 tháng history, per-seat 5h/7d quota
- Peak Hours Heatmap (7×24)
- Per-user consumption, waste_sessions count
- Tier distribution, stddev volatility
- Forecast service đã build (chưa surface UI)

## Current Dashboard — gaps critical cho BLD
| Gap | Impact |
|-----|--------|
| No Fleet Utilization % | BLD không có "sức khỏe chung" 1 số |
| No Cost/ROI | Không thuyết phục tăng/giảm seat |
| No W/W delta | Không thấy hướng cải thiện |
| No under-utilized list | Không biết action gì |
| No waste $ quantification | Có count nhưng không quy tiền |
| No rebalance suggestions | BLD phải tự suy luận |

## Data quality red flags (fix P1)
- Stale data không alert (>6h old)
- Token failure silent (chỉ badge count)
- Forecast built but not surfaced in UI
- Sparkline N=20 không time-bounded

## Solution — 3 phases

### P1 — Data Quality Fixes (~1 ngày, prerequisite)
- Stale data banner (last_fetched_at > 6h → red top banner)
- Token failure per-seat panel (list + retry button)
- Surface forecast: card "Seats sắp cạn" top 3 urgent
- Sparkline time-window 7d thay N=20

### P2 — BLD View (~2-3 ngày)
Route: `/bld` (admin-only)

**API new:** `packages/api/src/routes/bld-metrics.ts`
- `GET /api/bld/fleet-kpis` → util%, waste_usd, waste_hours, total_cost, billable_seats
- `GET /api/bld/user-efficiency` → per-user ranking (company seats only)
- `GET /api/bld/rebalance-suggestions` → swap suggestions

**UI components new:**
- `bld-fleet-kpi-cards.tsx` — 4 big cards: Util%, Waste$, W/W Δ, Forecast ETA
- `bld-user-efficiency-panel.tsx` — leaderboard billable users
- `bld-actions-panel.tsx` — rebalance suggestions
- `bld-ww-comparison.tsx` — week-over-week delta

**Cost logic:**
```ts
const PERSONAL = ['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com']
const isCompany = (seat) => {
  const domain = seat.email?.toLowerCase().split('@')[1]
  return !!domain && !PERSONAL.includes(domain)
}
company_seats = seats.filter(isCompany)
total_cost_usd = company_seats.length * 125
waste_usd = total_cost_usd * (1 - fleet_util_pct / 100)
```

### P3 — PDF Digest + Alert Settings (~1-2 ngày)
**Service new:** `packages/api/src/services/bld-pdf-service.ts`
- Lib candidate: `pdfkit` hoặc `@react-pdf/renderer`
- Content: fleet KPIs, top waste seats, W/W trend, recommendations
- Generated on-demand + weekly cron

**Alert settings mở rộng:**
- Per-admin setting: "Weekly BLD PDF to Telegram every Friday 17:00"
- Threshold alerts: "Alert if fleet util < 60% for 3 days"

**Delivery:**
- Extend existing Friday 17:00 cron
- PDF saved to disk, link via Telegram system bot
- Link token auth, expire 7d

## Verification case (6 seats hiện tại)
Giả sử 5 company seats + 1 personal (gmail.com):
- Billable: 5 × $125 = $625/month
- Fleet util 61% → Cơ hội tối ưu = $625 × 39% = **$243.75/month**
- **Gói Teams min 5 seats — KHÔNG cắt được seat**
- BLD action: "Rebalance member từ seat quá tải sang seat under-util → nâng util lên 80%+"
- Add seat chỉ khi ≥2 seats critical/warning ≥3 ngày liên tiếp

## Success criteria
- BLD xem trang `/bld` hiểu ngay tình hình trong <30s
- Waste $ match với thực tế ±10%
- Weekly PDF gửi đúng 17:00 T6
- P1 fixes không regress existing dashboard

## Risks
- PDF library size (pdfkit ~800KB, @react-pdf ~2MB) — chấp nhận
- Forecast surface có thể tạo false positive alert đầu chu kỳ
- Email-filter phụ thuộc data seat.email chính xác; custom personal domains cần bổ sung qua env

## Unresolved questions
- Cron schedule PDF: cùng giờ Friday 17:00 weekly summary hay khác?
- BLD view access: chỉ admin hay thêm role mới?
- PDF retention: giữ bao lâu trước khi dọn?
