import { expect, test } from 'vitest'

import { sharedPackageName } from '../src/index'

test('shared package entry resolves', () => {
  expect(sharedPackageName).toBe('@chatstash/shared')
})
