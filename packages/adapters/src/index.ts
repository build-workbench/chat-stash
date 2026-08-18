import { chatgptAdapter } from './platforms/chatgpt'
import { deepseekAdapter } from './platforms/deepseek'
import { registerAdapter } from './registry'

export * from './markdown/convert'
export * from './registry'
export * from './types'

export { chatgptAdapter } from './platforms/chatgpt'
export { deepseekAdapter } from './platforms/deepseek'

// Dev/test-only adapter. Deliberately not registered by default; extension
// development registers it explicitly for the synthetic vertical slice.
export { SYNTHETIC_HOST, syntheticAdapter } from './platforms/synthetic'

/** Register the production ChatGPT and DeepSeek adapters. Safe to call twice. */
export function registerEnabledAdapters(): void {
  registerAdapter(chatgptAdapter)
  registerAdapter(deepseekAdapter)
}

export const adaptersPackageName = '@chatstash/adapters'
