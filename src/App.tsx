import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import AuthScreen from "./features/auth/AuthScreen"
import WalletApp from "./features/wallet/WalletApp"
import { getSupabase, isSupabaseConfigured } from "./lib/supabase"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCheckingSession(false)
      return
    }
    let mounted = true
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setCheckingSession(false)
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCheckingSession(false)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#e8e8e4] px-6 py-12">
        <section className="w-full max-w-lg rounded-[28px] border border-black/[0.07] bg-white/75 p-8 shadow-[0_24px_60px_rgba(20,20,18,0.09)]">
          <p className="eyebrow">Setup needed</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            Supabase isn’t configured for this deployment
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#777772]">
            Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel under Project
            Settings → Environment Variables, then redeploy.
          </p>
        </section>
      </main>
    )
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#e8e8e4] text-sm text-[#777772]">
        Loading your wallet…
      </main>
    )
  }

  return session?.user ? (
    <WalletApp
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email ?? ""}
      onSignOut={() => getSupabase().auth.signOut()}
    />
  ) : (
    <AuthScreen />
  )
}
