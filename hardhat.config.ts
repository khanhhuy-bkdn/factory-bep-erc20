import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatVerify],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    bscTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.BSC_TESTNET_RPC_URL || "",
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY || ""],
      chainId: 97,
    },
    bsc: {
      type: "http",
      chainType: "l1",
      url: process.env.BSC_MAINNET_RPC_URL || "",
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY || ""],
      chainId: 56,
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
    blockscout: {
      enabled: false,
    },
  },
};

export default config;
