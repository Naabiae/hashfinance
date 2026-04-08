// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IKYCRegistry.sol";
import "./interfaces/IRWAToken.sol";

contract RWAToken is ERC20, Ownable, IRWAToken {
    IKYCRegistry public kycRegistry;
    string public assetType;           
    string public isinCode;            
    uint256 public navPerToken;        
    uint256 public navLastUpdated;     
    address public minter;             
    bool public paused;

    event ComplianceCheck(address indexed from, address indexed to, bool passed, string reason);
    event NAVUpdated(uint256 oldNAV, uint256 newNAV, uint256 timestamp);
    event KYCRegistryUpdated(address indexed newRegistry);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == minter || msg.sender == owner(), "RWAToken: only minter or owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "RWAToken: paused");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory _assetType,
        string memory _isinCode,
        address _kycRegistry
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        assetType = _assetType;
        isinCode = _isinCode;
        kycRegistry = IKYCRegistry(_kycRegistry);
        minter = msg.sender;
    }

    function setKYCRegistry(address registry) external onlyOwner {
        kycRegistry = IKYCRegistry(registry);
        emit KYCRegistryUpdated(registry);
    }

    function setMinter(address _minter) external onlyOwner {
        address oldMinter = minter;
        minter = _minter;
        emit MinterUpdated(oldMinter, _minter);
    }

    function updateNAV(uint256 newNAV, uint256 timestamp) external onlyMinter {
        require(timestamp > navLastUpdated, "RWAToken: timestamp must be > last updated");
        uint256 oldNAV = navPerToken;
        navPerToken = newNAV;
        navLastUpdated = timestamp;
        emit NAVUpdated(oldNAV, newNAV, timestamp);
    }

    function mint(address to, uint256 amount) external onlyMinter whenNotPaused {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMinter whenNotPaused {
        _burn(from, amount);
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function getAssetMetadata() external view returns (string memory, string memory, uint256, uint256) {
        return (name(), assetType, navPerToken, navLastUpdated);
    }

    function _update(address from, address to, uint256 amount) internal virtual override whenNotPaused {
        if (to != address(0) && from != address(0)) {
            // transfer
            if (!kycRegistry.isVerified(to, 1)) {
                emit ComplianceCheck(from, to, false, "KYC: verification required");
                revert("KYC: verification required");
            }
            emit ComplianceCheck(from, to, true, "KYC: verified");
        } else if (from == address(0)) {
            // mint
            if (!kycRegistry.isVerified(to, 2)) {
                emit ComplianceCheck(from, to, false, "KYC: ADVANCED required for mint");
                revert("KYC: ADVANCED required for mint");
            }
            emit ComplianceCheck(from, to, true, "KYC: verified");
        }

        super._update(from, to, amount);
    }
}
