# Module 1 — Smart Contracts

**Project:** RWA Liquidity Hub — HashKey Chain Horizon Hackathon
**Stack:** Solidity ^0.8.20 · Hardhat · OpenZeppelin · HashKey KYC SBT · APRO Oracle
**Network:** HashKey Chain Testnet (chainId 133) → Mainnet (chainId 177)

---

## Overview

### What we are building

Five smart contracts that together form a compliant RWA trading pool on HashKey Chain:

1. **KYCRegistry** — reads HashKey's native KYC SBT and exposes a clean `isVerified(address)` interface to all other contracts
2. **RWAToken** — ERC-20 with compliance transfer hooks; only KYC-verified wallets can hold or transfer
3. **PriceOracle** — wraps APRO push feeds and SUPRA pull feeds; enforces staleness checks and deviation circuit breakers
4. **RWAPool** — the oracle-anchored liquidity pool; no x·y=k pricing; uses oracle NAV as authoritative price
5. **TradeGuard** — commit-reveal delay mechanism for large swaps; implements HashKey's "fat finger" rollback concept at the application layer

### Why this architecture

HashKey Chain is a compliance-first L2. Their own CEO confirmed a CaaS compliance layer exists on-chain with KYC, AML, and privacy. The KYC system is already live as a Soul Bound Token (SBT) at a known contract address on testnet and mainnet. We consume it rather than rebuild it — this is what judges want to see: builders who use HashKey's own infrastructure stack.

RWA tokens cannot use constant-product AMM pricing because their NAVs are updated off-chain (daily for bonds, intraday for liquid RWAs). Using x·y=k would allow instant arbitrage at every NAV update. The oracle-anchored pool design fixes this: the pool's price IS the oracle price, and we add spread + fee on top.

The TradeGuard contract demonstrates institutional-grade execution safety — no other hackathon submission will implement this, and it directly mirrors a feature HashKey's CEO highlighted as a key differentiator for their chain.

---

## Contract 1 — KYCRegistry

### What it does

Wraps the HashKey KYC SBT contract and provides a unified `isVerified(address, minLevel)` function. All other contracts call this instead of calling the SBT directly. This keeps KYC logic in one place and makes the system upgradeable — if HashKey changes their SBT address, we update only this contract.

### Why we need it

HashKey's native KYC SBT (`IKycSBT`) returns a struct with `level` (0–4) and `status` (NONE/APPROVED/REVOKED). Different pool operations require different minimum KYC levels:

- Viewing pool state: no KYC required
- Swapping tokens: BASIC (level 1) minimum
- Providing liquidity: ADVANCED (level 2) minimum
- Whitelisted institutional LP: PREMIUM (level 3) minimum

A single contract enforcing these tiers is cleaner than scattering KYC checks across all contracts.

### Interface specification

```
interface IKYCRegistry {
    function isVerified(address user, uint8 minLevel) external view returns (bool);
    function getLevel(address user) external view returns (uint8);
    function isRevoked(address user) external view returns (bool);
}
```

### Storage layout

```
address public kycSBTAddress;          // HashKey KYC SBT contract — set in constructor, updatable by owner
mapping(address => bool) public institutionalLP;  // manually whitelisted institutional LPs
address public owner;
bool public paused;
```

### Key functions to implement

`isVerified(address user, uint8 minLevel) → bool`
- Calls `IKycSBT(kycSBTAddress).getKycInfo(user)`
- Returns false if status is REVOKED or NONE
- Returns true only if `level >= minLevel` and `status == APPROVED`
- `institutionalLP[user] == true` overrides and returns true regardless of SBT level (for demo mock accounts)

`updateKYCSBT(address newAddress)`
- Only callable by owner
- Emits `KYCSBTUpdated(oldAddress, newAddress)`
- Required because testnet SBT address differs from mainnet

`setInstitutionalLP(address lp, bool status)`
- Only callable by owner
- For the demo, this lets us whitelist test wallets that haven't gone through live KYC

### Modifiers to implement

`modifier onlyVerified(uint8 minLevel)` — revert with `"KYC: verification required"` if not verified
`modifier whenNotPaused()` — emergency pause for the entire registry

### Events

