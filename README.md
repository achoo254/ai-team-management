<p align="center">
  <img src="packages/web/public/logo.svg" alt="Claude Teams Manager" width="120" height="120" />
</p>

<h1 align="center">Claude Teams Manager</h1>

<p align="center">
  <strong>Dashboard nội bộ quản lý tài khoản Claude Teams — seats, theo dõi hoạt động, giám sát mức sử dụng & cảnh báo.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/TypeScript-ESM-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Firebase-Auth_+_FCM-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
</p>

> [English version (README.en.md)](./README.en.md)

---

## Tổng quan

Claude Teams Manager là công cụ full-stack nội bộ giúp tập trung quản lý tài khoản Claude Teams. Cung cấp giám sát mức sử dụng realtime, theo dõi hoạt động seat tự động, cảnh báo per-user và thông báo đa kênh — tất cả đằng sau Google SSO với phân quyền theo vai trò.

### Tính năng chính

- **Quản lý Seat** — Tạo, phân công, theo dõi seat Claude Teams với OAuth credentials mã hóa per-owner (AES-256-GCM)
- **Theo dõi hoạt động Seat** — Heatmap hoạt động realtime theo tuần, tự động phát hiện seat đang active qua usage snapshots mỗi 5 phút
- **Giám sát mức sử dụng** — Chụp usage snapshots tự động 5 phút/lần, biểu đồ xu hướng, KPI delta ngày-qua-ngày, activity heatmap
- **Cảnh báo thông minh** — Cấu hình ngưỡng per-user cho rate limit, extra credit, lỗi token với dedup 24h
- **Push Notifications** — Firebase Cloud Messaging (web push) + feed thông báo trong app
- **Tích hợp Telegram** — Nhắc nhở cá nhân theo giờ (bot mã hóa per-user) + tổng kết tuần (system bot)
- **Dashboard Admin** — Phân tích toàn team, session metrics, điều khiển quản trị

---

## Công nghệ sử dụng

### Frontend

| Công nghệ | Mục đích |
|:---|:---|
| **React 19** | UI framework với concurrent features mới nhất |
| **React Router v7** | Client-side routing (SPA) |
| **TanStack React Query** | Quản lý server state & caching |
| **Tailwind CSS v4** | Utility-first styling qua `@tailwindcss/vite` |
| **shadcn/ui** (Radix UI) | UI components accessible, composable |
| **Recharts 3** | Trực quan hóa dữ liệu & biểu đồ |
| **Lucide** | Thư viện icon |
| **Vite** | Build tool với HMR & API proxy |

### Backend

| Công nghệ | Mục đích |
|:---|:---|
| **Express 5** | HTTP framework (async error handling) |
| **TypeScript (ESM)** | Codebase type-safe, ES modules xuyên suốt |
| **MongoDB + Mongoose 9** | Document database với schema validation |
| **node-cron** | Tác vụ định kỳ (thu thập usage, thông báo, refresh token) |
| **tsx** | Dev server với watch mode & env file support |

### Bảo mật & Xác thực

| Công nghệ | Mục đích |
|:---|:---|
| **Firebase Admin SDK** | Xác minh Google ID token |
| **JWT (httpOnly cookie)** | Session token stateless (hết hạn 24h) |
| **AES-256-GCM** | Mã hóa at-rest cho OAuth credentials & Telegram tokens |
| **Phân quyền theo vai trò** | Mô hình quyền Admin / Seat Owner / Member |
| **Firebase Cloud Messaging** | Web push notifications mã hóa |

### Hạ tầng

| Công nghệ | Mục đích |
|:---|:---|
| **pnpm workspaces** | Monorepo với 3 packages (api, web, shared) |
| **ESM everywhere** | Module system nhất quán xuyên suốt |
| **Vitest** | Unit & integration testing |
| **ESLint 9** | Chất lượng & nhất quán code |

---

## Kiến trúc

```
┌─────────────────────────────────────────────────────┐
│                    pnpm monorepo                    │
├──────────────┬──────────────────┬───────────────────┤
│  packages/   │  packages/       │  packages/        │
│  web         │  api             │  shared           │
│              │                  │                   │
│  React 19    │  Express 5       │  TypeScript types │
│  Vite        │  MongoDB         │  Permission logic │
│  Tailwind v4 │  Firebase Admin  │                   │
│  shadcn/ui   │  node-cron       │                   │
│              │  AES-256-GCM     │                   │
└──────┬───────┴────────┬─────────┴───────────────────┘
       │    /api proxy  │
       └────────────────┘
              │
    ┌─────────┴─────────┐
    │     MongoDB       │
    │  7 collections    │
    └───────────────────┘
```

### Luồng xác thực

1. Người dùng đăng nhập Google qua Firebase client SDK
2. `POST /api/auth/google` xác minh token qua Firebase Admin → tự tạo user → cấp JWT cookie
3. Các request tiếp theo xác thực qua httpOnly cookie hoặc Bearer token
4. Hành động admin được kiểm soát bởi middleware; hành động seat-scoped kiểm tra quyền sở hữu

---

## Bắt đầu nhanh

### Yêu cầu

- Node.js 18+
- pnpm 9+
- MongoDB (local hoặc Atlas)
- Firebase project với service account

### Cài đặt

```bash
# Cài dependencies
pnpm install

# Cấu hình môi trường
cp packages/api/.env.example packages/api/.env.local
cp packages/web/.env.example packages/web/.env.local
# Sửa các file .env.local với credentials của bạn

# Khởi động dev
pnpm dev
```

| Dịch vụ | URL |
|:---|:---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8386 |

### Các lệnh

```bash
pnpm dev              # Chạy web + api song song
pnpm build            # Build production
pnpm build:staging    # Build staging
pnpm lint             # ESLint
pnpm test             # Chạy tests
pnpm test:coverage    # Tests với coverage
```

---

## Cấu trúc dự án

```
ai-team-management/
├── packages/
│   ├── api/              # Express 5 backend
│   │   ├── src/
│   │   │   ├── models/   # 7 Mongoose models
│   │   │   ├── routes/   # 8+ REST endpoints
│   │   │   ├── services/ # Business logic
│   │   │   └── lib/      # Tiện ích mã hóa
│   │   └── .env.example
│   ├── web/              # React 19 SPA
│   │   ├── src/
│   │   │   ├── pages/    # 8 page components
│   │   │   ├── components/  # Feature + shadcn/ui
│   │   │   ├── hooks/    # 10+ React Query hooks
│   │   │   └── lib/      # API client, Firebase, utils
│   │   └── .env.example
│   └── shared/           # Shared types & permission logic
├── docs/                 # Tài liệu kỹ thuật
└── plans/                # Kế hoạch triển khai
```

---

## Tài liệu

- [Codebase Summary](./docs/codebase-summary.md) — Tổng quan kỹ thuật
- [Code Standards](./docs/code-standards.md) — Quy ước & patterns
- [System Architecture](./docs/system-architecture.md) — Hạ tầng & luồng dữ liệu
- [Project Overview](./docs/project-overview-pdr.md) — Tính năng & yêu cầu

---

## Giấy phép

[MIT](./LICENSE)
