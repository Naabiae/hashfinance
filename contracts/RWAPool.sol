// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IKYCRegistry.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IHSPPayment.sol";
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
        bool paused;
    }

    PoolState public state;
    mapping(address => uint256) public lpShares;
    address[] public lpList;
    mapping(address => bool) public isLP;
    uint256 public totalShares;
    
    IKYCRegistry public kycRegistry;
    IPriceOracle public priceOracle;
    IHSPPayment public hspPayment;
    address public feeRecipient;
    address public tradeGuard;

    uint256 public MIN_LP_LEVEL = 2;
    uint256 public MIN_SWAP_LEVEL = 1;

    event LiquidityAdded(address indexed lp, uint256 rwaAmount, uint256 stableAmount, uint256 shares);
    event LiquidityRemoved(address indexed lp, uint256 rwaAmount, uint256 stableAmount, uint256 shares);
    event Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, int256 executionPrice);
    event YieldDistributed(uint256 totalAmount, uint256 recipientCount);
    event SpreadUpdated(uint256 oldBps, uint256 newBps);

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

    modifier whenNotPaused() {
        require(!state.paused, "Pool: paused");
        _;
    }

    constructor(
        address _rwaToken,
        address _stableToken,
        address _kycRegistry,
        address _priceOracle,
        address _hspPayment,
        address _feeRecipient
    ) Ownable(msg.sender) {
        state.rwaToken = _rwaToken;
        state.stableToken = _stableToken;
        state.spreadBps = 30; // 0.30%
        state.feeBps = 10;    // 0.10%
        kycRegistry = IKYCRegistry(_kycRegistry);
        priceOracle = IPriceOracle(_priceOracle);
        hspPayment = IHSPPayment(_hspPayment);
        feeRecipient = _feeRecipient;
    }

    function setTradeGuard(address _tradeGuard) external onlyOwner {
        tradeGuard = _tradeGuard;
    }

    function addLiquidity(uint256 rwaAmount, uint256 stableAmount) external nonReentrant onlyVerified(uint8(MIN_LP_LEVEL)) whenNotPaused {
        IERC20(state.rwaToken).safeTransferFrom(msg.sender, address(this), rwaAmount);
        IERC20(state.stableToken).safeTransferFrom(msg.sender, address(this), stableAmount);

        (int256 price, ) = priceOracle.getPrice(state.rwaToken);
        require(price > 0, "Pool: invalid oracle price");

        uint256 rwaValueInStable = (rwaAmount * uint256(price)) / 1e8;
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

    function removeLiquidity(uint256 shares) external nonReentrant onlyVerified(uint8(MIN_LP_LEVEL)) whenNotPaused {
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

        uint256 rwaOut = (amountAfterFee * 1e8) / uint256(price);
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

        uint256 stableOut = (rwaAmountIn * uint256(price)) / 1e8;
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

    function distributeYield() external nonReentrant {
        uint256 fees = state.accumulatedFees;
        require(fees > 0, "Pool: no yield to distribute");
        require(totalShares > 0, "Pool: no LPs");

        state.accumulatedFees = 0;

        uint256 lpCount = lpList.length;
        address[] memory recipients = new address[](lpCount);
        uint256[] memory amounts = new uint256[](lpCount);

        uint256 actualDistributed = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < lpCount; i++) {
            address lp = lpList[i];
            uint256 shares = lpShares[lp];
            if (shares > 0) {
                uint256 amount = (fees * shares) / totalShares;
                if (amount > 0) {
                    recipients[count] = lp;
                    amounts[count] = amount;
                    actualDistributed += amount;
                    count++;
                }
            }
        }

        if (actualDistributed > 0) {
            address[] memory finalRecipients = new address[](count);
            uint256[] memory finalAmounts = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                finalRecipients[i] = recipients[i];
                finalAmounts[i] = amounts[i];
            }

            IERC20(state.stableToken).approve(address(hspPayment), actualDistributed);
            hspPayment.batchStream(finalRecipients, finalAmounts);
        }
        
        emit YieldDistributed(fees, count);
    }

    function pause() external onlyOwner {
        state.paused = true;
    }

    function unpause() external onlyOwner {
        state.paused = false;
    }
}