```
event KYCSBTUpdated(address indexed oldAddress, address indexed newAddress);
event InstitutionalLPSet(address indexed lp, bool status);
event RegistryPaused(address indexed by);
```

### HashKey KYC SBT integration details

Testnet SBT is at: `kyc-testnet.hunyuankyc.com` (check HashKey docs for deployed address)
The interface you import:

```
interface IKycSBT {
    enum KycLevel  { NONE, BASIC, ADVANCED, PREMIUM, ULTIMATE }
    enum KycStatus { NONE, APPROVED, REVOKED }

    function getKycInfo(address account) external view returns (
        string memory ensName,
        KycLevel level,
        KycStatus status,
        uint256 createTime
    );
    function isHuman(address account) external view returns (bool, uint8);
}
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `test_verifiedUser_basicLevel` | Call `isVerified(kycUser, 1)` | Returns true |
| `test_unverifiedUser` | Call `isVerified(noKycUser, 1)` | Returns false |
| `test_revokedUser` | Mock REVOKED status, call `isVerified` | Returns false |
| `test_institutionalOverride` | Set LP whitelist, call with level 4 | Returns true |
| `test_levelTooLow` | User has BASIC, require ADVANCED | Returns false |
| `test_updateSBT_onlyOwner` | Non-owner calls updateKYCSBT | Reverts |
| `test_pause` | Pause registry, call isVerified | Reverts |

### Test validation checklist

- [ ] All 7 tests pass on Hardhat local fork
- [ ] Deploy to HashKey testnet, run tests against live SBT address
- [ ] Verify `getKycInfo` returns expected struct from testnet SBT
- [ ] Gas cost of `isVerified` < 30,000 gas (it's a view call so free off-chain, but costs when called from other contracts)

### Resources

- HashKey KYC docs: `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC`
- KYC SBT ABI: `https://kyc-testnet.hunyuankyc.com/` — download ABI from there
- OpenZeppelin Ownable: `https://docs.openzeppelin.com/contracts/5.x/access-control`
- HashKey testnet RPC: `https://hk-testnet.rpc.alt.technology` (chainId 133)

---

## Contract 2 — RWAToken

### What it does

An ERC-20 token representing a tokenized RWA (e.g., a tokenized bond, treasury bill, or real estate share). Transfers are restricted to KYC-verified wallets via the `_update` hook introduced in OpenZeppelin 5.x (replaces the old `_beforeTokenTransfer`).

### Why we need it

Standard ERC-20 has no transfer restrictions. Any wallet can receive tokens. For a regulated financial instrument, this is illegal — unverified wallets must not be able to hold the asset. The hook approach means compliance is enforced at the token level, not just at the pool level. This is "Policy-as-Code" — Chainlink published on this exact pattern in February 2026.

This creates two layers of compliance:
1. Token layer: `_update` hook blocks transfers to unverified wallets
2. Pool layer: `onlyVerified` modifier blocks unverified wallets from entering the pool

Both layers must be present. An attacker who bypassed the pool could still not receive tokens.

### Interface specification

```
interface IRWAToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function setKYCRegistry(address registry) external;
    function pause() external;
    function unpause() external;
    function getAssetMetadata() external view returns (string memory name, string memory assetType, uint256 navPerToken, uint256 lastUpdated);
}
```

### Storage layout

```
IKYCRegistry public kycRegistry;
string public assetType;           // "BOND" | "TREASURY" | "REAL_ESTATE" | "RECEIVABLE"
string public isinCode;            // International Securities Identification Number
uint256 public navPerToken;        // NAV in USD with 8 decimals — updated by oracle keeper
uint256 public navLastUpdated;     // timestamp of last NAV update
address public minter;             // only minter can mint/burn — will be pool or admin
bool public paused;
```

### Key functions to implement

`_update(address from, address to, uint256 amount)` — override of OZ ERC-20 hook
- If `to != address(0)` (not a burn) and `from != address(0)` (not a mint): require `kycRegistry.isVerified(to, 1)`
- If minting (`from == address(0)`): require `kycRegistry.isVerified(to, 2)` — only ADVANCED+ can receive initial minted RWA tokens
- Emit `ComplianceCheck(from, to, true/false)` before reverting so front-end can display reason

