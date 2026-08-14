import { handleMessage } from '@/messaging/handlers'

// Restrict chrome.storage.local to trusted contexts (background/popup) so
// content scripts on AI pages can never read the Extension session.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {
  // Older Chrome builds may reject the call; the build must then raise the
  // minimum Chrome version instead of silently downgrading storage access.
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch(() => sendResponse({ ok: false, error: 'SERVICE_UNAVAILABLE' }))
  // Keep the message channel open for the async response.
  return true
})
