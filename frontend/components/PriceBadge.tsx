'use client'

import { Clock, Activity } from 'lucide-react'

export function PriceBadge({ price, timestamp, maxStaleness = 86400 }: { price: string, timestamp: number, maxStaleness?: number }) {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  
  const isFresh = diff < maxStaleness * 0.8
  const isWarning = diff >= maxStaleness * 0.8 && diff <= maxStaleness
  const isStale = diff > maxStaleness
  
  const minutesAgo = Math.floor(diff / 60)

  return (
    <div className="flex items-center justify-between p-6 rounded-2xl bg-zinc-900 border border-white/10">
      <div>
        <p className="text-sm text-zinc-400 font-medium mb-1 flex items-center">
          <Activity className="w-4 h-4 mr-2" />
          RWA Oracle Price
        </p>
        <h2 className="text-4xl font-bold tracking-tight">${price}</h2>
      </div>
      <div className="flex flex-col items-end space-y-2">
        {isFresh && <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full uppercase tracking-wider border border-emerald-500/20">Live</span>}
        {isWarning && <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-full uppercase tracking-wider border border-amber-500/20">Warning</span>}
        {isStale && <span className="px-3 py-1 bg-rose-500/10 text-rose-400 text-xs font-semibold rounded-full uppercase tracking-wider border border-rose-500/20">Circuit Breaker Risk</span>}
        
        <p className="text-xs text-zinc-500 flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          Updated {minutesAgo} min ago
        </p>
      </div>
    </div>
  )
}
