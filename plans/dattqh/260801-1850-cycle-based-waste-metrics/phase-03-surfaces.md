# Phase 03 — Telegram, dashboard, export HTML

Phụ thuộc: phase 02.

## Telegram (`telegram-service.ts`)

Dòng TỔNG QUAN viết lại, tách rõ "đã xảy ra" và "đang chạy":

```
── TỔNG QUAN ──────────────
📈 Tận dụng TB 4 chu kỳ: 86% (chu kỳ gần nhất 98%, +10.5 điểm %)
💸 Lãng phí thực tế: $103/$750/tháng
🔮 Chu kỳ đang chạy: dự kiến đạt 99%
💺 Tổng: 6 seats
```

- Chi tiết lãng phí dự phóng **không lặp** ở dòng 🔮 — nó nằm ở mục HIỆU QUẢ SỬ DỤNG bên dưới,
  cùng một nguồn `computeFleetEfficiency`, nên hai chỗ không thể lệch.
- Mục HIỆU QUẢ đổi `$X/chu kỳ` → `$X/tháng` để cả message chỉ còn một đơn vị.
- Thêm dòng `⚠️ N seat thiếu dữ liệu` khi có seat stale/no-data.
- `buildOverviewSection` được **export** để test chạy trên code thật. Test cũ giữ một bản sao
  cục bộ của formatter và bản sao đó đã lệch khỏi code shipped (vẫn ghi `/chu kỳ`) — tức là
  không kiểm được gì. Viết lại toàn bộ file test theo hàm thật.

## Dashboard (`bld-fleet-kpi-cards.tsx`)

- Card "Mức sử dụng đội seat" → `cycleUtilPct`, phụ đề nêu chu kỳ gần nhất + tiến độ chu kỳ đang chạy.
- Card "Lãng phí / tháng" → nullable, hiện `—` khi chưa đủ chu kỳ; hiện số seat thiếu dữ liệu.
- Card "Thay đổi tuần" → "Thay đổi chu kỳ", đơn vị **điểm %**, nullable.
- Card "Thay đổi ngày" cũng đổi sang **điểm %** (vốn là hiệu hai tỷ lệ phần trăm).
- Tách 2 card delta sang `bld-fleet-delta-cards.tsx` để file chính < 200 LOC.

## Export HTML + biểu đồ

- `export-overview-html.ts`: cùng bộ field, thêm card "Chu kỳ đang chạy"; `sign()` → `signPp()`.
- Bảng/biểu đồ xu hướng đổi nhãn từ "tuần / tuần" sang "chu kỳ quota".

## Kết quả xác minh trên DB production (2026-08-01)

| Field | Giá trị |
|---|---|
| `cycleUtilPct` | 86.21% |
| `lastCycleUtilPct` | 98.17% |
| `wasteUsd` | $103.44 |
| `projectedUtilPct` | 99.0% |
| `projectedWasteUsd` | $0 |
| `wwDelta` | +10.5 điểm % |
| `staleSeatCount` / `noDataSeatCount` | 0 / 0 |
| `ddDelta` KPI vs biểu đồ D/D | −60.5 vs −60.5 (khớp, xác nhận fix timezone) |

Khớp chính xác với audit độc lập chạy thẳng trên snapshot thô.