`updateNAV(uint256 newNAV, uint256 timestamp)` — called by oracle keeper backend
- Only callable by minter/admin role
- Require `timestamp > navLastUpdated` — no rewinding NAV
- Emit `NAVUpdated(oldNAV, newNAV, timestamp)`

`mint(address to, uint256 amount)` — only minter role
`burn(address from, uint256 amount)` — only minter role

### Events

```
event ComplianceCheck(address indexed from, address indexed to, bool passed, string reason);
event NAVUpdated(uint256 oldNAV, uint256 newNAV, uint256 timestamp);
event KYCRegistryUpdated(address indexed newRegistry);
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `test_transfer_bothVerified` | Transfer between two KYC wallets | Succeeds |
| `test_transfer_recipientUnverified` | Transfer to non-KYC wallet | Reverts with "KYC: verification required" |
| `test_transfer_senderUnverified` | Unverified sender (after KYC revoked) | Reverts |
| `test_mint_toVerified` | Mint to ADVANCED+ wallet | Succeeds |
| `test_mint_toBasicOnly` | Mint to BASIC wallet | Reverts (BASIC < ADVANCED) |
| `test_burn` | Burn from verified wallet | Succeeds, supply decreases |
| `test_pause` | Pause token, attempt transfer | Reverts |
| `test_navUpdate` | Update NAV with valid timestamp | Emits NAVUpdated |
| `test_navUpdate_olderTimestamp` | Update NAV with past timestamp | Reverts |

### Test validation checklist

- [ ] All 9 tests pass locally
- [ ] Deploy token to testnet, verify `_update` hook fires on transfer
- [ ] Confirm ComplianceCheck events visible on HashKey Blockscout explorer
- [ ] Test with real HashKey testnet KYC SBT — request KYC at `kyc-testnet.hunyuankyc.com`

### Resources

- OZ ERC-20 `_update` hook: `https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20-_update-address-address-uint256-`
- ERC-3643 T-REX standard (for post-hackathon upgrade): `https://github.com/TokenySolutions/T-REX`
- HashKey Blockscout explorer (testnet): `https://hashkey.blockscout.com`

---

## Contract 3 — PriceOracle

### What it does

Aggregates NAV price data from APRO push feeds and SUPRA pull feeds. Implements staleness checks (revert if price is older than `MAX_STALENESS`) and a deviation circuit breaker (pause pool if price jumps more than `MAX_DEVIATION`). Exposes a clean `getPrice(address token)` function for the pool.

### Why we need it

RWA NAVs don't update every block. A US Treasury bond NAV might update once per day. If the pool uses a stale price from 36 hours ago, it's both legally wrong and exploitable — someone who knows the current NAV can arb the pool at the moment of update. The staleness check prevents trading against outdated prices. The deviation circuit breaker prevents large-scale exploitation if the oracle feed is compromised or if a legitimate large price move occurs.

HashKey Chain has three oracle integrations live:
- APRO: push-based, updates when price deviates > 0.5%, has USDC/USD and USDT/USD feeds on testnet
- SUPRA: pull-based, 21-source Byzantine Fault Tolerant aggregation
- Chainlink Streams: verifier proxy at known addresses on both mainnet and testnet

For the hackathon demo, APRO is the primary oracle for stablecoin pairs. For RWA tokens with no on-chain feed, we run a backend keeper that pushes NAV data to a custom `RWAFeed` contract (part of this module).

### Storage layout

```
mapping(address => address) public tokenToFeed;    // token address → APRO feed address
mapping(address => PriceData) public priceStore;   // manual keeper-pushed prices for RWA tokens

struct PriceData {
    int256  price;          // 8 decimals
    uint256 timestamp;
    uint256 roundId;
    bool    active;
}

uint256 public MAX_STALENESS   = 86400;    // 24 hours for bonds
uint256 public MAX_DEVIATION   = 500;      // 5% in basis points
bool    public circuitBreaker  = false;    // if true, all getPrice calls revert
address public keeper;                     // backend wallet that pushes RWA NAVs
address public owner;
```

### Key functions to implement

