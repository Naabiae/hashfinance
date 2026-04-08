import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://mainnet.hsk.xyz",
      },
      chainId: 177
    },
    hashkeyTestnet: {
      url: "https://hk-testnet.rpc.alt.technology",
      chainId: 133,
    },
    hashkeyMainnet: {
      url: "https://mainnet.hsk.xyz",
      chainId: 177,
    }
  },
};

export default config;
