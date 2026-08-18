'use client'

import { useSearchParams } from 'next/navigation'
import { signOut } from '@/app/(auth)/actions'
import {
  createFolder,
  createTag,
  deleteFolder,
  deleteTag,
  renameFolder,
  reparentFolder,
  renameTag,
} from '@/features/folders/actions'
import { buildFolderTree, descendantIds, type FolderNode } from '@/features/folders/tree'
import type { FolderRow, TagRow } from '@/features/conversations/types'

export function Sidebar({ folders, tags }: { folders: FolderRow[]; tags: TagRow[] }) {
  const params = useSearchParams()
  const folderId = params.get('folder') ?? undefined
  const tagId = params.get('tag') ?? undefined
  const { roots, invalid } = buildFolderTree(folders)

  return (
    <aside className="sidebar stack">
      <strong>ChatStash</strong>
      <a
        className="nav-link"
        href="/conversations"
        aria-current={!folderId && !tagId ? 'page' : undefined}
      >
        All Saves
      </a>

      <section className="stack">
        <h2>Folders</h2>
        {invalid ? (
          <p className="muted">
            Folder tree looks inconsistent. Database remains the source of truth.
          </p>
        ) : null}
        <FolderList nodes={roots} activeId={folderId} />
        <form action={createFolder} className="stack">
          <input type="text" name="name" placeholder="New folder" required maxLength={80} />
          {folderId ? <input type="hidden" name="parentId" value={folderId} /> : null}
          <button type="submit">Create folder</button>
        </form>
        {folderId ? <FolderEditor folders={folders} roots={roots} folderId={folderId} /> : null}
      </section>

      <section className="stack">
        <h2>Tags</h2>
        {tags.map((tag) => (
          <div key={tag.id} className="row">
            <a
              className="nav-link"
              href={`/conversations?tag=${tag.id}`}
              aria-current={tagId === tag.id ? 'page' : undefined}
            >
              {tag.name}
            </a>
            <form action={deleteTag}>
              <input type="hidden" name="id" value={tag.id} />
              <button type="submit">Delete</button>
            </form>
          </div>
        ))}
        <form action={createTag} className="stack">
          <input type="text" name="name" placeholder="New tag" required maxLength={80} />
          <button type="submit">Create tag</button>
        </form>
        {tagId ? <TagEditor tags={tags} tagId={tagId} /> : null}
      </section>

      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </aside>
  )
}

function FolderEditor({
  folders,
  roots,
  folderId,
}: {
  folders: FolderRow[]
  roots: FolderNode[]
  folderId: string
}) {
  const current = folders.find((folder) => folder.id === folderId)
  const blocked = descendantIds(roots, folderId)
  const parents = folders.filter((folder) => !blocked.has(folder.id))

  if (!current) return null

  return (
    <div className="stack">
      <form action={renameFolder} className="stack">
        <input type="hidden" name="id" value={current.id} />
        <input type="text" name="name" defaultValue={current.name} required maxLength={80} />
        <button type="submit">Rename</button>
      </form>
      <form action={reparentFolder} className="stack">
        <input type="hidden" name="id" value={current.id} />
        <select name="parentId" defaultValue={current.parentId ?? ''}>
          <option value="">Root</option>
          {parents.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <button type="submit">Move folder</button>
      </form>
    </div>
  )
}

function TagEditor({ tags, tagId }: { tags: TagRow[]; tagId: string }) {
  const current = tags.find((tag) => tag.id === tagId)
  if (!current) return null
  return (
    <form action={renameTag} className="stack">
      <input type="hidden" name="id" value={current.id} />
      <input type="text" name="name" defaultValue={current.name} required maxLength={80} />
      <button type="submit">Rename tag</button>
    </form>
  )
}

function FolderList({
  nodes,
  activeId,
  depth = 0,
}: {
  nodes: FolderNode[]
  activeId?: string
  depth?: number
}) {
  if (nodes.length === 0) return null
  return (
    <ul style={{ listStyle: 'none', paddingLeft: depth === 0 ? 0 : 12, margin: 0 }}>
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="row">
            <a
              className="nav-link"
              href={`/conversations?folder=${node.id}`}
              aria-current={activeId === node.id ? 'page' : undefined}
            >
              {node.name}
            </a>
            <form action={deleteFolder}>
              <input type="hidden" name="id" value={node.id} />
              <button type="submit">Delete</button>
            </form>
          </div>
          <FolderList nodes={node.children} activeId={activeId} depth={depth + 1} />
        </li>
      ))}
    </ul>
  )
}