`getPrice(address token) → (int256 price, uint256 timestamp)`
- If `circuitBreaker == true` → revert "Oracle: circuit breaker active"
- If `tokenToFeed[token] != address(0)` → read from APRO feed using `latestRoundData()`
- Else → read from `priceStore[token]`
- Require `block.timestamp - timestamp <= MAX_STALENESS` → revert "Oracle: stale price"
- Return `(price, timestamp)`

`pushRWAPrice(address token, int256 price, uint256 timestamp)` — only keeper
- Require `timestamp > priceStore[token].timestamp` — no rewind
- Check deviation: if `abs(price - oldPrice) / oldPrice > MAX_DEVIATION / 10000` → emit `DeviationAlert` AND set `circuitBreaker = true`
- Store new price
- Emit `PricePushed(token, price, timestamp)`

`resetCircuitBreaker()` — only owner, after manual review
`setMaxStaleness(uint256 seconds)` — only owner
`setMaxDeviation(uint256 bps)` — only owner
`registerFeed(address token, address feed)` — only owner, registers APRO feed for a token

### APRO integration

On HashKey testnet APRO has these live feed addresses:

| Pair | Address |
|---|---|
| BTC/USD | `0x64697A6Abb508079687465FA9EF99D2Da955D791` |
| USDT/USD | `0xC45D520D18A465Ec23eE99A58Dc4cB96b357E744` |
| USDC/USD | `0xCdB10dC9dB30B6ef2a63aB4460263655808fAE27` |

Import interface: `import "@apro/contracts/APROPriceFeed.sol"` or use the standard Chainlink `AggregatorV3Interface` — APRO is compatible.

### SUPRA integration (pull model)

SUPRA testnet pull contract: `0x443A0f4Da5d2fdC47de3eeD45Af41d399F0E5702`

For the pull model, the backend fetches a signed price proof from SUPRA's API and passes it to the contract's `verifyOracleProof(bytes calldata proof)` before calling `getIndexedPrice(pairId)`. This is more complex than APRO — use APRO as primary, SUPRA as fallback/redundancy.

### Events

```
event PricePushed(address indexed token, int256 price, uint256 timestamp);
event DeviationAlert(address indexed token, int256 oldPrice, int256 newPrice, uint256 deviationBps);
event CircuitBreakerTripped(address indexed token, string reason);
event CircuitBreakerReset(address indexed by);
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `test_getPrice_fresh` | Push price, immediately read | Returns correct price |
| `test_getPrice_stale` | Push price, advance time > MAX_STALENESS, read | Reverts "stale price" |
| `test_deviation_trigger` | Push price 10% above last | Circuit breaker trips, event emits |
| `test_circuitBreaker_blocks` | Trip breaker, call getPrice | Reverts "circuit breaker" |
| `test_resetCircuitBreaker_onlyOwner` | Non-owner resets | Reverts |
| `test_priceRewind_blocked` | Push older timestamp | Reverts |
| `test_APROfeed_integration` | Read live APRO USDC/USD on testnet | Returns price > 0 |

### Test validation checklist

- [ ] All 7 tests pass locally with mocked feeds
- [ ] `test_APROfeed_integration` passes against live APRO on HashKey testnet
- [ ] Stale price test uses `evm_increaseTime` in Hardhat to advance time
- [ ] Circuit breaker state resets cleanly after `resetCircuitBreaker()`

### Resources

- APRO docs: `https://docs.apro.com/en/data-push/getting-started`
- SUPRA pull oracle docs: `https://docs.supra.com/oracles/data-feeds/pull-oracle`
- Chainlink AggregatorV3Interface: `https://docs.chain.link/data-feeds/api-reference`
- HashKey oracle page: `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/Oracle`
- Hardhat time helpers: `https://hardhat.org/hardhat-network/docs/reference#special-testing-json-rpc-methods`

---

## Contract 4 — RWAPool

### What it does

The core liquidity pool. Institutional LPs deposit RWA tokens and USDC. Traders swap between them at the oracle NAV price plus a configurable spread. LP yield is accumulated and streamed out via HSP. The pool does NOT use x·y=k — it uses oracle price for all trades.

### Why this design

Standard AMM pricing (Uniswap v2/v3) is designed for freely traded assets where price discovery happens in the pool. RWA tokens are different:

- Their price is determined by off-chain events (bond coupon, property valuation, receivable payment)
- Trading volume is low and infrequent — not enough to maintain AMM price accuracy
- Institutional counterparties need price certainty, not price impact based on pool depth

