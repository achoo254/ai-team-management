import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { config } from "./config";

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin;

  const serviceAccountPath = path.resolve(config.firebaseServiceAccountPath);
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

const firebaseAdmin = initFirebaseAdmin();

export const adminAuth = firebaseAdmin.auth();
export default firebaseAdmin;
