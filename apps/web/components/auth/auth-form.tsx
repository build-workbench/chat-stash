'use client'

import { use, useActionState } from 'react'
import { useFormStatus } from 'react-dom'

type Field = {
  name: string
  label: string
  type: string
  autoComplete: string
}

type AuthFormProps = {
  action: (formData: FormData) => Promise<void>
  submitLabel: string
  fields: Field[]
  searchParams: Promise<{ error?: string; message?: string }>
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Working…' : label}
    </button>
  )
}

export function AuthForm({ action, submitLabel, fields, searchParams }: AuthFormProps) {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string; message?: string }, formData: FormData) => {
      await action(formData)
      return {}
    },
    {},
  )

  return (
    <form action={formAction}>
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
          />
        </div>
      ))}
      <SubmitButton label={submitLabel} />
      <FormMessage searchParams={searchParams} state={state} />
    </form>
  )
}

function FormMessage({
  searchParams,
  state,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
  state: { error?: string; message?: string }
}) {
  const params = use(searchParams)
  const error = state.error ?? params.error
  const message = state.message ?? params.message

  if (!error && !message) return null

  return (
    <div role="alert" aria-live="polite">
      {error ? <p className="auth-msg auth-msg--error">{error}</p> : null}
      {message ? <p className="auth-msg auth-msg--success">{message}</p> : null}
    </div>
  )
}
