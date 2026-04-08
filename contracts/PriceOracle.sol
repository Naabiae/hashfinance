// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/AggregatorV3Interface.sol";

contract PriceOracle is IPriceOracle, Ownable {
    mapping(address => address) public tokenToFeed;
    mapping(address => PriceData) public priceStore;

    struct PriceData {
        int256 price;
        uint256 timestamp;
        uint256 roundId;
        bool active;
    }

    uint256 public MAX_STALENESS = 86400; // 24 hours
    uint256 public MAX_DEVIATION = 500;   // 5%
    bool public circuitBreaker = false;
    address public keeper;

    event PricePushed(address indexed token, int256 price, uint256 timestamp);
    event DeviationAlert(address indexed token, int256 oldPrice, int256 newPrice, uint256 deviationBps);
    event CircuitBreakerTripped(address indexed token, string reason);
    event CircuitBreakerReset(address indexed by);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);

    modifier onlyKeeper() {
        require(msg.sender == keeper || msg.sender == owner(), "Oracle: only keeper");
        _;
    }

    constructor() Ownable(msg.sender) {
        keeper = msg.sender;
    }

    function getPrice(address token) external view returns (int256 price, uint256 timestamp) {
        require(!circuitBreaker, "Oracle: circuit breaker active");

        if (tokenToFeed[token] != address(0)) {
            (, int256 answer, , uint256 updatedAt, ) = AggregatorV3Interface(tokenToFeed[token]).latestRoundData();
            price = answer;
            timestamp = updatedAt;
        } else {
            PriceData memory data = priceStore[token];
            require(data.active, "Oracle: no price data");
            price = data.price;
            timestamp = data.timestamp;
        }

        require(block.timestamp - timestamp <= MAX_STALENESS, "Oracle: stale price");
        return (price, timestamp);
    }

    function pushRWAPrice(address token, int256 price, uint256 timestamp) external onlyKeeper {
        require(timestamp > priceStore[token].timestamp, "Oracle: timestamp must be newer");

        int256 oldPrice = priceStore[token].price;
        if (oldPrice > 0) {
            int256 diff = price > oldPrice ? price - oldPrice : oldPrice - price;
            uint256 deviation = uint256(diff) * 10000 / uint256(oldPrice);
            
            if (deviation > MAX_DEVIATION) {
                emit DeviationAlert(token, oldPrice, price, deviation);
                circuitBreaker = true;
                emit CircuitBreakerTripped(token, "Max deviation exceeded");
            }
        }

        priceStore[token] = PriceData({
            price: price,
            timestamp: timestamp,
            roundId: priceStore[token].roundId + 1,
            active: true
        });

        emit PricePushed(token, price, timestamp);
    }

    function resetCircuitBreaker() external onlyOwner {
        circuitBreaker = false;
        emit CircuitBreakerReset(msg.sender);
    }

    function setMaxStaleness(uint256 seconds_) external onlyOwner {
        MAX_STALENESS = seconds_;
    }

    function setMaxDeviation(uint256 bps) external onlyOwner {
        MAX_DEVIATION = bps;
    }

    function registerFeed(address token, address feed) external onlyOwner {
        tokenToFeed[token] = feed;
    }

    function setKeeper(address _keeper) external onlyOwner {
        address oldKeeper = keeper;
        keeper = _keeper;
        emit KeeperUpdated(oldKeeper, _keeper);
    }
}
