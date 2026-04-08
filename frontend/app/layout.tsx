import './globals.css'
import { Providers } from './Providers'
import { KYCBanner } from '@/components/KYCBanner'
import { Header } from '@/components/Header'

export const metadata = {
  title: 'RWA Liquidity Hub',
  description: 'Institutional-grade RWA liquidity and swap protocol',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-slate-100 antialiased min-h-screen font-sans selection:bg-blue-500/30">
        <Providers>
          <div className="flex flex-col min-h-screen">
            <KYCBanner />
            <Header />
            
            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-8">
              {children}
            </main>
            
            {/* Footer */}
            <footer className="border-t border-white/10 py-6 mt-12 text-center text-sm text-slate-500">
              <p>RWA Liquidity Hub © {new Date().getFullYear()} — HashKey Chain Horizon Hackathon</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
