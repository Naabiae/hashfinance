import { createConfig, http } from 'wagmi'
import { hashkeyTestnet } from 'viem/chains'
import { getDefaultConfig } from 'connectkit'

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [hashkeyTestnet],
    transports: {
      [hashkeyTestnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://hk-testnet.rpc.alt.technology'),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo',
    appName: 'RWA Liquidity Hub',
    appDescription: 'Institutional-grade RWA liquidity and swap protocol',
    appUrl: 'https://rwa-hub.com',
  })
)
