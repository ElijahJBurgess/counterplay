'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StrategyObject, EmergencyOutput } from '@/modules/buildStrategy'
import {
  COLOR_BACKGROUND,
  COLOR_SURFACE,
  COLOR_SURFACE_LIGHT,
  COLOR_BORDER_DARK,
  COLOR_ACCENT,
  COLOR_ACCENT_MUTED,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_TERTIARY,
  COLOR_TEXT_ON_DARK,
  COLOR_TEXT_SECONDARY_ON_DARK,
  COLOR_WARNING,
  COLOR_WHITE_CARD_BG,
  RADIUS_MD,
  RADIUS_LG,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_BASE,
  FONT_SIZE_LG,
  FONT_SIZE_2XL,
  SPACING_3,
  SPACING_4,
  SPACING_5,
  SPACING_6,
} from '@/styles/tokens'

function isEmergencyOutput(result: StrategyObject | EmergencyOutput): result is EmergencyOutput {
  return (result as EmergencyOutput).move === 'None Available'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatMonths(months: number): string {
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (remainder === 0) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years}y ${remainder}m`
}

function splitExplanation(text: string): { first: string; rest: string } {
  const match = text.match(/^(.+?[.!?])\s*(.*)$/s)
  if (!match) return { first: text, rest: '' }
  return { first: match[1].trim(), rest: match[2].trim() }
}

function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      style={{
        height: '14px',
        width,
        backgroundColor: COLOR_SURFACE_LIGHT,
        borderRadius: '4px',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const [result, setResult] = useState<StrategyObject | EmergencyOutput | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)
  const [expandedMoves, setExpandedMoves] = useState<Set<number>>(new Set())

  useEffect(() => {
    const raw = sessionStorage.getItem('strategyResult')
    if (!raw) {
      router.push('/dashboard/input')
      return
    }
    const parsed: StrategyObject | EmergencyOutput = JSON.parse(raw)
    setResult(parsed)

    if (!isEmergencyOutput(parsed)) {
      setExplanationLoading(true)
      fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.explanation) setExplanation(data.explanation)
          else setExplanationError('Could not generate explanation')
        })
        .catch(() => setExplanationError('Could not generate explanation'))
        .finally(() => setExplanationLoading(false))
    }
  }, [router])

  function toggleMove(rank: number) {
    setExpandedMoves((prev) => {
      const next = new Set(prev)
      if (next.has(rank)) next.delete(rank)
      else next.add(rank)
      return next
    })
  }

  if (!result) return null

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${SPACING_5} ${SPACING_6}`, position: 'relative' }}>
      <button
        onClick={() => router.back()}
        style={{ position: 'absolute', left: SPACING_6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        aria-label="Go back"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke={COLOR_TEXT_PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, fontWeight: 700 }}>Your moves</span>
    </div>
  )

  // ── Emergency output ──────────────────────────────────────────────────────
  if (isEmergencyOutput(result)) {
    return (
      <div style={{ backgroundColor: COLOR_BACKGROUND, minHeight: '100dvh', paddingBottom: '40px' }}>
        <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
        <Header />
        <div style={{ padding: `0 ${SPACING_6}` }}>
          <div style={{ backgroundColor: COLOR_WHITE_CARD_BG, borderRadius: RADIUS_LG, padding: SPACING_6 }}>
            <p style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, lineHeight: 1.6, margin: `0 0 ${SPACING_4}` }}>
              {result.message}
            </p>
            {result.nextSteps.length > 0 && (
              <ul style={{ margin: `0 0 ${SPACING_4}`, padding: '0 0 0 20px' }}>
                {result.nextSteps.map((step, i) => (
                  <li key={i} style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_SM, lineHeight: 1.6, marginBottom: SPACING_3 }}>
                    {step}
                  </li>
                ))}
              </ul>
            )}
            {result.returnTrigger && (
              <p style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_SM, fontStyle: 'italic', margin: 0 }}>
                {result.returnTrigger}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Normal output ─────────────────────────────────────────────────────────
  const strategy = result
  const hasStats = strategy.totalInterestSavingsAvailable > 0
  const { first: openingLine, rest: breakdownText } = explanation
    ? splitExplanation(explanation)
    : { first: '', rest: '' }

  return (
    <div style={{ backgroundColor: COLOR_BACKGROUND, minHeight: '100dvh', paddingBottom: '40px' }}>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>

      {/* 1. Header */}
      <Header />

      <div style={{ padding: `0 ${SPACING_6}` }}>

        {/* 2. Stat card */}
        <div style={{ backgroundColor: COLOR_SURFACE, borderRadius: RADIUS_LG, padding: SPACING_6, marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING_4 }}>
            <div>
              <div style={{ color: COLOR_TEXT_SECONDARY_ON_DARK, fontSize: FONT_SIZE_SM, marginBottom: '6px' }}>Interest saved</div>
              <div style={{ color: COLOR_ACCENT, fontSize: FONT_SIZE_2XL, fontWeight: 700, lineHeight: 1 }}>
                {hasStats ? formatCurrency(strategy.totalInterestSavingsAvailable) : '--'}
              </div>
            </div>
            <div>
              <div style={{ color: COLOR_TEXT_SECONDARY_ON_DARK, fontSize: FONT_SIZE_SM, marginBottom: '6px' }}>Months saved</div>
              <div style={{ color: COLOR_TEXT_ON_DARK, fontSize: FONT_SIZE_2XL, fontWeight: 700, lineHeight: 1 }}>
                {hasStats && strategy.totalMonthsSavingsAvailable > 0
                  ? formatMonths(strategy.totalMonthsSavingsAvailable)
                  : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Opening line */}
        <div style={{ marginBottom: '24px' }}>
          {explanationLoading && <SkeletonLine width="80%" />}
          {!explanationLoading && openingLine && (
            <p style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, lineHeight: 1.6, margin: 0 }}>
              {openingLine}
            </p>
          )}
        </div>

        {/* 4. Move cards */}
        <div>
          <div style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_LG, fontWeight: 700, marginBottom: '12px' }}>
            Your moves
          </div>

          {strategy.rankedMoves.map((move) => {
            const expanded = expandedMoves.has(move.rank)
            return (
              <div
                key={move.rank}
                style={{
                  backgroundColor: COLOR_SURFACE,
                  border: `1px solid ${COLOR_BORDER_DARK}`,
                  borderRadius: RADIUS_MD,
                  marginBottom: '8px',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggleMove(move.rank)}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: SPACING_4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: COLOR_ACCENT, fontSize: FONT_SIZE_XS, fontWeight: 700, marginBottom: '4px' }}>
                      #{move.rank}
                    </div>
                    <div style={{ color: COLOR_TEXT_ON_DARK, fontSize: FONT_SIZE_BASE, fontWeight: 500, marginBottom: '4px' }}>
                      {move.move}
                    </div>
                    <div style={{ color: COLOR_TEXT_SECONDARY_ON_DARK, fontSize: FONT_SIZE_SM }}>
                      {move.keyMetric}
                    </div>
                  </div>
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    style={{
                      flexShrink: 0,
                      marginLeft: SPACING_3,
                      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <path d="M6 9l6 6 6-6" stroke={COLOR_TEXT_TERTIARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {expanded && (
                  <div style={{ borderTop: `1px solid ${COLOR_BORDER_DARK}`, padding: SPACING_4, paddingTop: SPACING_3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING_3 }}>
                      <span style={{ color: COLOR_TEXT_SECONDARY_ON_DARK, fontSize: FONT_SIZE_SM }}>Key metric</span>
                      <span style={{ color: COLOR_ACCENT, fontSize: FONT_SIZE_SM, fontWeight: 600 }}>{move.keyMetric}</span>
                    </div>

                    {move.sequenceNote && (
                      <div
                        style={{
                          borderLeft: `2px solid ${COLOR_ACCENT}`,
                          backgroundColor: COLOR_ACCENT_MUTED,
                          padding: SPACING_3,
                          borderRadius: '0 4px 4px 0',
                          marginBottom: SPACING_3,
                        }}
                      >
                        <span style={{ color: COLOR_ACCENT, fontSize: FONT_SIZE_SM }}>{move.sequenceNote}</span>
                      </div>
                    )}

                    {move.riskFlags.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {move.riskFlags.map((flag, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={COLOR_WARNING} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <line x1="12" y1="9" x2="12" y2="13" stroke={COLOR_WARNING} strokeWidth="2" strokeLinecap="round" />
                              <line x1="12" y1="17" x2="12.01" y2="17" stroke={COLOR_WARNING} strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span style={{ color: COLOR_TEXT_SECONDARY_ON_DARK, fontSize: FONT_SIZE_SM, lineHeight: 1.5 }}>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 5. Strategy breakdown card */}
        <div style={{ backgroundColor: COLOR_WHITE_CARD_BG, borderRadius: RADIUS_LG, padding: SPACING_6, marginTop: '12px' }}>
          <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_SM, fontWeight: 500, marginBottom: SPACING_3 }}>
            Full breakdown
          </div>
          {explanationLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SkeletonLine />
              <SkeletonLine width="85%" />
              <SkeletonLine width="70%" />
            </div>
          )}
          {explanationError && (
            <p style={{ color: COLOR_TEXT_TERTIARY, fontSize: FONT_SIZE_BASE, margin: 0 }}>Analysis unavailable</p>
          )}
          {breakdownText && (
            <p style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
              {breakdownText}
            </p>
          )}
        </div>

        {/* 6. Start here card */}
        <div style={{ backgroundColor: COLOR_WHITE_CARD_BG, borderRadius: RADIUS_LG, padding: SPACING_6, marginTop: '12px' }}>
          <div style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_LG, fontWeight: 700, marginBottom: SPACING_3 }}>
            Start here
          </div>
          <p style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_BASE, lineHeight: 1.6, margin: 0 }}>
            {strategy.recommendedFirstAction}
          </p>
        </div>

        {/* 7. Disclaimer */}
        <p style={{ color: COLOR_TEXT_TERTIARY, fontSize: FONT_SIZE_XS, textAlign: 'center', margin: '24px 0 40px', lineHeight: 1.6 }}>
          This is a simulation based on typical issuer behavior. Actual approval and limit depend on your full credit profile.
        </p>

      </div>
    </div>
  )
}
