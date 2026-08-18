import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { listFolders, listTags } from '@/features/folders/queries'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) redirect('/sign-in')

  const [folders, tags] = await Promise.all([listFolders(), listTags()])

  return (
    <div className="shell">
      <Suspense fallback={<aside className="sidebar">Loading…</aside>}>
        <Sidebar folders={folders.ok ? folders.data : []} tags={tags.ok ? tags.data : []} />
      </Suspense>
      {children}
    </div>
  )
}
