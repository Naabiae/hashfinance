# Module 3 — HashKey HSP Payments (Single & Batch)

**Project:** RWA Liquidity Hub — HashKey Chain Horizon Hackathon
**Stack:** Solidity ^0.8.20 · ethers.js v6 · HashKey HSP Protocol
**Role:** Yield distribution from pool to LPs, settlement of swap cash legs, batch payments to multiple LPs

---

## Overview

### What we are building

Two payment patterns using HashKey's HSP (HashKey Settlement Protocol):

1. **Single payment** — one LP or one counterparty receives a payment (e.g., institutional settlement of a large swap, or one-off yield claim)
2. **Batch payment** — all LPs in the pool receive their proportional yield share in a single transaction (replaces a loop of individual transfers)

Both patterns use HSP so that every payment generates an on-chain receipt with Travel Rule metadata — a requirement for institutional-grade DeFi that HashKey judges will look for.

### Why HSP instead of plain ERC-20 transfer

A plain `token.transfer(to, amount)` works but leaves no auditable payment context. HSP wraps the transfer with:

- A unique `paymentId` for reconciliation
- Sender and recipient metadata (feeds into AML travel rule compliance)
- An on-chain receipt that can be queried later
- Support for streaming (real-time micro-payments) rather than lump-sum distributions

For institutional finance, the audit trail is the product. An LP's CFO wants to see "this specific pool payment, at this timestamp, for this reason" — not just a raw transfer event. HSP provides that.

The hackathon brief explicitly says PayFi track submissions using HSP earn extra points. This module is how we earn them.

### How HSP fits into the RWA Pool flow

```
RWAPool accumulates trading fees → USDC in accumulatedFees
         │
         ▼
distributeYield() is called (permissionless — anyone can trigger)
         │
         ├── for single LP withdrawal: HSPSinglePayment.pay(lp, amount, metadata)
         └── for batch distribution: HSPBatchPayment.batchPay(lpAddresses, amounts, metadata)
                    │
                    ▼
             Each LP receives USDC
             On-chain receipt emitted with paymentId
```

---

## Understanding HSP

### What HSP is

HSP is HashKey Chain's native payment settlement protocol. It is the recommended integration for the PayFi track. The user manual is at `https://hashfans.io/` under the top navigation bar.

Because HSP documentation is only available at `hashfans.io` (which requires login for the full manual), the contracts in this module are designed to be HSP-compatible by implementing the standard interface pattern. If HSP has a different interface than assumed, the adapter pattern used here means only the adapter layer needs changing, not the pool logic.

### HSP interface assumption

Based on HashKey's published CaaS architecture and PayFi patterns, HSP is expected to expose:

```
interface IHSP {
    // Single payment with metadata
    function pay(
        address recipient,
        address token,
        uint256 amount,
        string calldata paymentId,
        string calldata memo
    ) external returns (bytes32 receiptId);

    // Batch payment to multiple recipients
    function batchPay(
        address[] calldata recipients,
        address token,
        uint256[] calldata amounts,
        string calldata batchId,
        string calldata memo
    ) external returns (bytes32[] memory receiptIds);

    // Query a receipt
    function getReceipt(bytes32 receiptId) external view returns (
        address sender,
        address recipient,
        address token,
        uint256 amount,
        uint256 timestamp,
        string memory paymentId,
        string memory memo
    );
}
```

If the actual HSP interface differs, adjust the `HSPAdapter` contract (see below) accordingly. The pool contract only calls the adapter, not HSP directly — so the rest of the system stays unchanged.

### How to get the real HSP interface

1. Go to `https://hashfans.io/` and log in with your hackathon account
2. Navigate to the "HSP" section in the top navigation bar
3. Download the HSP user manual PDF
4. Extract the contract ABI and deployed addresses from the manual
5. Replace the assumed interface in `HSPAdapter.sol` with the real one

---

## Contract — HSPAdapter

### What it does

