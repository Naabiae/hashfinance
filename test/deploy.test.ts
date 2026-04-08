import { expect } from "chai";
import { ethers } from "hardhat";
import { 
    KYCRegistry, 
    RWAToken, 
    PriceOracle, 
    RWAPool, 
    TradeGuard 
} from "../typechain-types";

describe("Module 1: Smart Contracts Deployment & Verification", function () {
    let kycRegistry: KYCRegistry;
    let rwaToken: RWAToken;
    let priceOracle: PriceOracle;
    let pool: RWAPool;
    let tradeGuard: TradeGuard;

    let owner: any;
    let user1: any;
    let user2: any;

    before(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // 1. Deploy KYCRegistry
        // We'll use a dummy address for the SBT on the mainnet fork for this test
        const MockSBTFactory = await ethers.getContractFactory("MockKycSBT"); const mockSBT = await MockSBTFactory.deploy(); await mockSBT.waitForDeployment(); const dummySBT = await mockSBT.getAddress();
        const KYCRegistryFactory = await ethers.getContractFactory("KYCRegistry");
        kycRegistry = await KYCRegistryFactory.deploy(dummySBT);
        await kycRegistry.waitForDeployment();
        console.log("KYCRegistry deployed to:", await kycRegistry.getAddress());

        // 2. Deploy RWAToken
        const RWATokenFactory = await ethers.getContractFactory("RWAToken");
        rwaToken = await RWATokenFactory.deploy(
            "HashKey RWA Token",
            "hkRWA",
            "BOND",
            "US1234567890",
            await kycRegistry.getAddress()
        );
        await rwaToken.waitForDeployment();
        console.log("RWAToken deployed to:", await rwaToken.getAddress());

        // 3. Deploy PriceOracle
        const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
        priceOracle = await PriceOracleFactory.deploy();
        await priceOracle.waitForDeployment();
        console.log("PriceOracle deployed to:", await priceOracle.getAddress());

        // 4. Deploy RWAPool
        const mockStable = ethers.Wallet.createRandom().address; // USDC Mock
        const feeRecipient = owner.address;
        
        const RWAPoolFactory = await ethers.getContractFactory("RWAPool");
        pool = await RWAPoolFactory.deploy(
            await rwaToken.getAddress(),
            mockStable,
            await kycRegistry.getAddress(),
            await priceOracle.getAddress(),
            feeRecipient
        );
        await pool.waitForDeployment();
        console.log("RWAPool deployed to:", await pool.getAddress());

        // 5. Deploy TradeGuard
        const TradeGuardFactory = await ethers.getContractFactory("TradeGuard");
        tradeGuard = await TradeGuardFactory.deploy(await pool.getAddress());
        await tradeGuard.waitForDeployment();
        console.log("TradeGuard deployed to:", await tradeGuard.getAddress());

        // 6. Set TradeGuard in Pool
        await pool.setTradeGuard(await tradeGuard.getAddress());
    });

    it("Should have correct initialization", async function () {
        expect(await kycRegistry.kycSBTAddress()).to.not.be.empty;
        expect(await rwaToken.name()).to.equal("HashKey RWA Token");
        expect(await pool.tradeGuard()).to.equal(await tradeGuard.getAddress());
    });

    it("Should whitelist institutional LP", async function () {
        await kycRegistry.setInstitutionalLP(user1.address, true);
        expect(await kycRegistry.institutionalLP(user1.address)).to.be.true;
        
        // They should bypass standard SBT checks
        expect(await kycRegistry.isVerified(user1.address, 2)).to.be.true;
    });

    it("Should allow Minter to mint RWATokens to verified users", async function () {
        // user1 is verified (as institutional LP)
        await rwaToken.mint(user1.address, ethers.parseUnits("1000", 18));
        expect(await rwaToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("1000", 18));
    });

    it("Should reject transfers to unverified users", async function () {
        // user2 is not verified
        await expect(
            rwaToken.connect(user1).transfer(user2.address, ethers.parseUnits("100", 18))
        ).to.be.revertedWith("KYC: verification required");
    });
});
