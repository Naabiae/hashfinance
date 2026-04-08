// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRWAToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function setKYCRegistry(address registry) external;
    function pause() external;
    function unpause() external;
    function getAssetMetadata() external view returns (string memory name, string memory assetType, uint256 navPerToken, uint256 lastUpdated);
}
