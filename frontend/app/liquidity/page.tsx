import { LPPosition } from '@/components/LPPosition'
import { AddLiquidityForm } from '@/components/AddLiquidityForm'
import { HashKeyCheckout } from '@/components/HashKeyCheckout'
import { AutoInvestSetup } from '@/components/AutoInvestSetup'

export default function LiquidityPage() {
  return (
    <div className="max-w-6xl mx-auto py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Manage Liquidity</h1>
        <p className="text-lg text-zinc-400">Provide liquidity via direct Web3 deposits or HashKey PayFi Gateway.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Current Position */}
        <div className="lg:col-span-5 space-y-8">
          <LPPosition />
        </div>

        {/* Right Column: Actions */}
        <div className="lg:col-span-7 space-y-8">
          {/* PayFi Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HashKeyCheckout />
            <AutoInvestSetup />
          </div>

          <div className="relative py-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative bg-black px-4 text-sm text-zinc-500 uppercase tracking-widest font-semibold">
              Or use direct DeFi
            </div>
          </div>

          {/* Direct Deposit */}
          <AddLiquidityForm />
        </div>
      </div>
    </div>
  )
}
