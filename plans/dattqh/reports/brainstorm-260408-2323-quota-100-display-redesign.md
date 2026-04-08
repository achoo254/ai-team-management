# Brainstorm: Hiển thị khi seat đạt 100% quota

**Date**: 2026-04-08  
**Status**: Agreed  

## Vấn đề

Khi seat đạt 100% quota, UI hiện tại vẫn hiển thị như trạng thái "sắp cạn":
- Label "Sắp cạn · <1h" → sai ngữ nghĩa (đã cạn, không phải sắp)
- ETA "~0h" vô nghĩa
- Bar đỏ pulse → gây confusion với seat 95% cũng đỏ
- Chart "Mật độ sử dụng Seat" trùng 7d data với chart phía trên

## Thiết kế đã thống nhất

### 1. Card "Seats sắp cạn quota" — seat = 100%

| Thuộc tính | Hiện tại (100%) | Mới (100%) |
|------------|----------------|------------|
| Bar | Đỏ đặc + pulse | Mờ nhạt (opacity ~50%), ngừng pulse |
| Label | "Sắp cạn · <1h" | Badge đỏ **[Đã cạn]** |
| Info | ETA countdown "~0h" | **"Reset ~Xd"** |

Seat < 100%: giữ nguyên behavior hiện tại.

**Preview:**
```
TK Đạt   100% ░░░░░░░░░░░░░░░░░░  [Đã cạn] Reset ~5d
TK Trí    79% ████████████░░░░░░  Sắp cạn · ~35h
```

### 2. Chart "Mật độ sử dụng Seat" → đổi metric

**Bỏ:**
- Lấp đầy % (occupancy) — member/seats ít ý nghĩa
- Dùng 7d % — trùng chart "Mức dùng theo Seat — 5h vs 7d" phía trên

**Thay bằng:**
- **Burn rate 5h** (%/h) — tốc độ tiêu thụ ngắn hạn
- **Active sessions** — số phiên đang hoạt động

**Preview:**
```
TK Đạt  ██████████  12%/h   3 sessions
TK Trí  █████░░░░░   5%/h   1 session
TK Hoàng ██░░░░░░░░   2%/h   0 sessions
```

### 3. Quota bar ở các vị trí khác

Áp dụng cùng logic cho tất cả nơi hiển thị quota bar:
- seat 100% → bar mờ + badge "Đã cạn" + reset countdown
- Bao gồm: forecast card, quota 7d card, bất kỳ component nào hiển thị quota progress

## Files cần sửa

| File | Thay đổi |
|------|----------|
| `packages/web/src/components/forecast-urgent-card.tsx` | Thêm logic 100%: bar mờ, badge "Đã cạn", reset countdown |
| `packages/web/src/components/quota-forecast-bar.tsx` | Thêm prop/state cho "depleted" mode (opacity, no pulse) |
| `packages/web/src/components/dashboard-seat-efficiency.tsx` | Đổi metrics: burn rate 5h + active sessions thay occupancy + 7d |
| `packages/api/src/routes/dashboard.ts` | API trả thêm burn_rate_5h, active_session_count, quota_reset_date |

## Lưu ý triển khai

- **Reset countdown**: cần biết quota cycle (weekly? monthly?) → derive từ data hiện có hoặc config
- **Burn rate**: tính từ delta usage_snapshots trong 5h gần nhất
- **Active sessions**: query từ collection `active_sessions`
- Giữ nguyên màu sắc cho các trạng thái < 100% (orange warning, red critical)
