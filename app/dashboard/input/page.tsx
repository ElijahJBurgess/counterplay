'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CreditScoreRange } from '@/types'

interface DebtRow {
  id: string
  type: 'credit_card' | 'personal_loan' | 'auto'
  balance: string
  apr: string
  minPayment: string
}

export default function InputPage() {
  const [creditScoreRange, setCreditScoreRange] = useState<CreditScoreRange | null>(null)
  const [debts, setDebts] = useState<DebtRow[]>([
    { id: crypto.randomUUID(), type: 'credit_card', balance: '', apr: '', minPayment: '' },
  ])
  const [monthlyFreeCashFlow, setMonthlyFreeCashFlow] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_score_range')
        .eq('id', session.user.id)
        .single()
      if (profile?.credit_score_range) {
        setCreditScoreRange(profile.credit_score_range as CreditScoreRange)
      }
    }
    loadProfile()
  }, [router])

  function updateDebt(id: string, field: keyof Omit<DebtRow, 'id'>, value: string) {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
  }

  function addDebt() {
    if (debts.length >= 5) return
    setDebts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'credit_card', balance: '', apr: '', minPayment: '' },
    ])
  }

  function removeDebt(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id))
  }

  function isSubmitDisabled() {
    if (!monthlyFreeCashFlow) return true
    return debts.some((d) => !d.balance || !d.apr || !d.minPayment)
  }

  function handleSubmit() {
    setError(null)

    for (const d of debts) {
      const balance = parseFloat(d.balance)
      const apr = parseFloat(d.apr)
      const minPayment = parseFloat(d.minPayment)

      if (isNaN(balance) || balance <= 0) {
        setError('All balances must be greater than 0.')
        return
      }
      if (isNaN(apr) || apr < 0.1 || apr > 100) {
        setError('APR must be between 0.1 and 100.')
        return
      }
      if (isNaN(minPayment) || minPayment <= 0) {
        setError('All minimum payments must be greater than 0.')
        return
      }
    }

    const cashFlow = parseFloat(monthlyFreeCashFlow)
    if (isNaN(cashFlow) || cashFlow <= 0) {
      setError('Monthly free cash flow must be greater than 0.')
      return
    }

    if (!creditScoreRange) {
      setError('Could not load your credit score range. Please try again.')
      return
    }

    setIsLoading(true)

    const moduleInput = {
      creditScoreRange,
      debts: debts.map((d) => ({
        type: d.type,
        balance: parseFloat(d.balance),
        apr: parseFloat(d.apr),
        minPayment: parseFloat(d.minPayment),
      })),
      monthlyFreeCashFlow: cashFlow,
    }

    sessionStorage.setItem('moduleInput', JSON.stringify(moduleInput))
    router.push('/dashboard/loading')
  }

  return (
    <div>
      <h1>Enter your debts</h1>
      <p>We&apos;ll find the moves that save you the most money</p>

      {debts.map((debt) => (
        <div key={debt.id}>
          <select
            value={debt.type}
            onChange={(e) =>
              updateDebt(debt.id, 'type', e.target.value as DebtRow['type'])
            }
          >
            <option value="credit_card">Credit Card</option>
            <option value="personal_loan">Personal Loan</option>
            <option value="auto">Auto Loan</option>
          </select>

          <input
            type="number"
            placeholder="Balance ($)"
            value={debt.balance}
            onChange={(e) => updateDebt(debt.id, 'balance', e.target.value)}
          />

          <input
            type="number"
            placeholder="APR (%)"
            value={debt.apr}
            onChange={(e) => updateDebt(debt.id, 'apr', e.target.value)}
          />

          <input
            type="number"
            placeholder="Min Payment ($)"
            value={debt.minPayment}
            onChange={(e) => updateDebt(debt.id, 'minPayment', e.target.value)}
          />

          {debts.length > 1 && (
            <button onClick={() => removeDebt(debt.id)}>Remove</button>
          )}
        </div>
      ))}

      {debts.length < 5 && (
        <button onClick={addDebt}>+ Add another debt</button>
      )}

      <div>
        <label>Monthly free cash flow</label>
        <p>What&apos;s left after all bills are paid — not your full income</p>
        <input
          type="number"
          placeholder="Monthly free cash flow ($)"
          value={monthlyFreeCashFlow}
          onChange={(e) => setMonthlyFreeCashFlow(e.target.value)}
        />
      </div>

      {error && <p>{error}</p>}

      <button onClick={handleSubmit} disabled={isSubmitDisabled() || isLoading}>
        Find my moves
      </button>
    </div>
  )
}
