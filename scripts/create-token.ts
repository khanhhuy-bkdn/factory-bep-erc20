import { network } from "hardhat";

// Usage examples:
//   NETWORK=hardhat CHAIN_TYPE=op npx hardhat run scripts/create-token.ts
//   npx hardhat run scripts/create-token.ts --network localhost
//   npx hardhat run scripts/create-token.ts --network sepolia
// Args (optional): name symbol decimals initialSupply cap factoryAddress

const connectOptions: any = {};
if (process.env.NETWORK) connectOptions.network = process.env.NETWORK;
if (process.env.CHAIN_TYPE) connectOptions.chainType = process.env.CHAIN_TYPE;

const { ethers } = await network.connect(connectOptions);

console.log("Creating token using TokenFactory");

const [
  nameArg,
  symbolArg,
  decimalsArg,
  initialSupplyArg,
  capArg,
  factoryAddressArg,
] = process.argv.slice(2);

const NAME = nameArg ?? "Essential";
const SYMBOL = symbolArg ?? "ESS";
const DECIMALS = decimalsArg ? Number(decimalsArg) : 6;
const INITIAL_SUPPLY = initialSupplyArg ? BigInt(initialSupplyArg) : 0n;
const CAP = capArg ? BigInt(capArg) : 0n;
const FACTORY_ADDRESS = factoryAddressArg ?? undefined;

const [sender] = await ethers.getSigners();
console.log("Sender:", sender.address);

let factory = FACTORY_ADDRESS
  ? await ethers.getContractAt("TokenFactory", FACTORY_ADDRESS)
  : await ethers.deployContract("TokenFactory");

if (!FACTORY_ADDRESS) {
  await factory.waitForDeployment();
  console.log("Deployed TokenFactory at:", await factory.getAddress());
} else {
  console.log("Using existing TokenFactory at:", await factory.getAddress());
}

console.log(
  "Calling createToken with:",
  JSON.stringify(
    { NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY: INITIAL_SUPPLY.toString(), CAP: CAP.toString() },
    null,
    2
  )
);

const tx = await factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP);
console.log("Submitted createToken tx:", tx.hash);
const receipt = await tx.wait();
console.log("createToken mined in block:", receipt!.blockNumber);

let tokenAddr: string | undefined;
for (const l of receipt!.logs) {
  try {
    const parsed = factory.interface.parseLog(l);
    if (parsed && parsed.name === "TokenCreated") {
      tokenAddr = parsed.args.token;
      console.log("TokenCreated event → token:", tokenAddr);
      break;
    }
  } catch (_) {}
}

if (!tokenAddr) {
  const count = await factory.getTokenCount();
  const last = await factory.getTokens(count - 1n, 1n);
  tokenAddr = last[0];
  console.log("Fallback discovered token address:", tokenAddr);
}

if (!tokenAddr) {
  throw new Error("Could not determine created token address");
}

const token = await ethers.getContractAt("BEP20Token", tokenAddr);
console.log("Token info:");
console.log("- address:", tokenAddr);
console.log("- name:", await token.name());
console.log("- symbol:", await token.symbol());
console.log("- decimals:", await token.decimals());
console.log("- totalSupply:", (await token.totalSupply()).toString());
console.log("- owner balance:", (await token.balanceOf(sender.address)).toString());

console.log("Done.");