'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { simulateBalanceTransfer } from '@/modules/simulateBalanceTransfer'

const messages = [
  'Analyzing your debt structure...',
  'Running restructuring scenarios...',
  'Finding your best moves...',
]

export default function LoadingPage() {
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const raw = sessionStorage.getItem('moduleInput')
    if (!raw) {
      router.push('/dashboard/input')
      return
    }
    const moduleInput = JSON.parse(raw)
    const result = simulateBalanceTransfer(moduleInput)
    sessionStorage.setItem('balanceTransferResult', JSON.stringify(result))

    const intervals = messages.map((_, i) =>
      setTimeout(() => setMessageIndex(i), i * 1000)
    )

    const redirect = setTimeout(() => {
      router.push('/dashboard/results')
    }, messages.length * 1000 + 500)

    return () => {
      intervals.forEach(clearTimeout)
      clearTimeout(redirect)
    }
  }, [router])

  return (
    <main>
      <p>{messages[messageIndex]}</p>
    </main>
  )
}
