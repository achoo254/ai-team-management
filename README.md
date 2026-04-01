# Claude Teams Management Dashboard

Dashboard quản lý tài khoản Claude Teams nội bộ. Tập trung quản lý phân bổ seat, theo dõi mức sử dụng, lịch trình, cảnh báo và thông báo qua Telegram.

> [English version (README.en.md)](./README.en.md)

## Bắt đầu nhanh

### Yêu cầu
- Node.js 18+
- pnpm 9+
- MongoDB (local hoặc cloud)
- Firebase project với service account JSON
- (Tuỳ chọn) Telegram bot cho thông báo

### Cài đặt

1. Clone repo và cài dependencies:
```bash
pnpm install
```

2. Tạo file `.env.local` cho từng package:
```bash
cp packages/api/.env.example packages/api/.env.local
cp packages/web/.env.example packages/web/.env.local
```

3. Điền các biến môi trường bắt buộc (xem phần Biến môi trường bên dưới).

4. Reset database với dữ liệu mẫu:
```bash
pnpm db:reset
```

5. Khởi động server phát triển:
```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8386`

## Lệnh

| Lệnh | Mục đích |
|---------|---------|
| `pnpm install` | Cài dependencies cho toàn bộ workspace |
| `pnpm dev` | Chạy cả web + api song song (dev) |
| `pnpm dev:web` | Chạy Vite dev server (port 5173) |
| `pnpm dev:api` | Chạy Express API (port 8386) |
| `pnpm build` | Build toàn bộ packages |
| `pnpm build:staging` | Build cho staging |
| `pnpm lint` | Chạy ESLint |
| `pnpm test` | Chạy Vitest tests |
| `pnpm test:coverage` | Chạy tests với coverage |
| `pnpm db:reset` | Xoá MongoDB + seed lại dữ liệu mẫu |

## Công nghệ

| Tầng | Công nghệ |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Package Manager** | pnpm workspaces (monorepo) |
| **Backend** | Express 5, TypeScript (ESM), tsx |
| **Database** | MongoDB (Mongoose 9) |
| **Xác thực** | Firebase Admin SDK + JWT |
| **Frontend** | React 19, React Router v7, Vite |
| **State** | TanStack React Query |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) |
| **UI Components** | shadcn/ui (Radix UI), Lucide icons |
| **Charts** | Recharts 3 |
| **Drag & Drop** | dnd-kit |
| **Tác vụ định kỳ** | node-cron |
| **Thông báo** | Telegram Bot API |
| **Testing** | Vitest |
| **Linting** | ESLint 9 |

## Biến môi trường

Mỗi package có `.env.local` riêng. Xem `.env.example` trong từng package.

