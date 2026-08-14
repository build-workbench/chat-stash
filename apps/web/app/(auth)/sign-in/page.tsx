import { signIn } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/auth-form'

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  return (
    <main>
      <h1>Sign in to ChatStash</h1>
      <AuthForm
        action={signIn}
        submitLabel="Sign in"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'current-password',
          },
        ]}
        searchParams={searchParams}
      />
      <p>
        <a href="/forgot-password">Forgot your password?</a>
      </p>
      <p>
        Don&apos;t have an account? <a href="/sign-up">Sign up</a>
      </p>
    </main>
  )
}
