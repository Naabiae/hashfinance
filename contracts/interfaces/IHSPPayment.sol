// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IHSPPayment {
    function batchStream(address[] calldata recipients, uint256[] calldata amounts) external;
}
