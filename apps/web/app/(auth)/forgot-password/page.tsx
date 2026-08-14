import { forgotPassword } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/auth-form'

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  return (
    <main>
      <h1>Reset your password</h1>
      <p>Enter your email address and we will send you a link to reset your password.</p>
      <AuthForm
        action={forgotPassword}
        submitLabel="Send reset link"
        fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
        searchParams={searchParams}
      />
      <p>
        <a href="/sign-in">Back to sign in</a>
      </p>
    </main>
  )
}
