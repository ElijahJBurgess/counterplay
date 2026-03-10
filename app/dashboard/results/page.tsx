'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BalanceTransferResult } from '@/modules/simulateBalanceTransfer'

const CARD_NAMES: Record<string, string> = {
  chase_freedom: 'Chase Freedom Unlimited',
  citi_diamond: 'Citi Diamond Preferred',
  wells_fargo_reflect: 'Wells Fargo Reflect',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ResultsPage() {
  const router = useRouter()
  const [result, setResult] = useState<BalanceTransferResult | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('balanceTransferResult')
    if (!raw) {
      router.push('/dashboard/input')
      return
    }
    const parsed: BalanceTransferResult = JSON.parse(raw)
    setResult(parsed)

    if (parsed.eligible) {
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

  if (!result) return null

  if (!result.eligible) {
    return (
      <div>
        <h1>No move available right now</h1>
        <p>{result.reason}</p>
        <button onClick={() => router.push('/dashboard/input')}>Try different numbers</button>
      </div>
    )
  }

  return (
    <div>
      {/* Section 1 — Headline numbers */}
      <div>
        <h1>Balance Transfer</h1>
        {result.borderline && <p>Borderline — High denial risk</p>}
        <p>Current interest cost: {formatCurrency(result.currentInterestCost)}</p>
        <p>You could save {formatCurrency(result.netInterestSaved)}</p>
        <p>Pay off {result.monthsSaved} months faster</p>
        <p>Required monthly payment: {formatCurrency(result.requiredMonthlyPayment)}</p>
        <p>
          {result.clearedInPromoWindow
            ? '✓ Clears within promo window'
            : '✗ Does not clear within promo window'}
        </p>
      </div>

      {/* Explanation section */}
      {explanationLoading && <p>Generating your personalized strategy...</p>}
      {explanationError && <p>{explanationError}</p>}
      {explanation && (
        <div>
          <h2>Your move</h2>
          <p>{explanation}</p>
        </div>
      )}
      <p>This is a simulation based on typical issuer behavior. Actual approval and limit depend on your full credit profile.</p>

      {/* Section 2 — Conservative scenario */}
      <div>
        <h2>Conservative estimate (15-month window)</h2>
        <p>Clears in 15 months: {result.conservativeScenario.clearedInWindow ? 'Yes' : 'No'}</p>
        <p>Required monthly: {formatCurrency(result.conservativeScenario.requiredMonthlyToClean)}</p>
      </div>

      {/* Section 3 — Risk flags */}
      {result.riskFlags.length > 0 && (
        <div>
          <h2>Risks to know</h2>
          <ul>
            {result.riskFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 4 — Recommended cards */}
      {result.recommendedCards.length > 0 && (
        <div>
          <h2>Cards to apply for</h2>
          <ul>
            {result.recommendedCards.map((card) => (
              <li key={card}>{CARD_NAMES[card] ?? card}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 5 — Impact score */}
      <div>
        <p>Impact score: {Math.round(result.impactScore)} / 100</p>
      </div>

      {/* Section 6 — Actions */}
      <div>
        <button onClick={() => router.push('/dashboard/input')}>Run a new analysis</button>
        <button onClick={() => router.push('/dashboard')}>Back to dashboard</button>
      </div>
    </div>
  )
}
