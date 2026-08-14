export * from './markdown/convert'
export * from './registry'
export * from './types'

// Dev/test-only adapter. Deliberately not registered by default; extension
// development registers it explicitly for the synthetic vertical slice.
export { SYNTHETIC_HOST, syntheticAdapter } from './platforms/synthetic'

export const adaptersPackageName = '@chatstash/adapters'
