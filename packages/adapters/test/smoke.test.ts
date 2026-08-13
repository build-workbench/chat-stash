import { expect, test } from 'vitest'

import { adaptersPackageName } from '../src/index'

test('adapters package entry resolves', () => {
  expect(adaptersPackageName).toBe('@chatstash/adapters')
})
