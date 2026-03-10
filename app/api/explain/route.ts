import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const RISK_FLAG_MESSAGES: Record<string, string> = {
  'Utilization spike': 'This move will temporarily spike your credit utilization. Expect a 20–40 point score drop for 3–6 months.',
  'Tight payoff window': "You'd need to commit most of your free cash flow to clear this in the promo window. High execution risk.",
  'Balance too large for estimated limit': 'You may only be able to transfer a portion of this balance. Partial transfer still saves money.',
  'Low margin of safety': "You're cutting it close. One missed payment could land you at the revert APR (typically 24–29%).",
}

export async function POST(req: NextRequest) {
  try {
    const result = await req.json()

    const expandedResult = {
      ...result,
      riskFlags: result.riskFlags.map((flag: string) =>
        RISK_FLAG_MESSAGES[flag] || flag
      ),
    }

    const systemPrompt = `You are a sharp financial strategist explaining a move to someone who has never had a financial advisor. Be direct. Be specific. Use the exact numbers. No jargon. No hedging language. No "you should consider."

Frame it as: here's what's happening now, here's what changes if you make this move, here's what you need to do to execute it, here's the risk you need to know.

The tone is: smart friend who grew up knowing how money works and is finally telling you everything.

Keep it under 150 words.`

    const userMessage = `Here is the balance transfer analysis result for this user:

${JSON.stringify(expandedResult, null, 2)}

Explain this result to them in plain English. Use the exact numbers.`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    })

    const explanation = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return NextResponse.json({ explanation })
  } catch (error) {
    console.error('Claude API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    )
  }
}
