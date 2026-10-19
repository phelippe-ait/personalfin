import { useState, type FormEvent } from "react"
import { getSupabase } from "../../lib/supabase"

type AuthMethod = "password" | "magic-link"
type PasswordAction = "sign-in" | "sign-up"

export default function AuthScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password")
  const [passwordAction, setPasswordAction] =
    useState<PasswordAction>("sign-in")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setNotice("")
    setError("")

    try {
      const auth = getSupabase().auth
      const normalizedEmail = email.trim()

      if (authMethod === "magic-link") {
        const { error: authError } = await auth.signInWithOtp({
          email: normalizedEmail,
          options: { emailRedirectTo: window.location.origin },
        })
        if (authError) throw authError
        setNotice(`Check ${normalizedEmail} for your sign-in link.`)
      } else if (passwordAction === "sign-up") {
        const { data, error: authError } = await auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (authError) throw authError
        if (!data.session) {
          setNotice(
            `Account created. Check ${normalizedEmail} for the email confirmation link, then return here to sign in.`,
          )
        }
      } else {
        const { error: authError } = await auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (authError) throw authError
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Authentication failed. Please try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const chooseMethod = (method: AuthMethod) => {
    setAuthMethod(method)
    setNotice("")
    setError("")
  }

  return (
    <main className="app-shell grid min-h-[100dvh] place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-[32px] border border-black/[0.07] bg-white/70 p-8 shadow-[0_24px_60px_rgba(20,20,18,0.09)] backdrop-blur-2xl">
        <p className="eyebrow">My wallet</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">
          {authMethod === "magic-link"
            ? "Sign in with a link"
            : passwordAction === "sign-up"
              ? "Create your account"
              : "Sign in to your wallet"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#777772]">
          Your transactions sync securely with your account.
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-full bg-[#f0f0ec] p-1">
          <button
            aria-pressed={authMethod === "password"}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              authMethod === "password"
                ? "bg-white shadow-sm"
                : "text-[#777772]"
            }`}
            onClick={() => chooseMethod("password")}
            type="button"
          >
            Email & password
          </button>
          <button
            aria-pressed={authMethod === "magic-link"}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              authMethod === "magic-link"
                ? "bg-white shadow-sm"
                : "text-[#777772]"
            }`}
            onClick={() => chooseMethod("magic-link")}
            type="button"
          >
            Magic link
          </button>
        </div>

        {authMethod === "password" && (
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <button
              className={
                passwordAction === "sign-in"
                  ? "font-semibold"
                  : "text-[#777772]"
              }
              onClick={() => {
                setPasswordAction("sign-in")
                setNotice("")
                setError("")
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={
                passwordAction === "sign-up"
                  ? "font-semibold"
                  : "text-[#777772]"
              }
              onClick={() => {
                setPasswordAction("sign-up")
                setNotice("")
                setError("")
              }}
              type="button"
            >
              Create account
            </button>
          </div>
        )}

        {notice ? (
          <div
            className="mt-6 rounded-2xl bg-[#f0f0ec] p-5 text-sm leading-6"
            role="status"
          >
            {notice}
          </div>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={submit}>
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
            {authMethod === "password" && (
              <label className="grid gap-2 text-sm font-medium">
                Password
                <input
                  autoComplete={
                    passwordAction === "sign-up"
                      ? "new-password"
                      : "current-password"
                  }
                  className="rounded-xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
            )}
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              className="rounded-full bg-[#10100f] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Please wait…"
                : authMethod === "magic-link"
                  ? "Email me a sign-in link"
                  : passwordAction === "sign-up"
                    ? "Create account"
                    : "Sign in"}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
