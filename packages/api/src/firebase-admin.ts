import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import { config } from './config.js'

function getFirebaseAdmin(): typeof admin {
  if (admin.apps.length > 0) return admin
  const serviceAccountPath = config.firebaseServiceAccountPath
  if (!serviceAccountPath) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH env variable is not set')
  const resolved = path.resolve(serviceAccountPath)
  const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  return admin
}

export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth()
}

export function getMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging()
}
