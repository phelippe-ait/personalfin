import { useState, type FormEvent } from "react"
import { supabase } from "../../lib/supabase"

export default function AuthScreen() {
  const [email, setEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const sendLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSending(true)
    setError("")

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    setIsSending(false)
    if (authError) {
      setError(authError.message)
      return
    }
    setSent(true)
  }

  return (
    <main className="app-shell grid min-h-[100dvh] place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-[32px] border border-black/[0.07] bg-white/70 p-8 shadow-[0_24px_60px_rgba(20,20,18,0.09)] backdrop-blur-2xl">
        <p className="eyebrow">My wallet</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">
          Sign in to your wallet
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#777772]">
          We’ll email you a secure sign-in link. Your transactions will sync
          with your account.
        </p>

        {sent ? (
          <div className="mt-8 rounded-2xl bg-[#f0f0ec] p-5 text-sm leading-6">
            Check your inbox for a sign-in link for <strong>{email}</strong>.
            You can close this page after opening the link.
          </div>
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={sendLink}>
            <label className="grid gap-2 text-sm font-medium">
              Email address
              <input
                autoComplete="email"
                className="rounded-xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button
              className="rounded-full bg-[#10100f] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={isSending}
              type="submit"
            >
              {isSending ? "Sending link…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
