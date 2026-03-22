# Claude Teams Management Dashboard

Dashboard quản lý tài khoản Claude Teams nội bộ. Tập trung quản lý phân bổ seat, theo dõi mức sử dụng, lịch trình, cảnh báo và thông báo qua Telegram.

> [English version (README.en.md)](./README.en.md)

## Bắt đầu nhanh

### Yêu cầu
- Node.js 18+
- pnpm (khuyến nghị) hoặc npm
- MongoDB (local hoặc cloud)
- Firebase project với service account JSON
- (Tuỳ chọn) Telegram bot cho thông báo

### Cài đặt

1. Clone repo và cài dependencies:
```bash
pnpm install
```

2. Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

3. Điền các biến môi trường bắt buộc:
   - `JWT_SECRET`: Chuỗi ngẫu nhiên 32+ ký tự
   - `MONGO_URI`: Chuỗi kết nối MongoDB
   - `FIREBASE_SERVICE_ACCOUNT_PATH`: Đường dẫn file JSON Firebase service account

4. Reset database với dữ liệu mẫu:
```bash
pnpm run db:reset
```

5. Khởi động server phát triển:
```bash
pnpm dev
```

Truy cập ứng dụng tại `http://localhost:3000`

## Lệnh

| Lệnh | Mục đích |
|---------|---------|
| `pnpm install` | Cài dependencies |
| `pnpm dev` | Chạy với auto-reload (phát triển) |
| `pnpm start` | Chạy server production |
| `pnpm run db:reset` | Xoá MongoDB + seed lại dữ liệu mẫu |

## Công nghệ

| Tầng | Công nghệ |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Backend** | Express 5 |
| **Cơ sở dữ liệu** | MongoDB (via Mongoose) |
| **Xác thực** | Firebase Admin SDK + JWT |
| **Frontend** | Vanilla JS (ES6+) SPA |
| **Styling** | Tailwind CSS (CDN) |
| **Framework** | Alpine.js |
| **Tác vụ định kỳ** | node-cron |
| **Thông báo** | Telegram Bot API |

## Biến môi trường

### Bắt buộc
- `JWT_SECRET` — Khoá ký JWT (tối thiểu 32 ký tự)
- `MONGO_URI` — Chuỗi kết nối MongoDB
- `FIREBASE_SERVICE_ACCOUNT_PATH` — Đường dẫn file JSON Firebase service account

