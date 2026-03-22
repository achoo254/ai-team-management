# Báo cáo: Quản lý tài khoản AI — Teams Plan 5 Seats

**Ngày:** 20/03/2026 | **Loại:** Project Management | **Trạng thái:** Đề xuất

---

## 1. Hiện trạng

**Plan:** Claude Teams Plan — 5 Premium Seats (Claude Code)
**Tổng nhân sự:** 13 người (7 Dev + 6 MKT)

### Phân bổ tài khoản

| # | Seat (Email) | Đội | Người dùng | Ratio |
|---|-------------|-----|-----------|-------|
| 1 | dattqh@inet.vn | Dev | Đạt + Hổ | 2/seat |
| 2 | hoangnh@inet.vn | Dev | Hoàng + Chương | 2/seat |
| 3 | anhtct@inet.vn | Dev | ViệtNT + Đức + Tuấn Anh | 3/seat |
| 4 | trihd@inet.vn | MKT | Trí + Hậu + Trà | 3/seat |
| 5 | quanlm@inet.vn | MKT | Quân + Ngọc + Phương | 3/seat |

### Rủi ro chính

- **3 seat có 3 người dùng** (anhtct, trihd, quanlm) → cạn token nhanh, xung đột session
- **Claude Code chỉ 1 active session/seat** → 3 người phải chờ nhau
- **Khó audit** cá nhân khi dùng chung 1 email

---

## 2. Đề xuất quản lý

### 2.1 Phân ca sử dụng (bắt buộc cho seat 3 người)

**anhtct@inet.vn (Dev):**

| Slot | 8h–10h30 | 10h30–13h | 14h–16h30 | 16h30–18h |
|------|----------|-----------|-----------|-----------|
| Người | ViệtNT | Đức | Tuấn Anh | Luân phiên |

**trihd@inet.vn (MKT):**

| Slot | 8h–10h30 | 10h30–12h | 13h–15h30 | 15h30–17h |
|------|----------|-----------|-----------|-----------|
| Người | Trí | Hậu | Trà | Luân phiên |

**quanlm@inet.vn (MKT):**

| Slot | 8h–10h30 | 10h30–12h | 13h–15h30 | 15h30–17h |
|------|----------|-----------|-----------|-----------|
| Người | Quân | Ngọc | Phương | Luân phiên |

**dattqh & hoangnh (2 người):** tự thỏa thuận sáng/chiều xen kẽ.

### 2.2 Google Sheet theo dõi token

Cột: `Ngày | Seat | Người dùng | % Trước phiên | % Sau phiên | Delta | Dự án | Mục đích`

- Chụp screenshot % token trước/sau mỗi phiên → ghi sheet
- **Ngưỡng cảnh báo:** >60% trước thứ 4 → báo trưởng nhóm
- Trưởng nhóm review cuối tuần, CTO review cuối tháng

### 2.3 Quy tắc dùng chung seat

1. **Kết thúc session trước khi rời** — giải phóng cho người tiếp theo
2. **Tạo project riêng per dự án** trong Claude Code
3. **Setup CLAUDE.md** cho mỗi project → AI nhớ context, giảm token lặp
4. **Prompt ngắn, rõ ràng** — batch task thay vì nhiều phiên lẻ
5. **Dùng `/compact`** khi context dài
6. **Không commit secret/env** vào repo
7. **Đặt tên conversation rõ ràng:** `[Tên]-[Dự án]-[Task]`

### 2.4 Escalation khi hết limit

```
Hết usage limit
  → Chuyển TK cá nhân (không nhập data nhạy cảm - Điều 4)
  → Hoặc dùng claude.ai free cho task đơn giản
  → Báo trưởng nhóm điều phối TK còn quota
  → CTO quyết định mua thêm seat nếu xảy ra >2 lần/tháng
```

### 2.5 Audit & Lưu trữ (theo Điều 6)

```
Google Drive / NAS:
[Mã dự án]/
  AI-Logs/
    2026-03/
      week-12/
        dattqh-dat-screenshot-mon.png
        dattqh-ho-screenshot-fri.png
        anhtct-vietnt-screenshot-wed.png
        ...
```

### 2.6 Ưu tiên mua thêm seat

| Ưu tiên | Hành động | Lý do |
|---------|-----------|-------|
| P0 | +1 seat MKT | 6 người/2 seat quá tải → 3 seat (2+2+2) |
| P1 | +1 seat Dev (tách anhtct) | 3 người/seat khó hiệu quả → 2+2+2+1 |
| P2 | +1 seat API/Agent | Automated tasks không chiếm quota người |

---

## 3. Action Items

- [ ] Tạo Google Sheet theo dõi token (tuần này)
- [ ] Phát lịch phân ca cho 3 seat 3 người
- [ ] Gửi quy tắc dùng chung cho team
- [ ] Setup CLAUDE.md cho các project chính
- [ ] Tạo cấu trúc thư mục audit trên Drive
- [ ] Review tuần 1 → đánh giá hiệu quả & nhu cầu mua thêm seat

## Câu hỏi chưa giải quyết

- Teams Plan cho phép mua thêm seat lẻ hay phải nâng gói?
- MKT dùng Claude Code hay Claude.ai web? (web cho phép đồng thời tốt hơn)
- Budget Q2 có sẵn cho thêm seat không?
- Có cần tách API key riêng cho CI/CD automated agent?
