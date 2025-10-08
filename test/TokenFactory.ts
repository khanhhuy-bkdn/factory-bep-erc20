import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("TokenFactory", function () {
  const NAME = "Essential";
  const SYMBOL = "ESS";
  const DECIMALS = 6;
  const INITIAL_SUPPLY = 1000n;
  const CAP = 2000n;

  it("creates tokens and emits TokenCreated", async function () {
    const [creator] = await ethers.getSigners();
    const factory = await ethers.deployContract("TokenFactory");

    const tx = await factory.createToken(
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      CAP
    );
    const receipt = await tx.wait();

    // find event
    const event = receipt!.logs
      .map((l) => factory.interface.parseLog(l))
      .find((e) => e && e.name === "TokenCreated");

    expect(event).to.not.be.undefined;
    const count = await factory.getTokenCount();
    const last = await factory.getTokens(count - 1n, 1n);
    const tokenAddr = last[0]!;
    const token = await ethers.getContractAt("BEP20Token", tokenAddr);

    expect(await token.name()).to.equal(NAME);
    expect(await token.symbol()).to.equal(SYMBOL);
    expect(await token.decimals()).to.equal(DECIMALS);
    expect(await token.balanceOf(creator.address)).to.equal(INITIAL_SUPPLY);
  });

  it("enforces cap via token minting", async function () {
    const [creator] = await ethers.getSigners();
    const factory = await ethers.deployContract("TokenFactory");
    await (await factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP)).wait();
    const count = await factory.getTokenCount();
    const last = await factory.getTokens(count - 1n, 1n);
    const tokenAddr = last[0]!;
    const token = await ethers.getContractAt("BEP20Token", tokenAddr);

    // mint up to cap
    const remaining = CAP - (await token.totalSupply());
    if (remaining > 0n) {
      await token.mint(creator.address, remaining);
    }
    await expect(token.mint(creator.address, 1n)).to.be.revertedWithCustomError(
      token,
      "ERC20ExceededCap"
    );
  });

  it("admin setter events and fee charged event", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const factory = await ethers.deployContract("TokenFactory");

    // set fee
    await expect(factory.setCreateFee(1n)).to.emit(factory, "CreateFeeSet").withArgs(1n);
    // set recipient
    await expect(factory.setFeeRecipient(recipient.address))
      .to.emit(factory, "FeeRecipientSet")
      .withArgs(recipient.address);
    // set public create
    await expect(factory.setPublicCreate(false)).to.emit(factory, "PublicCreateSet").withArgs(false);
    // authorize creator
    await expect(factory.setAuthorizedCreator(owner.address, true))
      .to.emit(factory, "AuthorizedCreatorSet")
      .withArgs(owner.address, true);

    // fee charged when creating
    const tx = await factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP, { value: 1n });
    const receipt = await tx.wait();
    const feeEvent = receipt!.logs
      .map((l) => factory.interface.parseLog(l))
      .find((e) => e && e.name === "FeeCharged");
    expect(feeEvent).to.not.be.undefined;
    expect(feeEvent!.args.payer).to.equal(owner.address);
    expect(feeEvent!.args.recipient).to.equal(recipient.address);
    expect(feeEvent!.args.amount).to.equal(1n);
  });

  it("reverts on invalid inputs and access control", async function () {
    const [creator] = await ethers.getSigners();
    const factory = await ethers.deployContract("TokenFactory");

    // empty name
    await expect(
      factory.createToken("", SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP)
    ).to.be.revertedWithCustomError(factory, "EmptyName");

    // empty symbol
    await expect(
      factory.createToken(NAME, "", DECIMALS, INITIAL_SUPPLY, CAP)
    ).to.be.revertedWithCustomError(factory, "EmptySymbol");

    // cap < initialSupply
    await expect(
      factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, INITIAL_SUPPLY - 1n)
    ).to.be.revertedWithCustomError(factory, "InvalidCap");

    // fee too low
    await factory.setCreateFee(2n);
    await expect(
      factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP, { value: 1n })
    ).to.be.revertedWithCustomError(factory, "FeeTooLow");

    // access control: disable public and not authorized
    await factory.setPublicCreate(false);
    await expect(
      factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP)
    ).to.be.revertedWithCustomError(factory, "NotAuthorized");

    // authorize and succeed (pay the configured fee)
    await factory.setAuthorizedCreator(creator.address, true);
    await (
      await factory.createToken(NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, CAP, { value: 2n })
    ).wait();
  });
});