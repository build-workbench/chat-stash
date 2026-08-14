import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/validation/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  const redirectTo = new URL(request.url)
  redirectTo.pathname = safeRedirectPath(next)

  const supabase = await createClient()

  if (code) {
    // PKCE flow: exchange the authorization code for a session.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirectTo.searchParams.delete('code')
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    }
  } else if (token_hash && type) {
    // Email OTP flow: verify the one-time token from the confirmation link.
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      redirectTo.searchParams.delete('token_hash')
      redirectTo.searchParams.delete('type')
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = '/sign-in'
  redirectTo.search = 'error=Invalid+or+expired+confirmation+link'
  return NextResponse.redirect(redirectTo)
}
