import { signUp } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/auth-form'

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  return (
    <main>
      <h1>Create your ChatStash account</h1>
      <AuthForm
        action={signUp}
        submitLabel="Sign up"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'new-password',
          },
        ]}
        searchParams={searchParams}
      />
      <p>
        Already have an account? <a href="/sign-in">Sign in</a>
      </p>
    </main>
  )
}
