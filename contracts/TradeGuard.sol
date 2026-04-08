// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRWAPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IRWAPoolState {
    function state() external view returns (
        address rwaToken,
        address stableToken,
        uint256 rwaReserve,
        uint256 stableReserve,
        uint256 spreadBps,
        uint256 feeBps,
        uint256 accumulatedFees,
        bool paused
    );
}

contract TradeGuard is Ownable {
    using SafeERC20 for IERC20;

    struct TradeCommitment {
        bytes32 paramHash;
        address user;
        uint256 commitBlock;
        uint256 expireBlock;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32 => TradeCommitment) public commitments;

    uint256 public DELAY_BLOCKS = 2;
    uint256 public MAX_DELAY_BLOCKS = 50;
    uint256 public LARGE_SWAP_THRESHOLD = 10_000e6; // 10,000 USDC
    IRWAPool public pool;

    event SwapCommitted(bytes32 indexed commitId, address indexed user, uint256 commitBlock);
    event SwapExecuted(bytes32 indexed commitId, address indexed user, uint256 amountIn, uint256 amountOut);
    event SwapCancelled(bytes32 indexed commitId, address indexed user);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(address _pool) Ownable(msg.sender) {
        pool = IRWAPool(_pool);
    }

    function commitSwap(bytes32 paramHash) external returns (bytes32 commitId) {
        commitId = keccak256(abi.encodePacked(paramHash, block.number, msg.sender));
        
        commitments[commitId] = TradeCommitment({
            paramHash: paramHash,
            user: msg.sender,
            commitBlock: block.number,
            expireBlock: block.number + MAX_DELAY_BLOCKS,
            executed: false,
            cancelled: false
        });

        emit SwapCommitted(commitId, msg.sender, block.number);
        return commitId;
    }

    function executeSwap(
        bytes32 commitId,
        address tokenIn,
        uint256 amountIn,
        uint256 minOut,
        uint256 nonce
    ) external {
        TradeCommitment storage commitment = commitments[commitId];
        require(commitment.user != address(0), "TradeGuard: invalid commit");
        require(!commitment.executed, "TradeGuard: already executed");
        require(!commitment.cancelled, "TradeGuard: cancelled");
        require(block.number >= commitment.commitBlock + DELAY_BLOCKS, "TradeGuard: too early");
        require(block.number <= commitment.expireBlock, "TradeGuard: commitment expired");
        require(commitment.user == msg.sender, "TradeGuard: hash mismatch");

        bytes32 computedHash = hashSwapParams(msg.sender, tokenIn, amountIn, minOut, nonce);
        require(computedHash == commitment.paramHash, "TradeGuard: hash mismatch");

        commitment.executed = true;

        // TradeGuard acts as a router
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(pool), amountIn);

        (, address stableToken, , , , , , ) = IRWAPoolState(address(pool)).state();

        // Let's track balances to emit actual amountOut
        // But since we just route, amountOut is exactly what recipient gets
        // However pool emits the actual amount. We can just emit 0 or minOut for now, 
        // or check balance before/after. Since recipient is tx.origin, checking balance is safe.
        // Actually recipient is tx.origin in pool: "address recipient = msg.sender == tradeGuard ? tx.origin : msg.sender;"
        // So tokens go to msg.sender (which is tx.origin if EOA).

        if (tokenIn == stableToken) {
            pool.swapStableForRWA(amountIn, minOut);
        } else {
            pool.swapRWAForStable(amountIn, minOut);
        }

        emit SwapExecuted(commitId, msg.sender, amountIn, minOut); // using minOut as placeholder
    }

    function cancelSwap(bytes32 commitId) external {
        TradeCommitment storage commitment = commitments[commitId];
        require(commitment.user == msg.sender, "TradeGuard: not owner");
        require(!commitment.executed, "TradeGuard: already executed");
        require(!commitment.cancelled, "TradeGuard: cancelled");

        commitment.cancelled = true;
        emit SwapCancelled(commitId, msg.sender);
    }

    function hashSwapParams(
        address user,
        address tokenIn,
        uint256 amountIn,
        uint256 minOut,
        uint256 nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, tokenIn, amountIn, minOut, nonce));
    }
}
