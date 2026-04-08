import { SwapForm } from '@/components/SwapForm'

export default function SwapPage() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Swap Assets</h1>
        <p className="text-lg text-zinc-400">Trade directly with the institutional-grade RWA pool.</p>
      </div>

      <SwapForm />
    </div>
  )
}