A thin wrapper around the actual HSP contract. All payment logic in RWAPool calls `HSPAdapter` rather than HSP directly. This isolates the rest of the system from HSP's exact interface and makes testing easier (you can mock the adapter without needing a live HSP deployment).

### Why an adapter

Two reasons:

1. **Testability**: Mock the adapter in unit tests without a live HSP contract on your local Hardhat node
2. **Upgradeability**: If HashKey updates HSP, update the adapter, not all the contracts that use payments

### Storage layout

```
address public hspContract;     // actual HSP protocol address
address public defaultToken;    // USDC address on HashKey Chain
address public owner;
bool    public mockMode;        // true during local testing — bypasses real HSP, emits events only
uint256 public totalPaid;       // cumulative amount routed through adapter
```

### Key functions to implement

`pay(address recipient, uint256 amount, string calldata paymentId, string calldata memo) → bytes32 receiptId`
- Approve `hspContract` to pull `amount` from adapter if needed (depends on HSP's pull vs push model)
- Call `IHSP(hspContract).pay(recipient, defaultToken, amount, paymentId, memo)`
- If `mockMode == true`: skip HSP call, emit `MockPayment(recipient, amount, paymentId)` and return `keccak256(paymentId, block.timestamp)`
- Store receipt ID
- Emit `PaymentRouted(recipient, amount, paymentId, receiptId)`

`batchPay(address[] calldata recipients, uint256[] calldata amounts, string calldata batchId, string calldata memo) → bytes32[] receiptIds`
- Require `recipients.length == amounts.length`
- Require `recipients.length <= 200` — gas limit protection
- Loop call to HSP batchPay (or loop individual pays if HSP has no batch)
- If `mockMode == true`: emit `MockBatchPayment(batchId, recipients.length, totalAmount)`
- Emit `BatchPaymentRouted(batchId, recipients.length, totalAmount)`

`getReceipt(bytes32 receiptId) → receipt struct`
- Delegates to `IHSP(hspContract).getReceipt(receiptId)`
- In mock mode: returns stored mock receipt

### Events

```
event PaymentRouted(address indexed recipient, uint256 amount, string paymentId, bytes32 receiptId);
event BatchPaymentRouted(string indexed batchId, uint256 recipientCount, uint256 totalAmount);
event MockPayment(address indexed recipient, uint256 amount, string paymentId);
event MockBatchPayment(string indexed batchId, uint256 count, uint256 totalAmount);
event HSPContractUpdated(address oldAddress, address newAddress);
```

---

## Single Payment flow

### When it is used

- An institutional LP wants to claim their accumulated yield manually rather than waiting for batch distribution
- Settlement of a large OTC swap where both legs need separate receipts
- Admin refund or correction payment

### Flow

```
LP calls: claimYield() on RWAPool
   │
   ▼
RWAPool computes: lpYield = accumulatedFees * lpShares[user] / totalShares
   │
   ▼
RWAPool calls: HSPAdapter.pay(
    recipient = user,
    amount    = lpYield,
    paymentId = "YIELD-{poolAddress}-{user}-{block.timestamp}",
    memo      = "RWA Pool yield distribution"
)
   │
   ▼
HSPAdapter calls: IHSP.pay(...)
   │
   ▼
LP receives USDC + on-chain receipt
   │
   ▼
RWAPool emits: YieldClaimed(user, amount, receiptId)
RWAPool reduces: accumulatedFees -= lpYield
RWAPool resets: lastClaimedAt[user] = block.timestamp
```

### Function to add to RWAPool

`claimYield() → (uint256 amount, bytes32 receiptId)`
- Calculate pending yield for `msg.sender`: `pendingYield = accumulatedFees * lpShares[msg.sender] / totalShares`
- Require `pendingYield > 0` — revert "no yield to claim"
- Generate `paymentId = string(abi.encodePacked("YIELD-", poolAddressStr, "-", userAddressStr, "-", block.timestamp))`
- Call `HSPAdapter.pay(msg.sender, pendingYield, paymentId, "RWA Pool yield distribution")`
- Reduce `accumulatedFees` by `pendingYield`
- Emit `YieldClaimed(msg.sender, pendingYield, receiptId)`
- Return `(pendingYield, receiptId)`

### Tests to write — Single Payment

| Test | What to assert | Pass condition |
|---|---|---|
| `single_claim_correct_amount` | LP with 50% shares claims when 1000 USDC accumulated | Receives 500 USDC |
| `single_claim_zero_balance` | LP with no shares calls claimYield | Reverts "no yield to claim" |
| `single_claim_updates_fees` | After claim, accumulatedFees reduced correctly | Remaining fees = total - claimed |
| `single_claim_emits_receipt` | Claim succeeds | YieldClaimed event with non-zero receiptId |
| `single_pay_mockMode` | mockMode = true, call pay | MockPayment event emitted, no HSP call |
| `single_pay_receiptStored` | Pay in mockMode, query receipt | Returns correct mock receipt data |

---

## Batch Payment flow

### When it is used

- `distributeYield()` is called on RWAPool — all LPs receive their share at once
- End-of-period distribution (e.g., daily bond coupon distribution)
- Governance-triggered payout to all participants

### Why batch instead of individual pays

Gas cost. If there are 50 LPs and each requires a separate transaction, distributing yield costs 50 × gas. A batch payment does it in one transaction. For the demo, 50 LPs is unrealistic, but the architecture must support it for the startup pitch.

### Flow

```
Anyone calls: distributeYield() on RWAPool
   │
   ▼
RWAPool assembles: recipients[] and amounts[] from all LP shareholders
   (reads lpShares mapping — in demo this is stored as an array of LP addresses)
   │
   ▼
RWAPool calls: HSPAdapter.batchPay(
    recipients = [lp1, lp2, lp3, ...],
    amounts    = [share1 * fees / total, share2 * fees / total, ...],
    batchId    = "BATCH-{poolAddress}-{block.number}",
    memo       = "RWA Pool batch yield distribution"
)
   │
   ▼
Each LP receives proportional USDC
All receipts emitted in one transaction
   │
   ▼
RWAPool emits: YieldDistributed(totalAmount, recipientCount)
RWAPool resets: accumulatedFees = 0
```

### Data structure needed in RWAPool

To support batch payment, the pool needs to track LP addresses (not just their share mapping):

```
address[] public lpList;                          // ordered list of LP addresses
mapping(address => bool) public isLP;             // O(1) membership check
mapping(address => uint256) public lpShares;      // existing
```

`addLiquidity` → push to `lpList` if `isLP[msg.sender] == false`, set `isLP[msg.sender] = true`
`removeLiquidity` (full withdrawal) → remove from `lpList`, set `isLP[msg.sender] = false`

Note: removing from middle of array is O(n). For the demo this is fine. In production use EnumerableSet from OpenZeppelin which handles this properly.

### Function to add to RWAPool

`distributeYield() → (uint256 totalDistributed, uint256 recipientCount)`
- Require `accumulatedFees > 0` — revert "nothing to distribute"
- Build `recipients[]` and `amounts[]` arrays from `lpList`
- Skip LPs with zero shares (edge case if they fully withdrew but are still in list)
- Require `recipients.length > 0` — revert "no active LPs"
- Generate `batchId = string(abi.encodePacked("BATCH-", poolAddressStr, "-", block.number))`
- Call `HSPAdapter.batchPay(recipients, amounts, batchId, "RWA Pool batch yield distribution")`
- Reset `accumulatedFees = 0`
- Emit `YieldDistributed(accumulatedFees, recipients.length)` — emit BEFORE reset (use local var)

### Tests to write — Batch Payment

| Test | What to assert | Pass condition |
|---|---|---|
| `batch_distribute_three_lps` | 3 LPs with different shares, 900 USDC fees | Each receives proportional amount |
| `batch_distribute_rounding` | Fees not divisible by shares count | No USDC lost to rounding, remainder stays in pool |
| `batch_distribute_zero_fees` | 0 accumulatedFees | Reverts "nothing to distribute" |
| `batch_distribute_resets_fees` | After distribution | accumulatedFees == 0 |
| `batch_distribute_emits_event` | Distribute to 3 LPs | YieldDistributed event with correct total and count |
| `batch_mockMode` | batchPay in mockMode | MockBatchPayment event emitted |
| `batch_max_200_lps` | 201 recipients | Reverts "recipient limit exceeded" |

### Test validation checklist — all payment tests

- [ ] All 6 single + 7 batch tests pass locally with mockMode = true
- [ ] Deploy to testnet with real HSP address (once obtained from hashfans.io docs)
- [ ] Run single claim: verify receipt visible on Blockscout
- [ ] Run batch distribute: verify all LP balances updated in one tx
- [ ] Confirm `batchId` format allows reconciliation (matches what was logged on backend)
- [ ] Test 200-LP gas cost — ensure it fits within HashKey Chain block gas limit

---

## Backend payment tracking module

### What it does

The backend needs to track all HSP payment receipts so the frontend can show LPs their payment history with receipt IDs.

### Modules to implement

**`src/payments/receiptTracker.ts`**
- Listens for `PaymentRouted` and `BatchPaymentRouted` events from HSPAdapter
- For each batch: fetches individual receipt IDs from the batch receipt array
- Stores in `payments` table in SQLite:

```
TABLE payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id   TEXT UNIQUE NOT NULL,   -- bytes32 from HSP
  payment_id   TEXT NOT NULL,          -- human-readable ID we generated
  batch_id     TEXT,                   -- null for single payments
  sender       TEXT NOT NULL,
  recipient    TEXT NOT NULL,
  token        TEXT NOT NULL,
  amount       TEXT NOT NULL,
  timestamp    INTEGER NOT NULL,
  memo         TEXT,
  tx_hash      TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**`src/api/routes/payments.ts`** — new API route

`GET /api/payments/lp?address=0x...`
Returns all payments to an LP address with receipt IDs

`GET /api/payments/receipt/:receiptId`
Returns full receipt details — calls HSPAdapter.getReceipt() or returns from DB

### Tests to write — Backend payment tracking

| Test | What to assert | Pass condition |
|---|---|---|
| `tracker_stores_single_payment` | PaymentRouted event fires | Row in payments table |
| `tracker_stores_batch_payment` | BatchPaymentRouted event | One row per recipient |
| `api_get_lp_payments` | GET /api/payments/lp?address=0x... | Returns array of receipts |
| `api_get_receipt` | GET /api/payments/receipt/0x... | Returns full receipt data |

---

## Deployment notes

The HSPAdapter must be deployed before RWAPool because RWAPool takes HSPAdapter address as constructor argument.

Set `mockMode = true` for local and testnet testing. Set `mockMode = false` only when HSP mainnet address is confirmed.

To get the real HSP contract address:
1. Log in to `https://hashfans.io/`
2. Find HSP documentation in the top nav
3. Note the deployed contract address for testnet and mainnet
4. Set `HSP_CONTRACT_ADDRESS` in your deployment script

## Key references consolidated

| Resource | URL |
|---|---|
| HSP user manual | `https://hashfans.io/` (top nav, requires login) |
| HashKey developer community | `https://hashfans.io/` |
| HashKey testnet explorer | `https://hashkey.blockscout.com` |
| HashKey Chain network info | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/network-info` |
| OpenZeppelin EnumerableSet | `https://docs.openzeppelin.com/contracts/5.x/api/utils#EnumerableSet` |
| Travel Rule background | `https://www.fatf-gafi.org/en/topics/virtual-assets.html` |
| PayFi concept overview | `https://bingx.com/en/learn/article/what-are-the-top-payfi-crypto-projects` |
