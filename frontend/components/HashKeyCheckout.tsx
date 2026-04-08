'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'

export function HashKeyCheckout() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const { address } = useAccount()

  const handleCheckout = async () => {
    if (!amount || !address) return
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/payfi/checkout`, {
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
    <div className="bg-gradient-to-br from-zinc-950 to-blue-950/20 border border-blue-500/20 rounded-3xl p-6 shadow-2xl">
      <div className="mb-6 flex items-center space-x-3">
        <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
          <CreditCard className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Institutional Checkout</h2>
          <p className="text-sm text-blue-200/60">Fiat/Crypto single-sided deposit via HashKey</p>
        </div>
      </div>

      <div className="bg-zinc-900/80 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors mb-6">
        <label className="block text-sm font-medium text-zinc-500 mb-2">Deposit Amount (USDC equivalent)</label>
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
        onClick={handleCheckout}
        disabled={loading || !amount || !address}
        className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        Checkout with HashKey
      </button>
    </div>
  )
}
