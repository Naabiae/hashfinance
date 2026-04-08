// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./interfaces/IKycSBT.sol";

contract MockKycSBT is IKycSBT {
    mapping(address => KycLevel) public levels;
    mapping(address => KycStatus) public statuses;

    function setKyc(address account, KycLevel level, KycStatus status) external {
        levels[account] = level;
        statuses[account] = status;
    }

    function getKycInfo(address account) external view returns (
        string memory ensName,
        KycLevel level,
        KycStatus status,
        uint256 createTime
    ) {
        return ("mock.ens", levels[account], statuses[account], block.timestamp);
    }

    function isHuman(address account) external view returns (bool, uint8) {
        return (true, 1);
    }
}
