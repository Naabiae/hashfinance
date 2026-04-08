// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceOracle {
    function getPrice(address token) external view returns (int256 price, uint256 timestamp);
}
