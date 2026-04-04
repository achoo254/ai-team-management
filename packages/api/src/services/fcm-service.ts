import { getMessaging } from '../firebase-admin.js'
import { User } from '../models/user.js'
import type { AlertType } from '@repo/shared/types'

const ALERT_DISPLAY: Record<AlertType, { title: string }> = {
  rate_limit: { title: 'Rate Limit Warning' },
  extra_credit: { title: 'Extra Credit Warning' },
  token_failure: { title: 'Token Failure' },
  usage_exceeded: { title: 'Usage Budget Exceeded' },
  session_waste: { title: 'Session lãng phí' },
  '7d_risk': { title: '7d Usage Risk' },
}

/** Send FCM push to a user's registered devices */
export async function sendPushToUser(
  userId: string,
  type: AlertType,
  seatLabel: string,
  message: string,
  alertId: string,
) {
  const user = await User.findById(userId, 'fcm_tokens push_enabled')
  if (!user?.push_enabled || !user.fcm_tokens?.length) return

  const display = ALERT_DISPLAY[type]
  const messaging = getMessaging()
  const staleTokens: string[] = []

  await Promise.allSettled(
    user.fcm_tokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: display.title,
            body: `${seatLabel}: ${message}`,
          },
          data: { type, alertId, url: '/alerts' },
          webpush: { fcmOptions: { link: '/alerts' } },
        })
      } catch (err: any) {
        if (err?.code === 'messaging/registration-token-not-registered'
          || err?.code === 'messaging/invalid-registration-token') {
          staleTokens.push(token)
        } else {
          console.error(`[FCM] Send failed for user ${userId}:`, err?.message)
        }
      }
    }),
  )

  // Cleanup stale tokens
  if (staleTokens.length > 0) {
    await User.updateOne(
      { _id: userId },
      { $pull: { fcm_tokens: { $in: staleTokens } } },
    )
  }
}