The oracle-anchored pool gives traders a guaranteed execution price (oracle NAV ± spread) regardless of pool depth, as long as the pool has sufficient USDC and RWA token reserves. This is how most institutional RWA protocols work in practice (Ondo Finance, Centrifuge, Maple Finance).

### Storage layout

```
struct PoolState {
    address rwaToken;
    address stableToken;        // USDC
    uint256 rwaReserve;
    uint256 stableReserve;
    uint256 spreadBps;          // trading spread in basis points, e.g. 30 = 0.30%
    uint256 feeBps;             // protocol fee, e.g. 10 = 0.10%
    uint256 accumulatedFees;    // USDC fees accumulated for yield streaming
    bool    paused;
}

mapping(address => uint256) public lpShares;       // LP address → share units
uint256 public totalShares;
IKYCRegistry   public kycRegistry;
IPriceOracle   public priceOracle;
address        public feeRecipient;
address        public owner;
address        public gatewayKeeper;               // backend wallet that mints shares from Gateway

uint256 public MIN_LP_LEVEL = 2;    // ADVANCED KYC for LPs
uint256 public MIN_SWAP_LEVEL = 1;  // BASIC KYC for swappers
```

### Key functions to implement

`addLiquidity(uint256 rwaAmount, uint256 stableAmount)`
- Modifier: `onlyVerified(MIN_LP_LEVEL)` via KYCRegistry
- Pull RWA tokens and USDC from sender
- Calculate shares based on oracle NAV: `shares = stableAmount + (rwaAmount * oraclePrice / 1e8)`
- Mint LP shares
- Emit `LiquidityAdded(lp, rwaAmount, stableAmount, shares)`

`removeLiquidity(uint256 shares)`
- Modifier: `onlyVerified(MIN_LP_LEVEL)`
- Calculate rwa and stable amounts proportional to shares
- Burn shares, transfer tokens back
- Emit `LiquidityRemoved(lp, rwaAmount, stableAmount, shares)`

`swapStableForRWA(uint256 stableAmountIn, uint256 minRWAOut)`
- Modifier: `onlyVerified(MIN_SWAP_LEVEL)`
- Get oracle price: `(price, timestamp) = priceOracle.getPrice(rwaToken)`
- Calculate: `rwaOut = stableAmountIn * 1e8 / price` — raw amount
- Apply spread: `rwaOut = rwaOut * (10000 - spreadBps) / 10000`
- Apply fee: deduct `stableAmountIn * feeBps / 10000` from stable input, add to `accumulatedFees`
- Require `rwaOut >= minRWAOut` — slippage protection
- Transfer tokens, emit `Swap(user, stableIn, rwaOut, price)`

`swapRWAForStable(uint256 rwaAmountIn, uint256 minStableOut)`
- Inverse of above
- `stableOut = rwaAmountIn * price / 1e8`
- Apply spread and fee symmetrically

`mintFromGateway(address lp, uint256 stableAmount)`
- Modifier: `onlyGatewayKeeper`
- Used when users deposit fiat/USDC via HashKey Merchant API.
- Pulls `stableAmount` USDC from keeper (or gateway contract) to pool.
- Computes shares based on current oracle price (no RWA deposit needed for single-sided entry).
- Mints LP shares.
- Emit `LiquidityAddedFromGateway(lp, stableAmount, shares)`

`claimYield()`
- LP claims their portion of accumulated fees.
- `pendingYield = accumulatedFees * lpShares[msg.sender] / totalShares`
- Requires `pendingYield > 0`
- Resets or updates state, transfers USDC to `msg.sender`.
- Emit `YieldClaimed(msg.sender, pendingYield)`

`pause() / unpause()` — only owner, emergency stop

### Events

