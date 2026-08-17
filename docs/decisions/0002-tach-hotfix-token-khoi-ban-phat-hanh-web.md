# ADR-0002: Tách hotfix token race khỏi bản phát hành web đang chờ

- **Ngày:** 2026-08-17
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Production (`103.72.98.65`, pm2 process `ai`) chạy hai artifact được build ở hai
thời điểm rất xa nhau:

- `backend/index.js` — build từ code khoảng `2bb2c01` (12/06).
- `client/` — build từ code khoảng `aaa9120` (29/05).

Hotfix cho token race (xem `fix(api): stop the usage collector racing the token
refresh`) cần lên production gấp: mỗi lần refresh token có ~62% xác suất sinh
HTTP 401 giả, đẩy ra cảnh báo "Token Failure" bảo chủ seat re-import một
credential vẫn còn tốt.

Nhưng giữa baseline production và `main` có commit `770da68` (01/08) đổi
`FleetKpis.wasteUsd` và `wwDelta` từ `number` sang `number | null`. Client đang
chạy trên production được build **trước** commit đó, nên nó gọi thẳng
`wasteUsd.toFixed(0)` và `wwDelta.toFixed(1)` không kiểm tra null — guard null
được thêm chính trong `770da68`. Deploy API từ `main` mà giữ client cũ sẽ làm
tab Overview crash ngay khi chưa seat nào chạy hết một chu kỳ quota.

## Quyết định

Build bundle API cho production từ `2bb2c01` + đúng hai commit hotfix
(cherry-pick), **không** kèm `770da68` và các commit web đang chờ. Client giữ
nguyên, không deploy lại.

## Lý do (tại sao)

- Hotfix cần lên ngay, còn `770da68` thì không — gộp chúng lại biến một bản vá
  hẹp thành một bản phát hành đổi mô hình đo lãng phí.
- Cherry-pick lên baseline production đã được kiểm chứng là sạch, không conflict,
  nên chi phí tách gần bằng không.
- Không rebuild client thì không phải dựng lại `VITE_FIREBASE_*`. Các biến này
  chỉ còn tồn tại bên trong bundle client đang chạy (Vite inline lúc build);
  dựng sai đồng nghĩa không ai đăng nhập được.
- Sau khi lớp A khử race, cảnh báo soft-fail gần như không còn phát sinh, nên
  phần lớp C nằm ở web (`alert-card.tsx`) mất rất ít giá trị khi hoãn lại.

## Đánh đổi & hệ quả

- **Được:** production hết 401 giả mà không nhận thêm bất kỳ thay đổi hành vi nào
  ngoài hotfix.
- **Mất:** production đang chạy một artifact **không ứng với commit nào trên
  `main`**. Không suy ra được trạng thái production từ lịch sử git — phải đọc ADR
  này.
- Alert feed trên web vẫn hiện "Cần re-import credential" cho cả lỗi tạm thời cho
  tới khi client được deploy lại.
- **Nợ phải trả:** lần deploy tới **bắt buộc** đưa cả API và client lên cùng một
  commit. Deploy API lẻ từ `main` mà bỏ client sẽ vấp đúng lỗi null đã mô tả ở
  trên.

## Cách dựng lại env khi build cho production

`packages/api/build.ts` inline `process.env.*` vào bundle qua esbuild `define`,
nên không có file `.env` nào trên server và pm2 cũng không mang biến nào. Giá trị
thật chỉ còn nằm trong bundle đang chạy. Trước khi build lại, phải trích chúng ra
từ `backend/index.js` (khối `config`) rồi truyền qua `--env=<file>`; build với
`.env` rỗng sẽ tạo bundle mất `MONGO_URI`, `JWT_SECRET` và `ENCRYPTION_KEY`.

`ANTHROPIC_ADMIN_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` hiện là chuỗi
rỗng trên production — đó là trạng thái thật, không phải trích sót. Cảnh báo
Telegram đi qua bot riêng của từng user lưu trong DB nên không phụ thuộc bot hệ
thống.

## Phương án đã cân nhắc

- **Deploy đồng bộ API + client từ `main`:** hết lệch phiên bản, nhưng kéo theo
  toàn bộ thay đổi web từ 29/05 tới nay trong một bước, và phải dựng lại cấu hình
  Firebase cho client — rủi ro lớn hơn nhiều so với bản vá đang cần gấp.
- **Deploy API từ `main`, giữ client cũ:** thao tác đơn giản nhất nhưng làm vỡ tab
  Overview khi `wasteUsd` hoặc `wwDelta` trả `null`.
