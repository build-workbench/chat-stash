import { describe, expect, test } from 'vitest'

import { buildFolderTree, descendantIds } from '@/features/folders/tree'

const rows = [
  { id: 'a', name: 'Work', parentId: null, sortOrder: 0 },
  { id: 'b', name: 'AI', parentId: 'a', sortOrder: 0 },
  { id: 'c', name: 'Personal', parentId: null, sortOrder: 1 },
  { id: 'd', name: 'Deep', parentId: 'b', sortOrder: 0 },
]

describe('folder tree', () => {
  test('builds a nested tree from a flat owned list', () => {
    const { roots, invalid } = buildFolderTree(rows)
    expect(invalid).toBe(false)
    expect(roots.map((node) => node.name)).toEqual(['Work', 'Personal'])
    expect(roots[0].children[0].name).toBe('AI')
    expect(roots[0].children[0].children[0].name).toBe('Deep')
  })

  test('surfaces orphans without crashing', () => {
    const { roots, invalid } = buildFolderTree([
      { id: 'x', name: 'Orphan', parentId: 'missing', sortOrder: 0 },
    ])
    expect(invalid).toBe(true)
    expect(roots).toHaveLength(1)
  })

  test('descendantIds includes the node and its children', () => {
    const { roots } = buildFolderTree(rows)
    expect([...descendantIds(roots, 'a')].sort()).toEqual(['a', 'b', 'd'])
  })
})
