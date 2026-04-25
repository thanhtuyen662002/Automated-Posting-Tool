import { chromium } from 'playwright'
import path from 'node:path'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'

const PLATFORM_LOGIN_URLS: Record<string, string> = {
  "tiktok": "https://www.tiktok.com/login",
  "facebook": "https://www.facebook.com",
  "youtube": "https://accounts.google.com/ServiceLogin?service=youtube",
  "instagram": "https://www.instagram.com/accounts/login/",
}

export async function launchBrowserForLogin(pageData: any, onClosed?: () => void) {
  const { id, profile_dir, platform } = pageData
  const loginUrl = PLATFORM_LOGIN_URLS[platform.toLowerCase()] || "https://www.google.com"
  
  // Ensure profile dir
  const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
  const userDataDir = profile_dir || path.join(rootPath, 'browser_profiles', `page_${id}`)
  mkdirSync(userDataDir, { recursive: true })

  console.log(`Launching browser for ${platform} with profile ${userDataDir}`)

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome', // Preferred
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
    ],
    viewport: { width: 1280, height: 800 },
  }).catch(() => {
    // Fallback if chrome not found
    return chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  })

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage()
  
  await page.goto(loginUrl)

  context.on('close', () => {
    console.log(`Browser for page ${id} closed.`)
    if (onClosed) onClosed()
  })

  return context
}

/**
 * Basic Auto-Posting logic skeleton
 * In a real-world scenario, this would navigate to the specific upload page of the platform,
 * fill in the caption, upload the media, and click 'Post'.
 */
export async function postContent(pageData: any, postData: any) {
  const { id, profile_dir, platform } = pageData
  const { title, content, media_path } = postData
  
  const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
  const userDataDir = profile_dir || path.join(rootPath, 'browser_profiles', `page_${id}`)
  
  // Platform specific upload URLs
  const UPLOAD_URLS: Record<string, string> = {
    "TikTok": "https://www.tiktok.com/upload",
    "Facebook": "https://www.facebook.com/reels/create", // Example for reels
    "Instagram": "https://www.instagram.com/",
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Visible for now so user can see progress
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  })

  try {
    const page = await context.newPage()
    const uploadUrl = UPLOAD_URLS[platform] || "https://www.google.com"
    
    console.log(`[Automation] Posting to ${platform}: ${title}`)
    await page.goto(uploadUrl)
    
    // logic would go here:
    // await page.setInputFiles('input[type="file"]', media_path)
    // await page.fill('div[contenteditable="true"]', content)
    // await page.click('button:has-text("Post")')

    await page.waitForTimeout(5000) // Dummy wait for visual confirmation
    return { success: true }
  } catch (error: any) {
    console.error(`[Automation] Error posting to ${platform}:`, error)
    return { success: false, error: error.message }
  } finally {
    await context.close()
  }
}
