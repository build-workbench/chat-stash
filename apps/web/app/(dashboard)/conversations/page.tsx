import { signOut } from '@/app/(auth)/actions'

export default function ConversationsPage() {
  return (
    <main>
      <h1>Conversations</h1>
      <p>Your saved conversations will appear here.</p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  )
}
