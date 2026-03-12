'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  COLOR_BACKGROUND,
  COLOR_BORDER,
  COLOR_ACCENT,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_TERTIARY,
  COLOR_WHITE_CARD_BG,
  COLOR_ERROR,
  RADIUS_MD,
  RADIUS_FULL,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_BASE,
  FONT_SIZE_LG,
  SPACING_3,
  SPACING_4,
  SPACING_5,
  SPACING_6,
} from '@/styles/tokens'

const CREDIT_SCORE_OPTIONS = ['580–619', '620–659', '660–699', '700–739', '740+']
const GOAL_OPTIONS = [
  'Get out of debt faster',
  'Lower my interest rate',
  'Improve my credit score',
  'Prepare for a big purchase',
]

type SheetField = 'creditScore' | 'goal' | null

export default function OnboardingPage() {
  const [creditScore, setCreditScore] = useState('')
  const [goal, setGoal] = useState('')
  const [activeSheet, setActiveSheet] = useState<SheetField>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const bothSelected = creditScore !== '' && goal !== ''

  function selectOption(field: SheetField, value: string) {
    if (field === 'creditScore') setCreditScore(value)
    if (field === 'goal') setGoal(value)
    setActiveSheet(null)
  }

  async function handleSubmit() {
    if (!bothSelected || loading) return
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      credit_score_range: creditScore,
      goal,
      onboarding_completed: true,
    })

    if (upsertError) {
      setError(upsertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/input')
  }

  const sheetOptions = activeSheet === 'creditScore' ? CREDIT_SCORE_OPTIONS : GOAL_OPTIONS
  const sheetSelected = activeSheet === 'creditScore' ? creditScore : goal

  return (
    <div
      style={{
        backgroundColor: COLOR_BACKGROUND,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACING_5} ${SPACING_6}`,
          position: 'relative',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            position: 'absolute',
            left: SPACING_6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: COLOR_TEXT_PRIMARY,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Go back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke={COLOR_TEXT_PRIMARY}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span
          style={{
            color: COLOR_TEXT_PRIMARY,
            fontSize: FONT_SIZE_BASE,
            fontWeight: 700,
          }}
        >
          Your situation
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: `${SPACING_4} ${SPACING_6}`, paddingBottom: '100px' }}>
        {/* Subheading */}
        <p
          style={{
            color: COLOR_TEXT_SECONDARY,
            fontSize: FONT_SIZE_SM,
            margin: `0 0 ${SPACING_6}`,
            lineHeight: 1.5,
          }}
        >
          This takes 60 seconds. We&apos;ll find what applies to you.
        </p>

        {/* Credit score row */}
        <button
          onClick={() => setActiveSheet('creditScore')}
          style={{
            width: '100%',
            backgroundColor: COLOR_WHITE_CARD_BG,
            border: `1px solid ${COLOR_BORDER}`,
            borderRadius: RADIUS_MD,
            padding: SPACING_4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: SPACING_3,
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_XS, marginBottom: '4px' }}>
              Credit score range
            </div>
            <div
              style={{
                color: creditScore ? COLOR_TEXT_PRIMARY : COLOR_TEXT_TERTIARY,
                fontSize: FONT_SIZE_BASE,
                fontWeight: creditScore ? 500 : 400,
              }}
            >
              {creditScore || 'Select range'}
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18l6-6-6-6"
              stroke={COLOR_TEXT_TERTIARY}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Goal row */}
        <button
          onClick={() => setActiveSheet('goal')}
          style={{
            width: '100%',
            backgroundColor: COLOR_WHITE_CARD_BG,
            border: `1px solid ${COLOR_BORDER}`,
            borderRadius: RADIUS_MD,
            padding: SPACING_4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_XS, marginBottom: '4px' }}>
              Primary goal
            </div>
            <div
              style={{
                color: goal ? COLOR_TEXT_PRIMARY : COLOR_TEXT_TERTIARY,
                fontSize: FONT_SIZE_BASE,
                fontWeight: goal ? 500 : 400,
              }}
            >
              {goal || 'Select goal'}
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18l6-6-6-6"
              stroke={COLOR_TEXT_TERTIARY}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {error && (
          <p style={{ color: COLOR_ERROR, fontSize: FONT_SIZE_SM, marginTop: SPACING_4 }}>
            {error}
          </p>
        )}
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: SPACING_6,
          backgroundColor: COLOR_BACKGROUND,
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={!bothSelected || loading}
          style={{
            width: '100%',
            backgroundColor: COLOR_ACCENT,
            color: COLOR_TEXT_PRIMARY,
            fontWeight: 700,
            fontSize: FONT_SIZE_BASE,
            borderRadius: RADIUS_FULL,
            padding: SPACING_4,
            border: 'none',
            cursor: bothSelected && !loading ? 'pointer' : 'not-allowed',
            opacity: bothSelected ? (loading ? 0.7 : 1) : 0.35,
            transition: 'opacity 0.2s',
          }}
        >
          Find my moves
        </button>
      </div>

      {/* Overlay */}
      {activeSheet && (
        <div
          onClick={() => setActiveSheet(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        />
      )}

      {/* Bottom sheet */}
      {activeSheet && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: COLOR_WHITE_CARD_BG,
            borderRadius: '16px 16px 0 0',
            padding: SPACING_6,
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              backgroundColor: COLOR_BORDER,
              borderRadius: RADIUS_FULL,
              margin: `0 auto ${SPACING_5}`,
            }}
          />
          {sheetOptions.map((option) => {
            const isSelected = sheetSelected === option
            return (
              <button
                key={option}
                onClick={() => selectOption(activeSheet, option)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${COLOR_BORDER}`,
                  padding: `${SPACING_4} 0`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    color: COLOR_TEXT_PRIMARY,
                    fontSize: FONT_SIZE_LG,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {option}
                </span>
                {isSelected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke={COLOR_ACCENT}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
