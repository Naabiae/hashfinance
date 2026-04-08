// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRWAPool {
    function addLiquidity(uint256 rwaAmount, uint256 stableAmount) external;
    function removeLiquidity(uint256 shares) external;
    function swapStableForRWA(uint256 stableAmountIn, uint256 minRWAOut) external;
    function swapRWAForStable(uint256 rwaAmountIn, uint256 minStableOut) external;
    function distributeYield() external;
    function setTradeGuard(address tradeGuard) external;
}