### Tuỳ chọn
- `PORT` — Cổng server (mặc định: 3000)
- `TELEGRAM_BOT_TOKEN` — Token bot Telegram cho thông báo
- `TELEGRAM_CHAT_ID` — Chat ID Telegram cho cảnh báo
- `TELEGRAM_TOPIC_ID` — Topic ID Telegram (tuỳ chọn)
- `APP_URL` — URL công khai cho link trong tin nhắn (mặc định: http://localhost:3000)

Xem `.env.example` để tham khảo đầy đủ.

## Tổng quan kiến trúc

### Backend (Express 5)
- **Xác thực**: Đăng nhập Google qua Firebase, xác thực JWT qua cookie
- **API**: 8 file route với 28 REST endpoint
- **Models**: 6 Mongoose collection (seats, users, usage_logs, schedules, alerts, teams)
- **Services**: Logic nghiệp vụ cho cảnh báo, thông báo Telegram, theo dõi sử dụng
- **Cron Jobs**: Thứ 6 lúc 15:00 & 17:00 (Asia/Saigon) cho nhắc nhở và báo cáo

### Frontend (Vanilla JS SPA)
- Ứng dụng trang đơn từ `public/index.html`
- 8 view partial được tải động
- Alpine.js cho tương tác nhẹ
- Tailwind CSS cho giao diện
- Không cần bước build

### Cơ sở dữ liệu (MongoDB)
```
Collections:
  - seats: Tài khoản Claude Teams
  - users: Thành viên và phân công
  - usage_logs: Phần trăm sử dụng hàng tuần
  - schedules: Phân lịch theo khung giờ (ngày + sáng/chiều)
  - alerts: Thông báo sử dụng cao & không hoạt động
  - teams: Định nghĩa đội nhóm
```

## Cấu trúc dự án

```
quan-ly-team-claude/
├── server/
│   ├── index.js                    # Express app, async startup, cron jobs
│   ├── config.js                   # Cấu hình môi trường
│   ├── db/
│   │   ├── database.js             # Kết nối Mongoose
│   │   └── migrations.js           # Dữ liệu seed
│   ├── models/                     # Mongoose schemas (6 models)
│   ├── middleware/
│   │   └── auth-middleware.js      # JWT auth, kiểm tra quyền
│   ├── routes/                     # REST API routes (8 files, 28 endpoints)
│   ├── services/                   # Logic nghiệp vụ
│   ├── lib/
│   │   └── firebase-admin-init.js  # Firebase Admin SDK setup
│   └── scripts/
│       └── db-reset.js             # Tiện ích reset DB
│
├── public/
│   ├── index.html                  # SPA shell
│   ├── login.html                  # Trang đăng nhập Google
│   ├── js/
│   │   ├── api-client.js           # Fetch wrapper
│   │   ├── dashboard-app.js        # Alpine.js app chính
│   │   ├── dashboard-helpers.js    # Tiện ích UI
│   │   └── dashboard-admin-actions.js # Chức năng admin
│   └── views/                      # HTML partials (8 views)
│
├── docs/
│   ├── codebase-summary.md         # Tổng quan kỹ thuật
│   ├── code-standards.md           # Quy ước code
│   └── project-overview-pdr.md     # Tính năng & yêu cầu
│
├── .env.example                    # Mẫu biến môi trường
├── package.json                    # Dependencies
└── CLAUDE.md                       # Hướng dẫn phát triển
```

## Tính năng chính

### Quản lý Seat
Tạo, cập nhật và xoá seat Claude Teams. Phân công vào nhóm. Theo dõi dung lượng seat và người dùng hiện tại.

### Ghi nhận mức sử dụng
Người dùng ghi nhận phần trăm sử dụng hàng tuần (0-100%) cho tất cả model và chi tiết từng model. Lưu trữ theo người dùng theo tuần.

### Lịch trình
Phân lịch khung giờ sáng (8:00-12:00) và chiều (13:00-17:00). Gán người dùng theo ngày + khung giờ. Ngăn trùng lịch trên cùng seat.

### Cảnh báo
Tự động cảnh báo khi sử dụng cao (>80%) hoặc không hoạt động (>1 tuần). Admin có thể tạo, xem và giải quyết cảnh báo.

### Thông báo Telegram
- **Thứ 6 15:00**: Nhắc ghi nhận mức sử dụng tuần qua
- **Thứ 6 17:00**: Tổng kết tuần với thống kê và cảnh báo

### Xác thực
Đăng nhập Google qua Firebase. Server xác minh và cấp JWT cookie (hết hạn 24h). Tất cả endpoint yêu cầu xác thực; thao tác admin yêu cầu quyền admin.

## Tác vụ thường dùng

### Reset Database
```bash
pnpm run db:reset
```
Xoá MongoDB và seed lại dữ liệu mẫu.

### Xem Logs
Server phát triển in log ra console. Kiểm tra terminal để xem request, thao tác DB và cron job.

### Test API
Dùng curl, Postman hoặc network tab trình duyệt. Tất cả endpoint yêu cầu xác thực (JWT cookie hoặc Bearer token).

### Bật Telegram
Đặt `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` trong `.env`. Cron job sẽ tự động gửi thông báo vào thứ 6.

## Xử lý sự cố

| Vấn đề | Giải pháp |
|-------|----------|
| Không kết nối được MongoDB | Kiểm tra `MONGO_URI` trong `.env` và xác nhận MongoDB đang chạy |
| "Invalid Firebase token" | Kiểm tra `FIREBASE_SERVICE_ACCOUNT_PATH` trỏ đúng file JSON |
| Đăng nhập Google thất bại | Kiểm tra cấu hình Firebase project và API keys |
| Telegram không gửi | Kiểm tra `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` đã được đặt |
| Server không khởi động | Kiểm tra xung đột cổng; mặc định 3000. Đặt biến `PORT` nếu cần |

## Tài liệu

- **[Codebase Summary](./docs/codebase-summary.md)** — Tổng quan kỹ thuật chi tiết
- **[Code Standards](./docs/code-standards.md)** — Quy ước đặt tên, mẫu thiết kế
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Tính năng, yêu cầu, lộ trình
- **[System Architecture](./docs/system-architecture.md)** — Hạ tầng, luồng dữ liệu

## Ghi chú phát triển

- **Hệ thống module**: CommonJS xuyên suốt (không dùng ES6 imports)
- **Code Style**: Thụt lề 2 dấu cách, async/await cho tất cả thao tác bất đồng bộ
- **Kích thước file**: Giữ dưới 200 LOC; cân nhắc tách nếu lớn hơn
- **Xử lý lỗi**: Try-catch trong tất cả handler bất đồng bộ
- **Bảo mật**: JWT lưu trong httpOnly cookie; Firebase Admin SDK xác minh

## Cải tiến tương lai

- Phân tích nâng cao (xu hướng, chi tiết từng model)
- Tự động gán người dùng vào seat trống
- Cảnh báo dự đoán theo xu hướng sử dụng
- Thông báo Slack song song Telegram
- Nhật ký kiểm toán (ai làm gì, khi nào)
- Cải thiện responsive cho mobile
- Chế độ tối

## Giấy phép

Private

## Hỗ trợ

Nếu có vấn đề hoặc câu hỏi, liên hệ đội phát triển.
