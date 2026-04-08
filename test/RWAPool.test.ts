import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("RWAPool & PayFi Integrations", function () {
    let kycRegistry: any;
    let rwaToken: any;
    let stableToken: any;
    let priceOracle: any;
    let rwaPool: any;
    let tradeGuard: any;

    let owner: any;
    let lp: any;
    let trader: any;
    let gatewayKeeper: any;

    const MIN_LP_LEVEL = 2;
    const MIN_SWAP_LEVEL = 1;

    beforeEach(async function () {
        [owner, lp, trader, gatewayKeeper] = await ethers.getSigners();

        // Deploy Mock SBT First
        const MockSBTFactory = await ethers.getContractFactory("MockKycSBT");
        const mockSBT = await MockSBTFactory.deploy();
        await mockSBT.waitForDeployment();
        const dummySBT = await mockSBT.getAddress();

        // Deploy Mock KYC Registry
        const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
        kycRegistry = await KYCRegistry.deploy(dummySBT);

        // Mock KYC Levels
        await kycRegistry.setInstitutionalLP(lp.address, true); // Override level
        await kycRegistry.setInstitutionalLP(trader.address, true); 
        await kycRegistry.setInstitutionalLP(gatewayKeeper.address, true);

        // Deploy Mock Tokens
        // We can't use generic ERC20 mock easily because it needs mint, 
        // we'll just deploy a basic ERC20 or use a simpler mock if available.
        // Actually RWAToken is an ERC20 with minter role. We'll deploy two RWATokens for both stable and RWA
        const TokenDeployer = await ethers.getContractFactory("RWAToken");

        stableToken = await TokenDeployer.deploy(
            "Mock Stable",
            "USDC",
            "STABLE",
            "US123",
            kycRegistry.target
        );
        rwaToken = await TokenDeployer.deploy(
            "Mock RWA",
            "RWA",
            "BOND",
            "US456",
            kycRegistry.target
        );

        await stableToken.setMinter(owner.address);
        await rwaToken.setMinter(owner.address);

        await stableToken.connect(owner).mint(lp.address, ethers.parseUnits("100000", 6));
        await rwaToken.connect(owner).mint(lp.address, ethers.parseUnits("1000", 8));
        await stableToken.connect(owner).mint(trader.address, ethers.parseUnits("10000", 6));
        await stableToken.connect(owner).mint(gatewayKeeper.address, ethers.parseUnits("10000", 6));

        // Deploy Mock Oracle
        const PriceOracle = await ethers.getContractFactory("PriceOracle");
        priceOracle = await PriceOracle.deploy();
        
        // Push initial price: 1 RWA = $100.00
        const latestBlock = await ethers.provider.getBlock("latest");
        const blockTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
        await priceOracle.pushRWAPrice(rwaToken.target, ethers.parseUnits("100", 8), blockTimestamp - 1);

        // Deploy Pool
        const RWAPool = await ethers.getContractFactory("RWAPool");
        rwaPool = await RWAPool.deploy(
            rwaToken.target,
            stableToken.target,
            kycRegistry.target,
            priceOracle.target,
            owner.address // feeRecipient
        );

        // Deploy TradeGuard
        const TradeGuard = await ethers.getContractFactory("TradeGuard");
        tradeGuard = await TradeGuard.deploy(rwaPool.target);

        // Setup Pool Roles
        await rwaPool.setTradeGuard(tradeGuard.target);
        await rwaPool.setGatewayKeeper(gatewayKeeper.address);

        // Setup Token Roles
        await rwaToken.setMinter(rwaPool.target);
        // Pool needs to mint stable token? No, pool doesn't mint stable token. But let's leave it.

        // The pool itself needs to be verified or bypassed because RWAToken hook checks recipient!
        await kycRegistry.setInstitutionalLP(rwaPool.target, true);
        await stableToken.connect(lp).approve(rwaPool.target, ethers.MaxUint256);
        await rwaToken.connect(lp).approve(rwaPool.target, ethers.MaxUint256);
        await stableToken.connect(trader).approve(rwaPool.target, ethers.MaxUint256);
    });

    describe("PayFi / Merchant API Flow", function () {
        it("Should allow GatewayKeeper to mint LP shares for fiat deposit", async function () {
            const stableAmount = ethers.parseUnits("5000", 6);
            
            // Keeper deposits the USDC directly (simulating HashKey settlement)
            await stableToken.connect(gatewayKeeper).approve(rwaPool.target, stableAmount);

            // Keeper calls mintFromGateway for the user who paid via PayFi checkout
            await expect(rwaPool.connect(gatewayKeeper).mintFromGateway(lp.address, stableAmount))
                .to.emit(rwaPool, "LiquidityAddedFromGateway")
                .withArgs(lp.address, stableAmount, stableAmount);

            const shares = await rwaPool.lpShares(lp.address);
            expect(shares).to.equal(stableAmount); // Single-sided deposit formula in RWAPool
            
            const poolStableReserve = (await rwaPool.state())[3]; // stableReserve is index 3
            expect(poolStableReserve).to.equal(stableAmount);
        });

        it("Should revert mintFromGateway if called by non-keeper", async function () {
            const stableAmount = ethers.parseUnits("1000", 6);
            await expect(
                rwaPool.connect(trader).mintFromGateway(lp.address, stableAmount)
            ).to.be.revertedWith("Pool: only gateway keeper");
        });
    });

    describe("DeFi Flow", function () {
        it("Should allow verified LP to add liquidity directly", async function () {
            const stableAmount = ethers.parseUnits("10000", 6);
            const rwaAmount = ethers.parseUnits("100", 8); // 100 RWA = $10000

            await expect(rwaPool.connect(lp).addLiquidity(rwaAmount, stableAmount))
                .to.emit(rwaPool, "LiquidityAdded");

            // 10000 stable + (100 RWA * 100 oracle price) = 20000 shares
            const shares = await rwaPool.lpShares(lp.address);
            expect(shares).to.equal(ethers.parseUnits("20000", 6));
        });

        it("Should allow verified Trader to swap", async function () {
            // First add liquidity
            await rwaPool.connect(lp).addLiquidity(ethers.parseUnits("100", 8), ethers.parseUnits("10000", 6));

            // Trader swaps 1000 USDC for RWA
            const stableIn = ethers.parseUnits("1000", 6);
            
            await expect(rwaPool.connect(trader).swapStableForRWA(stableIn, 0))
                .to.emit(rwaPool, "Swap");

            const traderRwaBalance = await rwaToken.balanceOf(trader.address);
            expect(traderRwaBalance).to.be.gt(0);
            
            const poolState = await rwaPool.state();
            expect(poolState[6]).to.be.gt(0); // accumulatedFees is index 6
        });
    });
});
