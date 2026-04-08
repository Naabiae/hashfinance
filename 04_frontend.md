# Module 4 — Frontend

**Project:** RWA Liquidity Hub — HashKey Chain Horizon Hackathon
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · wagmi v2 · viem v2 · shadcn/ui
**Network:** HashKey Chain Testnet (chainId 133)

---

## Overview

### What we are building

A single-page dApp with four views:

1. **Pool Dashboard** — live pool state, oracle price, reserves, accumulated fees, chart of price history
2. **Swap** — swap USDC ↔ RWA token with real-time price preview, KYC gate, TradeGuard commitment flow for large swaps
3. **Liquidity** — add/remove LP positions, see your share value, pending yield, claim or await batch distribution
4. **History** — your personal swap and payment history with HSP receipt IDs

### Why this stack

- **Next.js 14 App Router** — server components for fast initial load, client components for wallet interactions
- **wagmi v2 + viem v2** — the current standard for React wallet integration; wagmi handles connection state, viem handles low-level contract calls
- **Tailwind + shadcn/ui** — fast component building without custom CSS from scratch
- **HashKey Chain config** — wagmi has `hashkeyTestnet` built into viem chains already

### The KYC UX story

The most important UX decision: compliance must feel native, not punitive. When a user connects a wallet with no KYC, the app doesn't just say "access denied." It explains what level is needed, why, and provides a direct link to the HashKey KYC portal. This is the differentiator during the demo — judges from institutional backgrounds will appreciate seeing compliance treated as UX.

---

## Page 1 — Pool Dashboard

### What it shows

- Current oracle price for the RWA token (with last update time and "LIVE" / "STALE" badge)
- Pool reserves: how much RWA and how much USDC is in the pool
- Spread and fee in basis points
- Accumulated yield awaiting distribution
- Price chart: 7-day NAV history pulled from `/api/pool/price-history`
- Recent swaps table: last 10 swaps from `/api/pool/swaps`
- "Distribute Yield" button (permissionless — anyone can trigger)

### Why each element matters for the demo

The oracle price with staleness badge directly demonstrates the circuit breaker mechanic — judges can see in real time whether the price is fresh. The accumulated fees counter ticking up after each swap shows the yield mechanics working. The price chart shows the RWA bond following a realistic NAV path, not a crypto-style volatile chart.

### Components to build

**`components/PriceBadge.tsx`**
- Props: `price: string, timestamp: number, maxStaleness: number`
- Shows price in USD format
- Shows time since last update: "Updated 2 minutes ago"
- Green badge if `(now - timestamp) < maxStaleness * 0.8`
- Yellow badge if `> 0.8 * maxStaleness`
- Red badge + "CIRCUIT BREAKER RISK" if `> maxStaleness`

**`components/PoolStats.tsx`**
- Props: `state: PoolState` (from `/api/pool/state`)
- Grid of 4 metric cards: RWA Reserve, USDC Reserve, Spread (bps), Accumulated Fees
- Refreshes every 15 seconds via `setInterval` + `fetch`

**`components/PriceChart.tsx`**
- Uses recharts `LineChart`
- Data from `/api/pool/price-history?token=0x...&from=7daysago`
- X axis: timestamps formatted as "Apr 8, 14:00"
- Y axis: USD price
- Tooltip shows exact price and timestamp on hover
- Horizontal reference line at current price

**`components/RecentSwaps.tsx`**
- Table with columns: Time | User | Direction | Amount In | Amount Out | Price
- Direction shown as badge: "Buy RWA" (green) or "Sell RWA" (red)
- Truncated addresses with copy-to-clipboard
- Links to Blockscout explorer for each tx

**`components/DistributeYieldButton.tsx`**
- Calls `pool.distributeYield()` on click
- Shows accumulated fees amount
- Disabled if fees == 0
- Shows loading state during tx
- Shows success state with "Yield distributed to N LPs"

### State management

Use React Query (`@tanstack/react-query`) for server state:

```
useQuery({
  queryKey: ['poolState'],
  queryFn: () => fetch('/api/pool/state').then(r => r.json()),
  refetchInterval: 15_000
})
```

Contract writes use wagmi `useWriteContract`:

```
const { writeContract, isPending, isSuccess } = useWriteContract()
```

---

## Page 2 — Swap

### What it shows

