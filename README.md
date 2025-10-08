# Factory Token (Hardhat v3, Ethers v6)

A practical project that implements a `TokenFactory` and a `BEP20Token` with input validation, capped supply, mint/burn, pause/unpause, blacklist, native/ERC20 rescue, creation fee, access control, and paginated token listing to reduce gas.

## Overview
- `contracts/BEP20Token.sol`: ERC20 with custom `decimals`, `cap`, `mint/burn`, `pause`, `blacklist`, and `rescueTokens` for native coin and ERC20.
  - Custom errors: `SenderBlacklisted`, `RecipientBlacklisted`, `InvalidRecipient`, `TokenTransferFailed`.
  - Includes a `receive()` function so the contract can accept native coin for rescue.
- `contracts/TokenFactory.sol`: Creates tokens with input validation (`EmptyName`, `EmptySymbol`, `InvalidCap`), fee (`createFee` with `FeeTooLow`), access control (`publicCreate`, `authorizedCreator` with `NotAuthorized`), and events: `TokenCreated`, `CreateFeeSet`, `FeeRecipientSet`, `PublicCreateSet`, `AuthorizedCreatorSet`, `FeeCharged`.
  - Pagination helpers: `getTokenCount()`, `getTokenAt(index)`, `getTokens(start, size)`.
- `ignition/modules/TokenFactory.ts`: Ignition deployment module for `TokenFactory`.
- `scripts/create-token.ts`: CLI script to create tokens via `TokenFactory`.
- `test/*`: Tests for both token and factory (events, validation, fee, access control, rescue).

## Requirements
- Node.js 18+ and npm

## Setup
- Install dependencies: `npm install`
- Create `.env` from `.env.example` and set:
  - `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`
  - `BSC_TESTNET_RPC_URL`, `BSC_TESTNET_PRIVATE_KEY`
  - `BSC_MAINNET_RPC_URL`, `BSC_MAINNET_PRIVATE_KEY`

If you don’t use BSC, you can temporarily comment out BSC networks in `hardhat.config.ts` to avoid configuration errors during local testing.

## Compile
- `npx hardhat compile`

## Test
- Run all: `npx hardhat test`
- Filter by group: `npx hardhat test -g TokenFactory` or `-g BEP20Token`

Note: If you see `HHE15` related to missing `accounts/url` on BSC networks, set the environment variables above or comment those networks when testing locally.

## Networks
- `sepolia`, `bscTestnet`, `bsc` (mainnet). Select using `--network <name>`.

## Deploy with Ignition
Deploy `TokenFactory` to Sepolia:
```
npx hardhat ignition deploy --network sepolia ./ignition/modules/TokenFactory.ts
```

## Create Token Script
Script: `scripts/create-token.ts`

CLI parameters:
- `--name`, `--symbol`, `--decimals`, `--initialSupply`, `--cap`, `--factory`

Example (Sepolia):
```
npx hardhat run scripts/create-token.ts --network sepolia -- \
  --name "Sample Token" --symbol "SPT" --decimals 18 \
  --initialSupply 1000000000000000000000 \
  --cap 2000000000000000000000 \
  --factory 0xYourFactoryAddress
```

Fee & authorization notes:
- If `createFee > 0`, send `msg.value >= createFee` with `createToken`.
- If `publicCreate == false`, only addresses authorized via `setAuthorizedCreator` can create tokens.
- The script assumes zero fee by default; if you configure a fee, pass `{ value: fee }` when calling.

## Key Events
- Factory: `TokenCreated`, `CreateFeeSet`, `FeeRecipientSet`, `PublicCreateSet`, `AuthorizedCreatorSet`, `FeeCharged`
- Token: `BlacklistUpdated`

## Rescue Tokens (Token)
- `onlyOwner` can call `rescueTokens(token, to, amount)`:
  - Native coin: `token == address(0)` transfers native coin from the contract to `to`.
  - ERC20: uses `IERC20(token).transfer(to, amount)`; if it returns `false`, reverts with `TokenTransferFailed`.
  - The contract can receive native coin via `receive()`.

## Troubleshooting
- `HHE15`: network configuration incomplete. Set environment variables or comment the network.
- `FeeTooLow`: send `msg.value` that meets `createFee` or set fee to 0.
- `NotAuthorized`: enable `publicCreate` or authorize the caller.

## Notes
- Ethers v6, Hardhat v3 beta, Mocha.
- Built on OpenZeppelin ERC20.