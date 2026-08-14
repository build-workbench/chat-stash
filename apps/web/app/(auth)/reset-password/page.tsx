import { resetPassword } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/auth-form'

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  return (
    <main>
      <h1>Set a new password</h1>
      <AuthForm
        action={resetPassword}
        submitLabel="Update password"
        fields={[
          {
            name: 'password',
            label: 'New password',
            type: 'password',
            autoComplete: 'new-password',
          },
          {
            name: 'confirmPassword',
            label: 'Confirm new password',
            type: 'password',
            autoComplete: 'new-password',
          },
        ]}
        searchParams={searchParams}
      />
    </main>
  )
}
