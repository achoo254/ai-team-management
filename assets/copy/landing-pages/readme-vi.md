# Claude Teams Management Dashboard

**Hệ thống quản lý tài khoản Claude Teams nội bộ của inet.vn**

Chúng ta đang dùng chung 5 tài khoản Claude Teams cho 13 người (7 Dev + 6 MKT). Dashboard này giúp cả team biết ai đang dùng gì, khi nào, và bao nhiêu — tất cả trong một nơi duy nhất, không cần hỏi qua Telegram hay đoán mò.

---

## Tại sao cần công cụ này?

5 tài khoản, 13 người, không có hệ thống theo dõi = xung đột lịch dùng, không ai biết ai đang dùng bao nhiêu, tài khoản bị "ngốn" mà không rõ nguyên nhân.

Dashboard này giải quyết đúng 3 vấn đề đó:
- Biết rõ ai được dùng slot nào, ngày nào
- Theo dõi mức sử dụng hàng tuần của từng người
- Tự động cảnh báo khi có bất thường

---

## Tính năng chính

### Quản lý chỗ ngồi (Seat)

Mỗi "seat" là một tài khoản Claude Teams. Admin có thể xem toàn bộ danh sách các seat, biết seat nào đang có bao nhiêu người dùng, seat nào thuộc nhóm Dev, nhóm nào thuộc MKT. Không còn tình trạng một seat bị nhồi quá nhiều người mà không ai hay biết.

### Đăng ký lịch dùng theo buổi

Mỗi thành viên được xếp lịch dùng Claude theo khung giờ cụ thể:
- **Buổi sáng:** 8:00 - 12:00
- **Buổi chiều:** 13:00 - 17:00

Hệ thống tự động ngăn hai người đăng ký trùng slot trên cùng một seat. Bạn có thể xem lịch của mình và của cả team trong tuần, không lo đụng hàng.

### Ghi nhận mức sử dụng hàng tuần

Mỗi tuần một lần, mỗi thành viên tự ghi lại mức độ sử dụng Claude của mình theo phần trăm (0% - 100%). Dữ liệu này giúp team lead thấy được:
- Ai đang dùng nhiều, ai chưa dùng
- Tuần này team dùng nhiều hay ít hơn tuần trước
- Phân bổ tài nguyên có hợp lý không

### Cảnh báo tự động

Hệ thống tự động phát hiện và tạo cảnh báo khi:
- Một seat bị dùng quá **80%** công suất (nguy cơ hết quota)
- Một thành viên **không ghi nhận usage quá 1 tuần** (có thể đang không dùng hoặc quên báo)

Admin xem, xử lý, và đánh dấu đã giải quyết ngay trên dashboard.

### Thông báo Telegram tự động

Mỗi thứ Sáu, bot Telegram sẽ nhắn vào nhóm:
- **15:00** — Nhắc mọi người ghi lại mức dùng trong tuần trước khi hết giờ
- **17:00** — Gửi báo cáo tổng kết tuần: ai dùng bao nhiêu, cảnh báo nào đang mở, ai chưa báo cáo

Bạn không cần mở dashboard mới biết tình trạng team, Telegram sẽ chủ động thông báo.

---

## Ai dùng được gì?

| Vai trò | Quyền hạn |
|---|---|
| **Thành viên** | Xem lịch, ghi usage, xem cảnh báo của mình |
| **Admin** | Toàn bộ tính năng: quản lý seat, quản lý user, xem tất cả usage, xử lý cảnh báo |

---

## Cách dùng (từng bước)

### Bước 1 — Đăng nhập

Truy cập link dashboard, nhấn **"Đăng nhập bằng Google"**, chọn tài khoản email công ty `@inet.vn`. Không cần mật khẩu riêng.

### Bước 2 — Xem lịch của mình

Vào mục **Lịch dùng**, bạn sẽ thấy bản thân được xếp vào slot nào trong tuần. Nếu chưa có lịch, liên hệ admin để được phân công.

### Bước 3 — Ghi usage hàng tuần

Vào mục **Ghi nhận sử dụng**, chọn tuần cần ghi, nhập phần trăm đã dùng. Làm vào mỗi thứ Sáu (hoặc khi bot Telegram nhắc).

### Bước 4 — Xem cảnh báo

Nếu có cảnh báo liên quan đến bạn hoặc seat của bạn, chúng sẽ hiện trong mục **Cảnh báo**. Admin sẽ xử lý và cập nhật trạng thái.

---

## Câu hỏi thường gặp

**Tôi quên ghi usage tuần rồi, giờ có ghi được không?**
Có. Bạn vẫn có thể chọn lại tuần cũ và ghi bổ sung. Hệ thống cho phép ghi usage cho bất kỳ tuần nào trong quá khứ.

**Tôi thấy tên mình trong cảnh báo "không hoạt động" — phải làm gì?**
Chỉ cần vào mục Ghi nhận sử dụng và ghi usage cho tuần đó. Cảnh báo sẽ được admin xem xét và đóng lại.

**Lịch của tôi bị trùng với người khác, phải báo ai?**
Hệ thống không cho phép trùng slot nên trường hợp này không xảy ra tự động. Nếu bạn thấy bất thường, báo admin để kiểm tra.

**Tôi không thấy mình trong lịch tuần này?**
Liên hệ admin để được phân công seat và khung giờ phù hợp.

**Thông báo Telegram gửi vào nhóm nào?**
Nhóm Telegram nội bộ đã được cấu hình sẵn. Nếu bạn không thấy bot nhắn tin, hỏi admin kiểm tra lại.

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề khi đăng nhập hoặc sử dụng dashboard, liên hệ trực tiếp nhóm Dev qua Telegram nội bộ.
