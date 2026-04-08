'use client'

import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2 font-bold text-xl tracking-tight text-white hover:text-blue-400 transition-colors">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            <span>RWA Hub</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-300">
            <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/swap" className="hover:text-white transition-colors">Swap</Link>
            <Link href="/liquidity" className="hover:text-white transition-colors">Liquidity</Link>
            <Link href="/history" className="hover:text-white transition-colors">History</Link>
          </nav>
        </div>
        <div className="flex items-center">
          <ConnectKitButton theme="retro" />
        </div>
      </div>
    </header>
  )
}
