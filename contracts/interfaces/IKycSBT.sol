// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IKycSBT {
    enum KycLevel { NONE, BASIC, ADVANCED, PREMIUM, ULTIMATE }
    enum KycStatus { NONE, APPROVED, REVOKED }

    function getKycInfo(address account) external view returns (
        string memory ensName,
        KycLevel level,
        KycStatus status,
        uint256 createTime
    );
    function isHuman(address account) external view returns (bool, uint8);
}