- Token selector: USDC → RWA or RWA → USDC
- Amount input
- Real-time preview: how much you get out at current oracle price, minus spread and fee
- "Effective price" shown (oracle price ± spread)
- KYC status check on wallet connect — if not verified, show gate UI
- For large swaps (> 10,000 USDC): automatic TradeGuard commitment flow
- For small swaps: direct execution

### The KYC gate UI

When a user connects with no KYC or insufficient KYC:

```
┌────────────────────────────────────────────────────┐
│  🔒 KYC Verification Required                      │
│                                                    │
│  To swap tokens, you need Basic KYC verification.  │
│  To provide liquidity, you need Advanced KYC.      │
│                                                    │
│  Your current level: None                          │
│                                                    │
│  [Complete KYC on HashKey Portal →]                │
│                                                    │
│  Already verified? [Refresh status]                │
└────────────────────────────────────────────────────┘
```

This is NOT a blocking modal — the rest of the page is still visible so users can explore the pool. The swap form is disabled with the gate shown inline.

### The TradeGuard flow for large swaps

When swap amount > 10,000 USDC, a two-step UI appears:

**Step 1 — Commit:**
```
┌────────────────────────────────────────────────────┐
│  ⚠ Large Trade — Commitment Required               │
│                                                    │
│  Trades above 10,000 USDC use a 2-step process     │
│  for institutional-grade execution safety.         │
│                                                    │
│  Step 1: Commit your trade (stores a hash)         │
│  Step 2: Execute after ~4 seconds (2 blocks)       │
│  Cancel anytime before execution                   │
│                                                    │
│  [Commit Trade]                                    │
└────────────────────────────────────────────────────┘
```

**Step 2 — Execute (after DELAY_BLOCKS):**
```
┌────────────────────────────────────────────────────┐
│  ✓ Trade Committed — Ready to Execute              │
│                                                    │
│  Your trade commitment is confirmed.               │
│  Block committed: 1,234,567                        │
│  Earliest execution: Block 1,234,569               │
│  Expires: Block 1,234,617                          │
│                                                    │
│  [Execute Trade]    [Cancel Trade]                 │
└────────────────────────────────────────────────────┘
```

### Components to build

**`components/SwapForm.tsx`**
- Token pair selector (USDC/RWA)
- Amount input with USD value display
- Output preview: call `/api/user/estimate-swap?tokenIn=...&amountIn=...` on input change (debounced 500ms)
- Shows: Amount Out, Effective Price, Fee, Spread Cost
- Execute button: disabled if no KYC, shows appropriate message

**`components/KYCGate.tsx`**
- Props: `requiredLevel: number, currentLevel: number, kycPortalUrl: string`
- Shows lock icon, explanation, CTA to portal
- "Refresh status" button re-fetches `/api/kyc/check?address=...`

**`components/TradeGuardFlow.tsx`**
- Step indicator: Commit → Wait → Execute
- Handles both `commitSwap` and `executeSwap` contract calls
- Shows block countdown: "Execute available in X blocks"
- Polls current block number every 2 seconds while waiting
- Cancel button calls `cancelSwap`

**`hooks/useSwap.ts`** — custom hook
- Encapsulates all swap logic
- Returns: `{ estimatedOut, fee, isLargeSwap, commit, execute, cancel, status }`
- Handles both direct swap path and TradeGuard path

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `swap_estimate_displays` | Type 1000 in amount input | Estimated output appears after debounce |
| `kyc_gate_shown_unverified` | Connect wallet with level 0 | KYCGate renders, swap button disabled |
| `kyc_gate_hidden_verified` | Connect wallet with level 1 | Gate not shown, swap button enabled |
| `tradeguard_triggers_large` | Enter 15000 in amount | TradeGuardFlow renders |
| `tradeguard_hidden_small` | Enter 100 in amount | Direct swap button shown |
| `swap_preview_updates` | Change amount | Estimate re-fetches and updates |

---

## Page 3 — Liquidity

### What it shows

- User's current LP position: share count, USD value, percentage of pool
- Pending yield: how much USDC is owed since last distribution
- "Add Liquidity" form: input RWA and USDC amounts, preview shares to receive
- "Remove Liquidity" slider: choose what % of position to remove
- "Claim Yield" button: triggers single HSP payment to user
- Distribution history: past yield payments with receipt IDs

### Components to build

**`components/LPPosition.tsx`**
- Props: `address: string`
- Fetches from `/api/user/position?address=...`
- Shows: Shares Owned, Share Value (USDC), Pool Ownership %, Pending Yield
- Pending yield updates every 30 seconds