### API (`packages/api/.env.local`)
- `JWT_SECRET` — Khoá ký JWT (tối thiểu 32 ký tự)
- `MONGO_URI` — Chuỗi kết nối MongoDB
- `FIREBASE_SERVICE_ACCOUNT_PATH` — Đường dẫn file JSON Firebase service account
- `API_PORT` — Cổng API (mặc định: 8386)
- `WEB_URL` — URL frontend (mặc định: http://localhost:5173)
- `TELEGRAM_BOT_TOKEN` — Token bot Telegram cho thông báo
- `TELEGRAM_CHAT_ID` — Chat ID Telegram cho cảnh báo
- `TELEGRAM_TOPIC_ID` — Topic ID Telegram (tuỳ chọn)
- `ANTHROPIC_BASE_URL` — URL Anthropic API (mặc định: https://api.anthropic.com)
- `ANTHROPIC_ADMIN_KEY` — Admin key Anthropic
- `ANTHROPIC_VERSION` — Phiên bản API Anthropic

### Web (`packages/web/.env.local`)
- `VITE_FIREBASE_API_KEY` — Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` — Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` — Firebase project ID
- `VITE_API_URL` — URL API backend (mặc định: http://localhost:8386)

## Kiến trúc

### Monorepo (pnpm workspaces)

```
packages/
├── api/      — Express 5 + TypeScript backend (ESM)
├── web/      — Vite + React 19 SPA
└── shared/   — Shared TypeScript types
```

### Backend (`packages/api`)
- **Xác thực**: Đăng nhập Google qua Firebase, JWT cookie (24h)
- **API**: 8 file route REST endpoints
- **Models**: 6 Mongoose collection (seats, users, usage_logs, schedules, alerts, teams)
- **Services**: alert-service, telegram-service, usage-sync-service, anthropic-service
- **Cron Jobs**: Thứ 6 lúc 15:00 & 17:00 (Asia/Saigon)
- **Dev**: `tsx watch --env-file .env.local`

### Frontend (`packages/web`)
- React 19 SPA với React Router v7
- 8 pages: dashboard, seats, teams, schedule, alerts, log-usage, admin, login
- 20+ feature components + shadcn/ui components
- 9 React Query hooks cho data fetching
- Recharts cho biểu đồ, dnd-kit cho drag-and-drop
- Vite proxy `/api` → Express backend

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
ai-team-management/
├── packages/
│   ├── api/                           # Express 5 backend
│   │   ├── src/
│   │   │   ├── index.ts               # App entry, CORS, cron jobs
│   │   │   ├── config.ts              # Env config
│   │   │   ├── db.ts                  # Mongoose connection
│   │   │   ├── middleware.ts           # JWT auth, role checks
│   │   │   ├── firebase-admin.ts      # Firebase Admin SDK
│   │   │   ├── seed-data.ts           # Database seed data
│   │   │   ├── models/                # 6 Mongoose models
│   │   │   ├── routes/                # 8 REST route files
│   │   │   ├── services/              # Business logic (4 services)
│   │   │   └── scripts/db-reset.ts    # DB reset utility
│   │   └── .env.example
│   │
│   ├── web/                           # Vite + React 19 SPA
│   │   ├── src/
│   │   │   ├── main.tsx               # Entry point
│   │   │   ├── app.tsx                # Router + QueryClient
│   │   │   ├── pages/                 # 8 page components
│   │   │   ├── components/            # Feature + shadcn/ui components
│   │   │   ├── hooks/                 # 9 React Query hooks
│   │   │   └── lib/                   # api-client, firebase, theme, utils
│   │   ├── vite.config.ts             # Vite + Tailwind + proxy config
│   │   └── .env.example
│   │
│   └── shared/                        # Shared TypeScript types
│       └── types.ts
│
├── docs/                              # Documentation
├── plans/                             # Implementation plans
├── .env.example                       # Root env guide
├── pnpm-workspace.yaml                # Workspace config
├── package.json                       # Root scripts
└── CLAUDE.md                          # Dev guidance
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
pnpm db:reset
```

### Chạy dev server
```bash
pnpm dev          # Cả web + api
pnpm dev:web      # Chỉ frontend (port 5173)
pnpm dev:api      # Chỉ backend (port 8386)
```

### Build
```bash
pnpm build            # Production
pnpm build:staging    # Staging
```

### Test & Lint
```bash
pnpm test             # Run tests
pnpm test:coverage    # Tests with coverage
pnpm lint             # ESLint
```

## Xử lý sự cố

| Vấn đề | Giải pháp |
|-------|----------|
| Không kết nối được MongoDB | Kiểm tra `MONGO_URI` trong `packages/api/.env.local` |
| "Invalid Firebase token" | Kiểm tra `FIREBASE_SERVICE_ACCOUNT_PATH` trỏ đúng file JSON |
| Đăng nhập Google thất bại | Kiểm tra cấu hình Firebase project và API keys |
| Telegram không gửi | Kiểm tra `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` |
| API không khởi động | Kiểm tra xung đột port 8386. Đặt `API_PORT` nếu cần |
| Web không kết nối API | Kiểm tra `VITE_API_URL` trong `packages/web/.env.local` |

## Tài liệu

- **[Codebase Summary](./docs/codebase-summary.md)** — Tổng quan kỹ thuật chi tiết
- **[Code Standards](./docs/code-standards.md)** — Quy ước đặt tên, mẫu thiết kế
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Tính năng, yêu cầu, lộ trình
- **[System Architecture](./docs/system-architecture.md)** — Hạ tầng, luồng dữ liệu

## Ghi chú phát triển

- **Module system**: ESM (`"type": "module"`) cho cả API và Web
- **TypeScript**: Strict mode, shared types qua `@repo/shared`
- **Code Style**: 2 dấu cách, async/await, conventional commits
- **Kích thước file**: Giữ dưới 200 LOC; tách nếu lớn hơn
- **Xử lý lỗi**: Try-catch trong tất cả handler bất đồng bộ
- **Bảo mật**: JWT trong httpOnly cookie; Firebase Admin SDK xác minh

## Giấy phép

Private

## Hỗ trợ

Nếu có vấn đề hoặc câu hỏi, liên hệ đội phát triển.
