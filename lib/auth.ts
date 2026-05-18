import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const USERNAME = 'tarun'
// bcrypt hash of 'eglobe' with 12 rounds
const PASSWORD_HASH = '$2b$12$iO0ANtB3Hbokdc9k1vqUCumz/S/CXY5yPLLEn7CoyrjbKmAKVfmPe'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'hg-b2b-manager-secret-key-change-in-prod'
)
const COOKIE_NAME = 'hg_session'
const SESSION_DURATION = '8h'

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  if (username !== USERNAME) return false
  return bcrypt.compare(password, PASSWORD_HASH)
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: USERNAME })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET)
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET)
    return true
  } catch {
    return false
  }
}

export { COOKIE_NAME }