**`components/AddLiquidityForm.tsx`**
- Two inputs: RWA amount and USDC amount
- Preview: shares to receive (computed from oracle price)
- Requires ADVANCED KYC (level 2) — shows KYCGate if insufficient
- Submit calls `pool.addLiquidity(rwaAmount, stableAmount)` via wagmi

**`components/RemoveLiquiditySlider.tsx`**
- Percentage slider: 0–100%
- Shows preview: how much RWA and USDC you get back
- Submit calls `pool.removeLiquidity(shares * percentage / 100)`

**`components/ClaimYield.tsx`**
- Shows pending yield amount
- "Claim" button calls `pool.claimYield()` via wagmi
- On success: shows HSP receipt ID with Blockscout link
- Disabled if pending yield is 0

**`components/PaymentHistory.tsx`**
- Table: Date | Type | Amount | Receipt ID
- Data from `/api/payments/lp?address=...`
- Receipt IDs link to Blockscout

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `lp_position_shows_shares` | Mock position data, render | Share count and USD value displayed |
| `add_liquidity_preview` | Enter amounts | Shares preview computed from oracle price |
| `add_liquidity_kyc_gate` | Mock level 1 (below required 2) | KYCGate shown, submit disabled |
| `remove_slider_preview` | Move slider to 50% | Shows 50% of position in preview |
| `claim_yield_button` | Pending yield > 0 | Button enabled, calls claimYield on click |
| `claim_yield_disabled` | Pending yield == 0 | Button disabled |
| `receipt_id_shown` | Successful claim | Receipt ID appears in payment history |

---

## Page 4 — History

### What it shows

- Tabs: Swaps | Liquidity Events | Payments
- Each tab shows a paginated table of the user's transactions
- All transactions link to Blockscout

### Components to build

**`components/HistoryTabs.tsx`**
- Tab switcher: Swaps / Liquidity / Payments
- Each tab fetches from corresponding API endpoint
- Pagination: 20 items per page

**`components/SwapHistoryTable.tsx`**
- Columns: Date | Direction | Token In | Amount In | Amount Out | Price | Tx Hash

**`components/LiquidityHistoryTable.tsx`**
- Columns: Date | Type (Add/Remove) | RWA Amount | USDC Amount | Shares | Tx Hash

**`components/PaymentHistoryTable.tsx`**
- Columns: Date | Type | Amount | Receipt ID | Tx Hash
- Receipt ID links to HSP receipt query

---

## Wallet connection setup

### Configure HashKey Chain in wagmi

```
import { createConfig, http } from 'wagmi'
import { hashkeyTestnet } from 'viem/chains'

export const wagmiConfig = createConfig({
  chains: [hashkeyTestnet],
  transports: {
    [hashkeyTestnet.id]: http('https://hk-testnet.rpc.alt.technology')
  }
})
```

`hashkeyTestnet` is available natively in viem chains. Chain ID is 133. If not available in your viem version, define it manually:

```
const hashkeyTestnet = {
  id: 133,
  name: 'HashKey Chain Testnet',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://hk-testnet.rpc.alt.technology'] }
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://hashkey.blockscout.com' }
  }
}
```

### Wallet connect modal

Use ConnectKit or RainbowKit. Both support wagmi v2. ConnectKit has slightly cleaner defaults. Configure with the HashKey chain above.

```
npm install connectkit
```

