// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IKYCRegistry {
    function isVerified(address user, uint8 minLevel) external view returns (bool);
    function getLevel(address user) external view returns (uint8);
    function isRevoked(address user) external view returns (bool);
}
