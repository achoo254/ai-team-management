# Phase 4: Devices Route (JWT)

## Overview
- Priority: MEDIUM
- Status: completed
- Depends on: Phase 3

## File to Create

### 4.1 `packages/api/src/routes/devices.ts` (<150 LOC)

```ts
import { Router, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { authenticate } from '../middleware.js'
import { Device } from '../models/device.js'
import {
  createDevice,
  listDevicesForUser,
  revokeDevice,
} from '../services/device-service.js'

const router = Router()
router.use(authenticate)

/**
 * POST /api/devices
 * Body: { device_name: string, hostname: string }
 * Returns: device object + plaintext api_key (ONCE)
 */
router.post('/', async (req: Request, res: Response) => {
  const { device_name, hostname } = req.body ?? {}
  if (typeof device_name !== 'string' || !device_name.trim() ||
      typeof hostname !== 'string' || !hostname.trim()) {
    res.status(400).json({ error: 'device_name and hostname required' })
    return
  }
  if (device_name.length > 200 || hostname.length > 200) {
    res.status(400).json({ error: 'device_name/hostname too long' })
    return
  }

  const user_id = new mongoose.Types.ObjectId(req.user!._id)
  const { device, plaintext_api_key } = await createDevice({
    user_id,
    device_name: device_name.trim(),
    hostname: hostname.trim(),
  })

  res.status(201).json({
    device: device.toJSON(),
    api_key: plaintext_api_key, // returned ONCE — client must surface to user
  })
})

/** GET /api/devices — list current user's devices */
router.get('/', async (req: Request, res: Response) => {
  const user_id = new mongoose.Types.ObjectId(req.user!._id)
  const devices = await listDevicesForUser(user_id)
  res.json({ devices })
})

/** DELETE /api/devices/:id — soft revoke (keeps session history) */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid device id' })
    return
  }
  const user_id = new mongoose.Types.ObjectId(req.user!._id)
  const device = await revokeDevice(req.params.id, user_id)
  if (!device) {
    res.status(404).json({ error: 'Device not found or already revoked' })
    return
  }
  res.json({ device })
})

export default router
```

**Notes:**
- Manual validation (không dùng Zod ở route-level) — request body tối giản, KISS.
- Không có PATCH/update endpoint phase này (YAGNI).
- Revoked device không delete → history preserved.
- Không giới hạn số device (per user confirmation).

## Acceptance
- Typecheck pass
- JWT required (401 nếu thiếu token)
- POST trả `api_key` plaintext 1 lần duy nhất
- GET trả về list không chứa `api_key_encrypted`
- DELETE set `revoked_at`, không xóa sessions

## Todo
- [x] Create routes/devices.ts
- [x] Test manually với curl (sau khi mount phase 6)