Wrap app in:
```
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <ConnectKitProvider>
      {children}
    </ConnectKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

---

## KYC check on wallet connect

This is the most important UX flow. Implement as a global hook:

**`hooks/useKYCStatus.ts`**
- Triggered whenever `address` changes (user connects/disconnects)
- Calls `/api/kyc/check?address=0x...`
- Returns `{ level, levelName, canSwap, canProvideLiquidity, kycPortalUrl, isLoading }`
- Stored in React Query cache with 60 second TTL
- Exported as context so any component can read KYC status without re-fetching

The global layout component subscribes to this hook and shows a persistent banner at the top if KYC level is insufficient:

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠ Your wallet has Basic KYC. Upgrade to Advanced to provide  │
│  liquidity. [Complete Advanced KYC →]                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Frontend tests

Run with Vitest + React Testing Library.

| Test | What to assert | Pass condition |
|---|---|---|
| `dashboard_loads_pool_state` | Render Dashboard with mock API | Reserves and price shown |
| `dashboard_pricebadge_fresh` | Timestamp 5 min ago | Green "LIVE" badge |
| `dashboard_pricebadge_stale` | Timestamp 30 hours ago | Red "STALE" badge |
| `swap_small_direct_flow` | Amount = 100 USDC | Direct swap button shown, no TradeGuard |
| `swap_large_tradeguard_flow` | Amount = 50000 USDC | TradeGuardFlow renders |
| `kyc_gate_renders` | Mock level 0 from API | KYCGate shows with portal link |
| `kyc_gate_hidden` | Mock level 2 | Gate not in DOM |
| `lp_add_form_preview` | Enter RWA + USDC amounts | Share preview updates |
| `claim_button_enabled` | Mock 500 USDC pending | Claim button not disabled |
| `claim_button_disabled` | Mock 0 pending | Claim button disabled |
| `history_tab_switch` | Click "Payments" tab | PaymentHistoryTable renders |
| `payment_receipt_link` | Receipt ID in row | Link points to Blockscout |

### Test validation checklist

- [ ] All 12 frontend tests pass
- [ ] Run full end-to-end: connect wallet → KYC check → add liquidity → swap → claim yield → view receipt
- [ ] Test on mobile viewport (judges may use phones during demo)
- [ ] Confirm Blockscout links open correct transactions
- [ ] Test with MetaMask on HashKey Chain testnet

---

## Project structure

```
frontend/
├── app/
│   ├── layout.tsx              -- wallet providers, global KYC banner
│   ├── page.tsx                -- Pool Dashboard
│   ├── swap/
│   │   └── page.tsx
│   ├── liquidity/
│   │   └── page.tsx
│   └── history/
│       └── page.tsx
├── components/
│   ├── PriceBadge.tsx
│   ├── PoolStats.tsx
│   ├── PriceChart.tsx
│   ├── RecentSwaps.tsx
│   ├── DistributeYieldButton.tsx
│   ├── SwapForm.tsx
│   ├── KYCGate.tsx
│   ├── TradeGuardFlow.tsx
│   ├── LPPosition.tsx
│   ├── AddLiquidityForm.tsx
│   ├── RemoveLiquiditySlider.tsx
│   ├── ClaimYield.tsx
│   ├── PaymentHistory.tsx
│   └── HistoryTabs.tsx
├── hooks/
│   ├── useKYCStatus.ts
│   ├── useSwap.ts
│   ├── usePoolState.ts
│   └── useLPPosition.ts
├── lib/
│   ├── wagmi.ts               -- chain config
│   ├── contracts.ts           -- ABIs and addresses
│   └── api.ts                 -- typed API client functions
├── tests/
│   └── *.test.tsx
├── .env.local.example
├── tailwind.config.ts
└── next.config.ts
```

---

## Environment variables

```
NEXT_PUBLIC_CHAIN_ID=133
NEXT_PUBLIC_RPC_URL=https://hk-testnet.rpc.alt.technology
NEXT_PUBLIC_RWA_POOL_ADDRESS=0x...
NEXT_PUBLIC_RWA_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_PRICE_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_TRADE_GUARD_ADDRESS=0x...
NEXT_PUBLIC_HSP_ADAPTER_ADDRESS=0x...
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_KYC_PORTAL_URL=https://kyc-testnet.hunyuankyc.com
NEXT_PUBLIC_BLOCKSCOUT_URL=https://hashkey.blockscout.com
```

---

## Key references consolidated

| Resource | URL |
|---|---|
| wagmi v2 docs | `https://wagmi.sh/react/getting-started` |
| viem docs | `https://viem.sh/` |
| viem HashKey chain | `https://viem.sh/docs/chains/introduction` |
| ConnectKit | `https://docs.family.co/connectkit` |
| Next.js App Router | `https://nextjs.org/docs/app` |
| shadcn/ui | `https://ui.shadcn.com/docs` |
| Tailwind CSS | `https://tailwindcss.com/docs` |
| React Query | `https://tanstack.com/query/latest/docs/framework/react/overview` |
| recharts | `https://recharts.org/en-US/api` |
| Vitest | `https://vitest.dev/` |
| React Testing Library | `https://testing-library.com/docs/react-testing-library/intro/` |
| HashKey Blockscout | `https://hashkey.blockscout.com` |
| KYC testnet portal | `https://kyc-testnet.hunyuankyc.com` |
