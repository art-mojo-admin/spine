import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, signUp } from '@/lib/auth'
import { APP_NAME } from '@/lib/config'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const navigate = useNavigate()

  useEffect(() => {
    if (inviteToken) setIsSignUp(true)
  }, [inviteToken])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await signUp(email, password)
        if (signUpError) {
          setError(signUpError.message)
          return
        }

        let session = signUpData.session || null

        if (!session) {
          const { data: signInData, error: signInError } = await signIn(email, password)
          if (signInError || !signInData.session) {
            setError(signInError?.message || 'Check your email to confirm the signup before continuing.')
            return
          }
          session = signInData.session
        }

        try {
          const token = session?.access_token || null
          await apiPost('provision-user', inviteToken ? { invite_token: inviteToken } : {}, { tokenOverride: token })
        } catch (provErr: any) {
          if (!provErr.message?.includes('already_provisioned')) {
            console.warn('Provisioning note:', provErr.message)
          }
        }
      } else {
        const { data: signInData, error: signInError } = await signIn(email, password)
        if (signInError) {
          setError(signInError.message)
          return
        }

        try {
          const token = signInData.session?.access_token || null
          if (token) {
            await apiPost('provision-user', inviteToken ? { invite_token: inviteToken } : {}, { tokenOverride: token })
          }
        } catch (provErr: any) {
          if (!provErr.message?.includes('already_provisioned')) {
            console.warn('Provisioning note:', provErr.message)
          }
        }
      }

      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
          <CardDescription>
            {inviteToken
              ? 'Create your account to accept the invitation'
              : isSignUp ? 'Create your account' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
