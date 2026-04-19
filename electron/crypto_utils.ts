import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const ALGORITHM = 'aes-256-cbc'
const KEY_PATH = path.join(app.getPath('userData'), '.secret.key')

let SECRET_KEY: Buffer

// Initialize or load key
const initKey = () => {
    if (fs.existsSync(KEY_PATH)) {
        SECRET_KEY = fs.readFileSync(KEY_PATH)
    } else {
        SECRET_KEY = crypto.randomBytes(32)
        fs.writeFileSync(KEY_PATH, SECRET_KEY)
    }
}

initKey()

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return `${iv.toString('hex')}:${encrypted}`
}

export function decrypt(text: string): string {
    const [ivHex, encryptedText] = text.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}
