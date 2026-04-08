'use client'

import { usePoolState } from '@/hooks/usePoolState'
import { Coins, HandCoins, ActivitySquare, Percent } from 'lucide-react'

export function PoolStats() {
  const { data: state, isLoading } = usePoolState()

  if (isLoading || !state) return <div className="animate-pulse h-32 bg-zinc-900/50 rounded-2xl w-full border border-white/5"></div>

  const metrics = [
    {
      title: "RWA Reserve",
      value: state.rwaReserve,
      icon: Coins,
      suffix: " RWA"
    },
    {
      title: "USDC Reserve",
      value: `$${Number(state.usdcReserve).toLocaleString()}`,
      icon: HandCoins,
      suffix: ""
    },
    {
      title: "Spread & Fee",
      value: `${state.spreadBps} / ${state.feeBps}`,
      icon: Percent,
      suffix: " bps"
    },
    {
      title: "Accumulated Fees",
      value: `$${Number(state.accumulatedFees).toLocaleString()}`,
      icon: ActivitySquare,
      suffix: " USDC"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div key={i} className="p-5 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors group">
          <div className="flex items-center space-x-2 text-zinc-400 mb-3">
            <m.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{m.title}</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <h3 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">{m.value}</h3>
            <span className="text-sm text-zinc-500 font-medium">{m.suffix}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
