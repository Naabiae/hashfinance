// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IKycSBT.sol";
import "./interfaces/IKYCRegistry.sol";

contract KYCRegistry is IKYCRegistry, Ownable {
    address public kycSBTAddress;
    mapping(address => bool) public institutionalLP;
    bool public paused;

    event KYCSBTUpdated(address indexed oldAddress, address indexed newAddress);
    event InstitutionalLPSet(address indexed lp, bool status);
    event RegistryPaused(address indexed by);
    event RegistryUnpaused(address indexed by);

    modifier whenNotPaused() {
        require(!paused, "KYC: registry paused");
        _;
    }

    constructor(address _kycSBTAddress) Ownable(msg.sender) {
        kycSBTAddress = _kycSBTAddress;
    }

    function isVerified(address user, uint8 minLevel) external view whenNotPaused returns (bool) {
        if (institutionalLP[user]) return true;

        try IKycSBT(kycSBTAddress).getKycInfo(user) returns (
            string memory,
            IKycSBT.KycLevel level,
            IKycSBT.KycStatus status,
            uint256
        ) {
            if (status == IKycSBT.KycStatus.REVOKED || status == IKycSBT.KycStatus.NONE) {
                return false;
            }
            return uint8(level) >= minLevel;
        } catch {
            return false;
        }
    }

    function getLevel(address user) external view returns (uint8) {
        if (institutionalLP[user]) return 4; // ULTIMATE equivalent

        try IKycSBT(kycSBTAddress).getKycInfo(user) returns (
            string memory,
            IKycSBT.KycLevel level,
            IKycSBT.KycStatus,
            uint256
        ) {
            return uint8(level);
        } catch {
            return 0;
        }
    }

    function isRevoked(address user) external view returns (bool) {
        try IKycSBT(kycSBTAddress).getKycInfo(user) returns (
            string memory,
            IKycSBT.KycLevel,
            IKycSBT.KycStatus status,
            uint256
        ) {
            return status == IKycSBT.KycStatus.REVOKED;
        } catch {
            return false;
        }
    }

    function updateKYCSBT(address newAddress) external onlyOwner {
        address oldAddress = kycSBTAddress;
        kycSBTAddress = newAddress;
        emit KYCSBTUpdated(oldAddress, newAddress);
    }

    function setInstitutionalLP(address lp, bool status) external onlyOwner {
        institutionalLP[lp] = status;
        emit InstitutionalLPSet(lp, status);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        if (_paused) {
            emit RegistryPaused(msg.sender);
        } else {
            emit RegistryUnpaused(msg.sender);
        }
    }
}
