'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  safeRedirectPath,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth'

function authErrorRedirect(error: { message: string } | null, fallback: string) {
  // Do not leak whether an account exists. Use generic copy for auth failures.
  if (!error) return fallback
  if (error.message.includes('Invalid login credentials')) {
    return '/sign-in?error=Invalid+credentials'
  }
  if (error.message.includes('Email not confirmed')) {
    return '/sign-in?error=Email+not+confirmed'
  }
  return `/sign-in?error=${encodeURIComponent(error.message)}`
}

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    redirect('/sign-in?error=Invalid+input')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    redirect(authErrorRedirect(error, '/sign-in?error=Unable+to+sign+in'))
  }

  redirect(safeRedirectPath(formData.get('next') as string | null))
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    redirect('/sign-up?error=Invalid+input')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    redirect(authErrorRedirect(error, '/sign-up?error=Unable+to+create+account'))
  }

  redirect('/sign-in?message=Check+your+email+to+confirm+your+account')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}

export async function forgotPassword(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    redirect('/forgot-password?error=Invalid+input')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  })

  if (error) {
    // Do not leak account existence.
    redirect('/forgot-password?message=If+an+account+exists%2C+a+reset+link+has+been+sent')
  }

  redirect('/forgot-password?message=If+an+account+exists%2C+a+reset+link+has+been+sent')
}

export async function resetPassword(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    redirect('/reset-password?error=Invalid+input')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    redirect('/reset-password?error=Unable+to+update+password')
  }

  redirect('/sign-in?message=Password+updated+successfully')
}