```
event LiquidityAdded(address indexed lp, uint256 rwaAmount, uint256 stableAmount, uint256 shares);
event LiquidityAddedFromGateway(address indexed lp, uint256 stableAmount, uint256 shares);
event LiquidityRemoved(address indexed lp, uint256 rwaAmount, uint256 stableAmount, uint256 shares);
event Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, int256 executionPrice);
event YieldClaimed(address indexed lp, uint256 amount);
event SpreadUpdated(uint256 oldBps, uint256 newBps);
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `test_addLiquidity_verified` | ADVANCED KYC LP adds liquidity | Shares minted correctly |
| `test_mintFromGateway` | Keeper calls mintFromGateway | Shares minted to LP |
| `test_addLiquidity_basic_rejected` | BASIC KYC user tries to LP | Reverts |
| `test_swap_basic_kyc` | BASIC KYC user swaps USDC → RWA | Succeeds, correct amount out |
| `test_swap_unverified` | No KYC user swaps | Reverts |
| `test_swap_staleOracle` | Advance time > 24h, attempt swap | Reverts from oracle |
| `test_slippage_protection` | Set minOut > expected out | Reverts "slippage exceeded" |
| `test_spread_applied` | Swap, check fee deducted | accumulatedFees > 0 |
| `test_claimYield` | LP claims yield | USDC transferred |
| `test_removeLiquidity` | LP removes shares | Correct token amounts returned |
| `test_pause_blocks_swaps` | Pause pool, attempt swap | Reverts |

### Test validation checklist

- [ ] All 10 tests pass locally
- [ ] Deploy full system (KYCRegistry + RWAToken + PriceOracle + RWAPool) to testnet
- [ ] Run full swap flow on testnet: KYC → add liquidity → swap → distribute yield
- [ ] Verify events on Blockscout for every operation
- [ ] Check gas costs: addLiquidity < 200k, swap < 150k, distributeYield < varies by LP count

### Resources

- Ondo Finance (RWA pool reference): `https://github.com/ondoprotocol/tokenized-funds`
- Centrifuge (RWA lending reference): `https://github.com/centrifuge/liquidity-pools`
- OpenZeppelin ReentrancyGuard: `https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard`
- ERC-4626 tokenized vault standard (upgrade path): `https://eips.ethereum.org/EIPS/eip-4626`

---

## Contract 5 — TradeGuard

### What it does

A commit-reveal delay mechanism for large swaps. A user commits a hash of their swap parameters, waits N blocks, then executes. Within the window they can cancel. Above a threshold (`LARGE_SWAP_THRESHOLD`), swaps MUST go through TradeGuard. Below threshold, swaps can go direct to RWAPool.

### Why we need it

This is the on-chain equivalent of HashKey's "fat finger" rollback mechanism — their CEO specifically called this out as something traditional blockchains lack but institutional finance requires. No other hackathon submission will build this.

From a security standpoint, it also eliminates frontrunning of large institutional trades: because the trade parameters are committed as a hash and only revealed at execution, MEV bots cannot frontrun based on seeing the trade in the mempool.

### Storage layout

```
struct TradeCommitment {
    bytes32  paramHash;          // keccak256(user, tokenIn, amountIn, minOut, nonce)
    address  user;
    uint256  commitBlock;
    uint256  expireBlock;        // commitBlock + MAX_DELAY
    bool     executed;
    bool     cancelled;
}

mapping(bytes32 => TradeCommitment) public commitments;  // commitHash → commitment

uint256 public DELAY_BLOCKS         = 2;      // min blocks before execution (~4 seconds on HashKey)
uint256 public MAX_DELAY_BLOCKS     = 50;     // max blocks before commitment expires
uint256 public LARGE_SWAP_THRESHOLD = 10_000e6; // 10,000 USDC — above this must use TradeGuard
IRWAPool public pool;
address  public owner;
```

### Key functions to implement

`commitSwap(bytes32 paramHash) → bytes32 commitId`
- Store commitment: `{ paramHash, msg.sender, block.number, block.number + MAX_DELAY_BLOCKS, false, false }`
- Emit `SwapCommitted(commitId, user, block.number)`
- Return `commitId = keccak256(paramHash, block.number, msg.sender)`

`executeSwap(bytes32 commitId, address tokenIn, uint256 amountIn, uint256 minOut, uint256 nonce)`
- Load commitment
- Require `!executed && !cancelled`
- Require `block.number >= commitBlock + DELAY_BLOCKS`
- Require `block.number <= expireBlock`
- Verify: `keccak256(msg.sender, tokenIn, amountIn, minOut, nonce) == paramHash`
- Mark executed
- Call `pool.swapStableForRWA(amountIn, minOut)` or `swapRWAForStable` based on `tokenIn`
- Emit `SwapExecuted(commitId, user, amountIn, amountOut)`

