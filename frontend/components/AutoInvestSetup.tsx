'use client'

import { useState } from 'react'
import { RefreshCcw, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'

export function AutoInvestSetup() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const { address } = useAccount()

  const handleSubscribe = async () => {
    if (!amount || !address) return
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/payfi/reusable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, userAddress: address })
      })
      const data = await res.json()
      if (data.payment_url) {
        window.location.href = data.payment_url
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-zinc-950 to-emerald-950/20 border border-emerald-500/20 rounded-3xl p-6 shadow-2xl">
      <div className="mb-6 flex items-center space-x-3">
        <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
          <RefreshCcw className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Auto-Invest DCA</h2>
          <p className="text-sm text-emerald-200/60">Subscribe to a weekly reusable mandate</p>
        </div>
      </div>

      <div className="bg-zinc-900/80 rounded-2xl p-4 border border-white/5 focus-within:border-emerald-500/50 transition-colors mb-6">
        <label className="block text-sm font-medium text-zinc-500 mb-2">Weekly Deposit (USDC equivalent)</label>
        <div className="flex items-center justify-between">
          <span className="text-3xl text-zinc-500 mr-2">$</span>
          <input 
            type="number" 
            placeholder="0.00" 
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-transparent text-3xl font-bold text-white w-full outline-none placeholder:text-zinc-700"
          />
        </div>
      </div>

      <button 
        onClick={handleSubscribe}
        disabled={loading || !amount || !address}
        className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        Setup Mandate
      </button>
    </div>
  )
}
