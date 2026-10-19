import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import AuthScreen from "./features/auth/AuthScreen"
import WalletApp from "./features/wallet/WalletApp"
import { supabase } from "./lib/supabase"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true
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
      onSignOut={() => supabase.auth.signOut()}
    />
  ) : (
    <AuthScreen />
  )
}
