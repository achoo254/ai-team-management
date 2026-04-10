// User-facing device management routes (JWT-authenticated).
// Plaintext api_key is returned ONCE at creation — never persisted in plaintext.
import { Router, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { authenticate } from '../middleware.js'
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
 * Returns: { device, api_key } — api_key plaintext returned ONCE.
 */
router.post('/', async (req: Request, res: Response) => {
  const { device_name, hostname } = req.body ?? {}
  if (device_name != null && (typeof device_name !== 'string' || device_name.length > 200)) {
    res.status(400).json({ error: 'device_name invalid or too long' })
    return
  }
  if (hostname != null && (typeof hostname !== 'string' || hostname.length > 200)) {
    res.status(400).json({ error: 'hostname invalid or too long' })
    return
  }

  const user_id = new mongoose.Types.ObjectId(req.user!._id)
  const { device, plaintext_api_key } = await createDevice({
    user_id,
    device_name: device_name?.trim() || undefined,
    hostname: hostname?.trim() || undefined,
  })

  res.status(201).json({
    device: device.toJSON(),
    api_key: plaintext_api_key, // client MUST surface to user — cannot be recovered later
  })
})

/** GET /api/devices — list current user's devices (no encrypted keys). */
router.get('/', async (req: Request, res: Response) => {
  const user_id = new mongoose.Types.ObjectId(req.user!._id)
  const devices = await listDevicesForUser(user_id)
  res.json({ devices })
})

/** DELETE /api/devices/:id — soft revoke (keeps session history). */
router.delete('/:id', async (req: Request, res: Response) => {
  const rawId = req.params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid device id' })
    return
  }
  const user_id = new mongoose.Types.ObjectId(req.user!._id)
  const device = await revokeDevice(id, user_id)
  if (!device) {
    res.status(404).json({ error: 'Device not found or already revoked' })
    return
  }
  res.json({ device })
})

export default router
