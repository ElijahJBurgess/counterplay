'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  COLOR_BACKGROUND,
  COLOR_SURFACE,
  COLOR_BORDER_DARK,
  COLOR_ACCENT,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY_ON_DARK,
  COLOR_TEXT_ON_DARK,
  COLOR_ERROR,
  RADIUS_MD,
  RADIUS_FULL,
  FONT_SIZE_SM,
  FONT_SIZE_3XL,
  SPACING_4,
  SPACING_6,
} from '@/styles/tokens'

export default function AuthPage() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email to confirm your account.')
      }
    }

    setLoading(false)
  }

  function toggleMode() {
    setError('')
    setMessage('')
    setMode(mode === 'signup' ? 'login' : 'signup')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: `1px solid ${COLOR_BORDER_DARK}`,
    borderRadius: RADIUS_MD,
    color: COLOR_TEXT_ON_DARK,
    fontSize: FONT_SIZE_SM,
    padding: '16px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        backgroundColor: COLOR_BACKGROUND,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top half — headline */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${SPACING_6}`,
        }}
      >
        <h1
          style={{
            color: COLOR_TEXT_PRIMARY,
            fontSize: FONT_SIZE_3XL,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: 0,
          textAlign: 'center',
          }}
        >
          The moves they
          <br />
          never taught you.
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: COLOR_ACCENT,
              marginLeft: '6px',
              verticalAlign: 'middle',
              position: 'relative',
              top: '-2px',
            }}
          />
        </h1>
      </div>

      {/* Bottom sheet */}
      <div
        style={{
          backgroundColor: COLOR_SURFACE,
          borderRadius: '16px 16px 0 0',
          padding: SPACING_6,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING_4,
        }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        {error && (
          <p style={{ color: COLOR_ERROR, fontSize: FONT_SIZE_SM, margin: 0 }}>
            {error}
          </p>
        )}
        {message && (
          <p style={{ color: COLOR_TEXT_SECONDARY_ON_DARK, fontSize: FONT_SIZE_SM, margin: 0 }}>
            {message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: COLOR_ACCENT,
            color: COLOR_TEXT_PRIMARY,
            fontWeight: 700,
            fontSize: FONT_SIZE_SM,
            borderRadius: RADIUS_FULL,
            padding: '16px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {mode === 'signup' ? 'Sign up' : 'Log in'}
        </button>

        <button
          onClick={toggleMode}
          style={{
            background: 'none',
            border: 'none',
            color: COLOR_TEXT_SECONDARY_ON_DARK,
            fontSize: FONT_SIZE_SM,
            cursor: 'pointer',
            textAlign: 'center',
            padding: `${SPACING_4} 0`,
          }}
        >
          {mode === 'signup'
            ? 'Already have an account? Log in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}
