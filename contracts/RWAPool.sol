// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IKYCRegistry.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IRWAPool.sol";

contract RWAPool is IRWAPool, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PoolState {
        address rwaToken;
        address stableToken;
        uint256 rwaReserve;
        uint256 stableReserve;
        uint256 spreadBps;
        uint256 feeBps;
        uint256 accumulatedFees;
        uint256 accYieldPerShare;
        bool paused;
    }

    PoolState public state;
    mapping(address => uint256) public lpShares;
    mapping(address => uint256) public userYieldPerSharePaid;
    mapping(address => uint256) public rewards;
    address[] public lpList;
    mapping(address => bool) public isLP;
    uint256 public totalShares;
    
    IKYCRegistry public kycRegistry;
    IPriceOracle public priceOracle;
    address public feeRecipient;
    address public tradeGuard;
    address public gatewayKeeper;

    uint256 public MIN_LP_LEVEL = 2;
    uint256 public MIN_SWAP_LEVEL = 1;

    event LiquidityAdded(address indexed lp, uint256 rwaAmount, uint256 stableAmount, uint256 shares);
    event LiquidityAddedFromGateway(address indexed lp, uint256 stableAmount, uint256 shares);
    event LiquidityRemoved(address indexed lp, uint256 rwaAmount, uint256 stableAmount, uint256 shares);
    event Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, int256 executionPrice);
    event YieldClaimed(address indexed lp, uint256 amount);
    event SpreadUpdated(uint256 oldBps, uint256 newBps);

    modifier updateReward(address account) {
        if (totalShares > 0) {
            state.accYieldPerShare += (state.accumulatedFees * 1e18) / totalShares;
            state.accumulatedFees = 0;
        }
        if (account != address(0)) {
            rewards[account] += (lpShares[account] * (state.accYieldPerShare - userYieldPerSharePaid[account])) / 1e18;
            userYieldPerSharePaid[account] = state.accYieldPerShare;
        }
        _;
    }

    modifier onlyVerified(uint8 minLevel) {
        require(kycRegistry.isVerified(msg.sender, minLevel), "KYC: verification required");
        _;
    }
    
    modifier onlyTradeGuardOrVerified(uint8 minLevel) {
        if (msg.sender != tradeGuard) {
            require(kycRegistry.isVerified(msg.sender, minLevel), "KYC: verification required");
        }
        _;
    }

    modifier onlyGatewayKeeper() {
        require(msg.sender == gatewayKeeper, "Pool: only gateway keeper");
        _;
    }

    modifier whenNotPaused() {
        require(!state.paused, "Pool: paused");
        _;
    }

    constructor(
        address _rwaToken,
        address _stableToken,
        address _kycRegistry,
        address _priceOracle,
        address _feeRecipient
    ) Ownable(msg.sender) {
        state.rwaToken = _rwaToken;
        state.stableToken = _stableToken;
        state.spreadBps = 30; // 0.30%
        state.feeBps = 10;    // 0.10%
        kycRegistry = IKYCRegistry(_kycRegistry);
        priceOracle = IPriceOracle(_priceOracle);
        feeRecipient = _feeRecipient;
    }

    function setTradeGuard(address _tradeGuard) external onlyOwner {
        tradeGuard = _tradeGuard;
    }

    function setGatewayKeeper(address _gatewayKeeper) external onlyOwner {
        gatewayKeeper = _gatewayKeeper;
    }

    function addLiquidity(uint256 rwaAmount, uint256 stableAmount) external nonReentrant onlyVerified(uint8(MIN_LP_LEVEL)) whenNotPaused updateReward(msg.sender) {
        IERC20(state.rwaToken).safeTransferFrom(msg.sender, address(this), rwaAmount);
        IERC20(state.stableToken).safeTransferFrom(msg.sender, address(this), stableAmount);

        (int256 price, ) = priceOracle.getPrice(state.rwaToken);
        require(price > 0, "Pool: invalid oracle price");

        uint256 rwaValueInStable = (rwaAmount * uint256(price)) / 1e10; // RWA (8 dec) * Price (8 dec) = 16 dec. 16 dec / 1e10 = 6 dec (USDC)
        uint256 shares = stableAmount + rwaValueInStable;

        lpShares[msg.sender] += shares;
        totalShares += shares;

        if (!isLP[msg.sender]) {
            isLP[msg.sender] = true;
            lpList.push(msg.sender);
        }

        state.rwaReserve += rwaAmount;
        state.stableReserve += stableAmount;

        emit LiquidityAdded(msg.sender, rwaAmount, stableAmount, shares);
    }

    function removeLiquidity(uint256 shares) external nonReentrant onlyVerified(uint8(MIN_LP_LEVEL)) whenNotPaused updateReward(msg.sender) {
        require(lpShares[msg.sender] >= shares, "Pool: insufficient shares");

        uint256 rwaAmount = (shares * state.rwaReserve) / totalShares;
        uint256 stableAmount = (shares * state.stableReserve) / totalShares;

        lpShares[msg.sender] -= shares;
        totalShares -= shares;

        state.rwaReserve -= rwaAmount;
        state.stableReserve -= stableAmount;

        IERC20(state.rwaToken).safeTransfer(msg.sender, rwaAmount);
        IERC20(state.stableToken).safeTransfer(msg.sender, stableAmount);

        emit LiquidityRemoved(msg.sender, rwaAmount, stableAmount, shares);
    }

    function swapStableForRWA(uint256 stableAmountIn, uint256 minRWAOut) external nonReentrant onlyTradeGuardOrVerified(uint8(MIN_SWAP_LEVEL)) whenNotPaused {
        (int256 price, ) = priceOracle.getPrice(state.rwaToken);
        require(price > 0, "Pool: invalid oracle price");

        uint256 fee = (stableAmountIn * state.feeBps) / 10000;
        uint256 amountAfterFee = stableAmountIn - fee;

        uint256 rwaOut = (amountAfterFee * 1e10) / uint256(price); // USDC (6 dec) * 1e10 = 16 dec. 16 dec / Price (8 dec) = 8 dec (RWA)
        rwaOut = (rwaOut * (10000 - state.spreadBps)) / 10000;

        require(rwaOut >= minRWAOut, "Pool: slippage exceeded");
        require(state.rwaReserve >= rwaOut, "Pool: insufficient RWA liquidity");

        state.accumulatedFees += fee;
        state.stableReserve += stableAmountIn;
        state.rwaReserve -= rwaOut;

        address recipient = msg.sender == tradeGuard ? tx.origin : msg.sender;

        IERC20(state.stableToken).safeTransferFrom(msg.sender, address(this), stableAmountIn);
        IERC20(state.rwaToken).safeTransfer(recipient, rwaOut);

        emit Swap(recipient, state.stableToken, state.rwaToken, stableAmountIn, rwaOut, price);
    }

    function swapRWAForStable(uint256 rwaAmountIn, uint256 minStableOut) external nonReentrant onlyTradeGuardOrVerified(uint8(MIN_SWAP_LEVEL)) whenNotPaused {
        (int256 price, ) = priceOracle.getPrice(state.rwaToken);
        require(price > 0, "Pool: invalid oracle price");

        uint256 stableOut = (rwaAmountIn * uint256(price)) / 1e10;
        stableOut = (stableOut * (10000 - state.spreadBps)) / 10000;

        uint256 fee = (stableOut * state.feeBps) / 10000;
        stableOut = stableOut - fee;

        require(stableOut >= minStableOut, "Pool: slippage exceeded");
        require(state.stableReserve >= stableOut + fee, "Pool: insufficient stable liquidity");

        state.accumulatedFees += fee;
        state.rwaReserve += rwaAmountIn;
        state.stableReserve -= (stableOut + fee);

        address recipient = msg.sender == tradeGuard ? tx.origin : msg.sender;

        IERC20(state.rwaToken).safeTransferFrom(msg.sender, address(this), rwaAmountIn);
        IERC20(state.stableToken).safeTransfer(recipient, stableOut);

        emit Swap(recipient, state.rwaToken, state.stableToken, rwaAmountIn, stableOut, price);
    }

    function mintFromGateway(address lp, uint256 stableAmount) external nonReentrant onlyGatewayKeeper whenNotPaused updateReward(lp) {
        IERC20(state.stableToken).safeTransferFrom(msg.sender, address(this), stableAmount);

        (int256 price, ) = priceOracle.getPrice(state.rwaToken);
        require(price > 0, "Pool: invalid oracle price");

        // Minting from Gateway is single-sided liquidity in USDC
        // This calculates how many shares they get for just USDC
        // Without requiring an RWA deposit
        uint256 shares = stableAmount;

        lpShares[lp] += shares;
        totalShares += shares;

        if (!isLP[lp]) {
            isLP[lp] = true;
            lpList.push(lp);
        }

        state.stableReserve += stableAmount;

        emit LiquidityAddedFromGateway(lp, stableAmount, shares);
    }

    function claimYield() external nonReentrant updateReward(msg.sender) returns (uint256) {
        uint256 pendingYield = rewards[msg.sender];
        require(pendingYield > 0, "Pool: no pending yield");

        rewards[msg.sender] = 0;
        IERC20(state.stableToken).safeTransfer(msg.sender, pendingYield);
        
        emit YieldClaimed(msg.sender, pendingYield);

        return pendingYield;
    }

    function pause() external onlyOwner {
        state.paused = true;
    }

    function unpause() external onlyOwner {
        state.paused = false;
    }
}
