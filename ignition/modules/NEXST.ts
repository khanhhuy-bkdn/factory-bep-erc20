import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NEXSTModule", (m: any) => {
  const nexst = m.contract("NEXST", ["NEXST", "NXT", 18, "300000000000000000000000000", "0x907A2A06Ac8E8DdC743E61aF779A0Af2A8456CD6", "600000000000000000000000000"]);

  return { nexst };
});