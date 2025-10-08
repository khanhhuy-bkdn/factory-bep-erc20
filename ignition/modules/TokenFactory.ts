import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m: any) => {
  const factory = m.contract("TokenFactory");

  return { factory };
});