`cancelSwap(bytes32 commitId)`
- Only the committing user
- Require `!executed && !cancelled`
- Require `block.number <= expireBlock` OR `block.number > expireBlock` (can cancel anytime before execution)
- Mark cancelled
- Emit `SwapCancelled(commitId, user)`

`hashSwapParams(address user, address tokenIn, uint256 amountIn, uint256 minOut, uint256 nonce) → bytes32`
- Pure helper — front-end calls this to compute the hash before committing

### Events

```
event SwapCommitted(bytes32 indexed commitId, address indexed user, uint256 commitBlock);
event SwapExecuted(bytes32 indexed commitId, address indexed user, uint256 amountIn, uint256 amountOut);
event SwapCancelled(bytes32 indexed commitId, address indexed user);
event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `test_commit_then_execute` | Full happy path within window | Swap executes correctly |
| `test_execute_too_early` | Execute before DELAY_BLOCKS | Reverts "too early" |
| `test_execute_expired` | Execute after MAX_DELAY_BLOCKS | Reverts "commitment expired" |
| `test_wrong_params` | Execute with different params than committed | Reverts "hash mismatch" |
| `test_cancel` | Commit then cancel | Cancelled, can't execute |
| `test_execute_cancelled` | Try to execute cancelled commitment | Reverts "cancelled" |
| `test_replay_blocked` | Execute twice | Reverts "already executed" |
| `test_wrong_user` | Different user tries to execute | Reverts "hash mismatch" |

### Test validation checklist

- [ ] All 8 tests pass locally
- [ ] Test on testnet: commit → wait 2 blocks → execute
- [ ] Test cancellation flow on testnet
- [ ] Verify `SwapCommitted` and `SwapExecuted` events visible on Blockscout
- [ ] Confirm gas: `commitSwap` < 80k, `executeSwap` < 200k

### Resources

- Commit-reveal pattern (OpenZeppelin): `https://docs.openzeppelin.com/contracts/5.x/api/utils#Hashes`
- MEV protection patterns: `https://ethereum.org/en/developers/docs/mev/`
- Flashbots docs on frontrunning: `https://docs.flashbots.net/`

---

## Deployment order

Deploy in this exact sequence — each contract depends on the previous:

1. KYCRegistry (pass HashKey SBT address)
2. RWAToken (pass KYCRegistry address)
3. PriceOracle (no deps — set feeds after)
4. RWAPool (pass KYCRegistry and PriceOracle addresses)
5. TradeGuard (pass RWAPool address)
6. Call `pool.setTradeGuard(tradeGuardAddress)`
7. Register APRO feeds in PriceOracle
8. Whitelist test LP wallets in KYCRegistry

## Hardhat config for HashKey Chain

```
hashkeyTestnet: {
  url: "https://hk-testnet.rpc.alt.technology",
  chainId: 133,
  accounts: [process.env.PRIVATE_KEY]
}

hashkeyMainnet: {
  url: "https://mainnet.hsk.xyz",
  chainId: 177,
  accounts: [process.env.PRIVATE_KEY]
}
```

## Full test run command

```
npx hardhat test --network hardhat          # local tests (fast)
npx hardhat test --network hashkeyTestnet   # testnet integration tests
npx hardhat run scripts/deploy.js --network hashkeyTestnet
```

## Key references consolidated

| Resource | URL |
|---|---|
| HashKey Chain docs | `https://docs.hashkeychain.net` |
| HashKey KYC integration | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC` |
| HashKey Oracle page | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/Oracle` |
| APRO docs | `https://docs.apro.com/en/data-push/getting-started` |
| SUPRA pull oracle | `https://docs.supra.com/oracles/data-feeds/pull-oracle` |
| OpenZeppelin v5 | `https://docs.openzeppelin.com/contracts/5.x` |
| HashKey testnet faucet | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/Faucet` |
| HashKey Blockscout | `https://hashkey.blockscout.com` |
| Hardhat docs | `https://hardhat.org/docs` |
| KYC testnet portal | `https://kyc-testnet.hunyuankyc.com` |
