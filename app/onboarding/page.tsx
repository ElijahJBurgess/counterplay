'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOALS = [
  'Pay off debt faster',
  'Lower my monthly payments',
  'Improve my credit score',
  'Build a financial plan',
]

const DEBT_TYPES = [
  'Credit cards',
  'Personal loan',
  'Auto loan',
  'Multiple types',
]

const CREDIT_SCORE_RANGES = ['580-619', '620-659', '660-699', '700-739', '740+']

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [goal, setGoal] = useState('')
  const [debtTypes, setDebtTypes] = useState<string[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  function handleGoalSelect(selected: string) {
    setGoal(selected)
    setStep(2)
  }

  function toggleDebtType(type: string) {
    setDebtTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  async function handleCreditScoreSelect(range: string) {
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Not authenticated')
      return
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      goal,
      debt_types: debtTypes,
      credit_score_range: range,
      onboarding_completed: true,
    })

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div>
      {step === 1 && (
        <div>
          <h1>What&apos;s your main goal?</h1>
          {GOALS.map((g) => (
            <button key={g} onClick={() => handleGoalSelect(g)}>
              {g}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          <h1>What types of debt do you have?</h1>
          {DEBT_TYPES.map((type) => (
            <button key={type} onClick={() => toggleDebtType(type)}>
              {debtTypes.includes(type) ? '[x] ' : '[ ] '}{type}
            </button>
          ))}
          <button onClick={() => setStep(3)}>Continue</button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1>What&apos;s your approximate credit score?</h1>
          {CREDIT_SCORE_RANGES.map((range) => (
            <button key={range} onClick={() => handleCreditScoreSelect(range)}>
              {range}
            </button>
          ))}
          {error && <p>{error}</p>}
        </div>
      )}
    </div>
  )
}
