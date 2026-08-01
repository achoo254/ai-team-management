# ADR-0001: Đo tận dụng & lãng phí theo chu kỳ quota đã hoàn tất

- **Ngày:** 2026-08-01
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

`seven_day_pct` do Anthropic API trả về là **bộ đếm tích lũy trong chu kỳ 7 ngày**: chạy từ 0%
lên 100% rồi reset về 0. Nó không phải tỷ lệ tận dụng trung bình.

KPI fleet trước đây lấy trung bình `seven_day_pct` của snapshot mới nhất mỗi seat rồi tính
`wasteUsd = totalCostUsd × (1 − utilPct/100)`. Vì mẫu được lấy tại một điểm bất kỳ giữa chu kỳ,
công thức này thực chất đo *"còn bao lâu nữa tới mốc reset"*.

Kiểm chứng trên DB production ngày 2026-08-01 (6 seats, $125/seat/tháng):

- Dựng lại chỉ số theo từng 6 giờ suốt 14 ngày: dao động **$24 … $584/tháng** (chênh $560)
  hoàn toàn do thời điểm gửi report rơi vào đâu trong chu kỳ, trong khi hành vi dùng không đổi.
- Cùng một message Telegram tự mâu thuẫn: dòng TỔNG QUAN báo lãng phí $346/$750 (45% chi phí),
  trong khi dòng HIỆU QUẢ ngay dưới báo **5/6 seat quá tải, 0 seat lãng phí**.
- Đối chiếu đỉnh quota các chu kỳ đã hoàn tất: tận dụng thật là 98.2% (chu kỳ gần nhất) và
  86.2% (TB 4 chu kỳ) → lãng phí thật $14–$103/tháng. Con số cũ phóng đại 3.4×–25×.

Hai chỉ số này xuất hiện trên báo cáo Telegram, dashboard web và bản export HTML/PDF — tức là
đang dùng để ra quyết định mua thêm seat / rebalance member.

## Quyết định

Tách hẳn thành hai con số, mỗi con số một mô hình, không bao giờ trộn:

1. **Lãng phí thực tế** (`wasteUsd`) — tính từ **đỉnh `seven_day_pct` của các chu kỳ ĐÃ hoàn
   tất** (mặc định TB 4 chu kỳ gần nhất), cộng dồn theo từng seat có dữ liệu.
2. **Dự phóng chu kỳ đang chạy** (`projectedUtilPct`, `projectedWasteUsd`) — lấy **thẳng** từ
   `computeFleetEfficiency`, chính là nguồn của mục HIỆU QUẢ SỬ DỤNG.

`utilPct` được giữ lại nhưng đổi nghĩa rõ ràng: quota đã tiêu thụ tới hiện tại của chu kỳ đang
chạy. Nó không còn tham gia định giá lãng phí.

## Lý do (tại sao) — phần quan trọng nhất

- **Trong một chu kỳ, `seven_day_pct` chỉ tăng.** Nên `max` của nó trong chu kỳ chính là tổng
  quota đã tiêu thụ — đây là đại lượng duy nhất trả lời được câu hỏi "đã trả tiền cho bao nhiêu,
  dùng hết bao nhiêu". Mọi phép đo giữa chu kỳ đều lẫn thông tin về pha, không tách ra được.
- **Hai con số lãng phí phải cùng một mô hình, nếu không sẽ chọi nhau.** Lấy dự phóng thẳng từ
  `computeFleetEfficiency` khiến việc "0 seat lãng phí" mà vẫn báo "$346 lãng phí" trở thành bất
  khả thi về mặt cấu trúc, chứ không chỉ là sửa số.
- **Chu kỳ là đơn vị so sánh đúng cho W/W.** So hai mẫu cách nhau 7 ngày chỉ đúng khi cadence
  reset chuẩn xác 7.00 ngày và không có gap thu thập — cả hai đều không đảm bảo (đo được TK Quân
  mất snapshot trọn 2 ngày 26–27/07, khiến baseline lệch pha ~4.7 điểm %). So chu kỳ-với-chu-kỳ
  loại bỏ hẳn nhiễu pha.
- **Cộng dồn lãng phí theo từng seat** thay vì nhân `totalCostUsd` của cả fleet: seat chưa có dữ
  liệu đóng góp $0 thay vì bị ngầm coi là lãng phí 100%.

## Đánh đổi & hệ quả

**Được:**

- Con số ổn định, không dao động theo giờ gửi report.
- Không còn khả năng hai dòng trong cùng message nói ngược nhau.
- Seat đứt collector không âm thầm kéo trung bình (đếm riêng qua `staleSeatCount`).

**Mất / nợ kỹ thuật chấp nhận:**

- **Trễ tới 1 chu kỳ**: hệ thống mới phải chạy hết ít nhất một chu kỳ mới có số. Bù lại bằng
  dòng dự phóng cho chu kỳ đang chạy.
- `wasteUsd`, `wwDelta`, `cycleUtilPct` đổi sang **nullable** → mọi surface phải xử lý trạng
  thái "chưa đủ dữ liệu".
- Một chu kỳ bị thiếu snapshot nặng (< 288 mẫu ≈ 1 ngày) bị **loại khỏi** trung bình. Chấp nhận
  hụt mẫu còn hơn lấy một đỉnh giả từ vài snapshot rời rạc.
- `seven_day_resets_at` jitter theo ms giữa các lần gọi API → phải làm tròn về **giờ gần nhất**
  khi nhóm chu kỳ. Làm tròn chứ không cắt xuống, vì mốc thật rơi cả hai phía của đầu giờ
  (quan sát được `22:59:59.960Z` và `23:00:00.5Z` cùng thuộc một chu kỳ).

**Ảnh hưởng:** báo cáo Telegram, KPI card dashboard, export HTML/PDF, biểu đồ xu hướng
(chuyển từ tuần lịch sang chu kỳ quota), và bảng "seat lãng phí nhiều nhất".

## Phương án đã cân nhắc

- **Giữ công thức, chuẩn hoá theo pha** (`current_pct / tỷ_lệ_thời_gian_đã_trôi`) — loại vì
  nhiễu rất mạnh ở đầu chu kỳ (chia cho số nhỏ) và vẫn khác mô hình của mục HIỆU QUẢ, nên không
  giải quyết được mâu thuẫn nội bộ.
- **Chỉ dùng dự phóng, bỏ hẳn số liệu lịch sử** — loại vì dự phóng không trả lời được câu hỏi kế
  toán "tháng vừa rồi thực sự phí bao nhiêu tiền", vốn là mục đích của con số `/tháng`.
