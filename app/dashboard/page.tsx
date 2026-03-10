import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()

  if (!profile || !profile.onboarding_completed) {
    redirect('/onboarding')
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div>
      <p>Welcome to Counterplay</p>
      <p>{user.email}</p>
      <Link href="/dashboard/input">Run your analysis</Link>
      <form action={signOut}>
        <button type="submit">Sign Out</button>
      </form>
    </div>
  )
}
