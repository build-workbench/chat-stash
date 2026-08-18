import type { FolderRow } from '@/features/conversations/types'

export type FolderNode = FolderRow & { children: FolderNode[] }

export function buildFolderTree(rows: FolderRow[]): { roots: FolderNode[]; invalid: boolean } {
  const nodes = new Map<string, FolderNode>()
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] })
  }

  const roots: FolderNode[] = []
  let invalid = false

  for (const row of rows) {
    const node = nodes.get(row.id)
    if (!node) continue
    if (!row.parentId) {
      roots.push(node)
      continue
    }
    const parent = nodes.get(row.parentId)
    if (!parent) {
      invalid = true
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }

  const sortNodes = (list: FolderNode[]) => {
    list.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
    list.forEach((node) => sortNodes(node.children))
  }
  sortNodes(roots)

  return { roots, invalid }
}

export function descendantIds(roots: FolderNode[], id: string): Set<string> {
  const result = new Set<string>()
  const visit = (node: FolderNode) => {
    result.add(node.id)
    node.children.forEach(visit)
  }
  const find = (nodes: FolderNode[]): FolderNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node
      const nested = find(node.children)
      if (nested) return nested
    }
    return undefined
  }
  const target = find(roots)
  if (target) visit(target)
  return result
}
