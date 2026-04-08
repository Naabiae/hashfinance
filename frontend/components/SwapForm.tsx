'use client'

import { useState } from 'react'
import { ArrowDownUp, AlertTriangle } from 'lucide-react'
import { useKYCStatus } from '@/hooks/useKYCStatus'
import { KYCGate } from './KYCGate'

export function SwapForm() {
  const [amountIn, setAmountIn] = useState('')
  const [direction, setDirection] = useState<'usdc-to-rwa' | 'rwa-to-usdc'>('usdc-to-rwa')
  const { status, isLoading } = useKYCStatus()
  
  const isLargeSwap = Number(amountIn) > 10000

  // Mock calculation
  const oraclePrice = 100.05
  const feeBps = 10
  const spreadBps = 30
  
  const rawOut = direction === 'usdc-to-rwa' ? Number(amountIn) / oraclePrice : Number(amountIn) * oraclePrice
  const outAfterFee = rawOut * (1 - (feeBps + spreadBps) / 10000)
  
  return (
    <div className="relative">
      {!isLoading && status && (
        <KYCGate requiredLevel={1} currentLevel={status.level} kycPortalUrl={status.kycPortalUrl} />
      )}
      
      <div className={`bg-zinc-950 border border-white/5 rounded-3xl p-6 shadow-2xl transition-opacity ${(!isLoading && status && status.level < 1) ? 'opacity-20 pointer-events-none' : ''}`}>
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-2">Swap Tokens</h2>
          <p className="text-sm text-zinc-400">Trade USDC and RWA bond tokens directly against the pool.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
            <label className="block text-sm font-medium text-zinc-500 mb-2">You Pay</label>
            <div className="flex items-center justify-between">
              <input 
                type="number" 
                placeholder="0.0" 
                className="bg-transparent text-4xl font-bold text-white w-full outline-none placeholder:text-zinc-700"
                value={amountIn}
                onChange={e => setAmountIn(e.target.value)}
              />
              <div className="flex items-center space-x-2 bg-zinc-800 px-4 py-2 rounded-xl ml-4">
                <span className="font-bold text-white">{direction === 'usdc-to-rwa' ? 'USDC' : 'RWA'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-6 relative z-10">
            <button 
              onClick={() => setDirection(d => d === 'usdc-to-rwa' ? 'rwa-to-usdc' : 'usdc-to-rwa')}
              className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full border-4 border-zinc-950 transition-colors"
            >
              <ArrowDownUp className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 border border-white/5 opacity-80">
            <label className="block text-sm font-medium text-zinc-500 mb-2">You Receive (Estimated)</label>
            <div className="flex items-center justify-between">
              <input 
                type="text" 
                readOnly
                value={amountIn ? outAfterFee.toFixed(4) : ''}
                placeholder="0.0" 
                className="bg-transparent text-4xl font-bold text-white w-full outline-none placeholder:text-zinc-700"
              />
              <div className="flex items-center space-x-2 bg-zinc-800 px-4 py-2 rounded-xl ml-4">
                <span className="font-bold text-white">{direction === 'usdc-to-rwa' ? 'RWA' : 'USDC'}</span>
              </div>
            </div>
          </div>
        </div>

        {amountIn && (
          <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Oracle Price</span>
              <span className="text-zinc-300 font-mono">${oraclePrice}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Spread & Fee</span>
              <span className="text-zinc-300 font-mono">{spreadBps + feeBps} bps</span>
            </div>
            {isLargeSwap && (
              <div className="flex items-start mt-4 pt-4 border-t border-white/5 text-amber-400/90">
                <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />
                <span>This trade exceeds 10,000 USDC. It will be routed through the <strong>TradeGuard</strong> commit-reveal flow to prevent front-running.</span>
              </div>
            )}
          </div>
        )}

        <button 
          className="w-full mt-8 py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-blue-500/20"
        >
          {isLargeSwap ? 'Commit Large Swap' : 'Execute Swap'}
        </button>
      </div>
    </div>
  )
}
