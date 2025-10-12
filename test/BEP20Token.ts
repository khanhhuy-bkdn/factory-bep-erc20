import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("BEP20Token", function () {
  const NAME = "Essential";
  const SYMBOL = "ESS";
  const DECIMALS = 6;
  const INITIAL_SUPPLY = 1_000_000n; // in smallest units (depends on decimals)
  const CAP = 2_000_000n;

  it("sets custom decimals and mints initial supply", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    expect(await token.decimals()).to.equal(DECIMALS);
    expect(await token.balanceOf(deployer.address)).to.equal(INITIAL_SUPPLY);
  });

  it("reverts when initial supply exceeds cap", async function () {
    const [deployer] = await ethers.getSigners();
    await expect(
      ethers.deployContract("BEP20Token", [
        NAME,
        SYMBOL,
        DECIMALS,
        CAP + 1n,
        deployer.address,
        CAP,
      ])
    ).to.be.revertedWithCustomError(
      // custom error is defined in BEP20Token
      await ethers.getContractFactory("BEP20Token"),
      "InitialSupplyExceedsCap"
    );
  });

  it("owner can mint and burn; cap enforced", async function () {
    const [deployer, user] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    // mint to user
    await token.mint(user.address, 100n);
    expect(await token.balanceOf(user.address)).to.equal(100n);

    // burn from user (approve then burnFrom)
    await token.connect(user).approve(deployer.address, 50n);
    await token.burnFrom(user.address, 50n);
    expect(await token.balanceOf(user.address)).to.equal(50n);

    // push to cap
    const remaining = CAP - (await token.totalSupply());
    if (remaining > 0n) {
      await token.mint(deployer.address, remaining);
    }
    // exceeding cap should revert (OZ custom error)
    await expect(token.mint(deployer.address, 1n)).to.be.revertedWithCustomError(
      token,
      "ERC20ExceededCap"
    );
  });

  it("pause blocks transfers and unpause restores", async function () {
    const [deployer, user] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    // transfer works
    await token.transfer(user.address, 10n);
    expect(await token.balanceOf(user.address)).to.equal(10n);

    // pause blocks
    await token.pause();
    await expect(
      token.connect(user).transfer(deployer.address, 1n)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");

    // unpause
    await token.unpause();
    await token.connect(user).transfer(deployer.address, 1n);
    expect(await token.balanceOf(user.address)).to.equal(9n);
  });

  it("blacklist blocks send and receive", async function () {
    const [deployer, user, other] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    // fund user
    await token.transfer(user.address, 10n);

    // block sending from user
    await token.setBlacklist(user.address, true);
    await expect(
      token.connect(user).transfer(other.address, 1n)
    ).to.be.revertedWithCustomError(token, "SenderBlacklisted");

    // unblock and block recipient
    await token.setBlacklist(user.address, false);
    await token.setBlacklist(other.address, true);
    await expect(
      token.connect(user).transfer(other.address, 1n)
    ).to.be.revertedWithCustomError(token, "RecipientBlacklisted");
  });

  it("requires MINTER_ROLE to mint", async function () {
    const [deployer, other] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    // other is not a minter → should revert with AccessControlUnauthorizedAccount
    const MINTER_ROLE = ethers.id("MINTER_ROLE");
    await expect(
      token.connect(other).mint(other.address, 1n)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount").withArgs(
      other.address,
      MINTER_ROLE
    );

    // grant role and mint succeeds
    await token.grantRole(MINTER_ROLE, other.address);
    await token.connect(other).mint(other.address, 1n);
    expect(await token.balanceOf(other.address)).to.equal(1n);
  });

  it("rescues native coin to recipient", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    // send native coin to token contract
    await deployer.sendTransaction({ to: await token.getAddress(), value: 1000n });
    const beforeContractBal = await ethers.provider.getBalance(await token.getAddress());
    const beforeRecipientBal = await ethers.provider.getBalance(recipient.address);

    await token.rescueTokens(ethers.ZeroAddress, recipient.address, 600n);

    const afterContractBal = await ethers.provider.getBalance(await token.getAddress());
    const afterRecipientBal = await ethers.provider.getBalance(recipient.address);

    expect(beforeContractBal - afterContractBal).to.equal(600n);
    expect(afterRecipientBal - beforeRecipientBal).to.equal(600n);
  });

  it("reverts on invalid recipient when rescuing native coin", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    await expect(
      token.rescueTokens(ethers.ZeroAddress, ethers.ZeroAddress, 1n)
    ).to.be.revertedWithCustomError(token, "InvalidRecipient");
  });

  it("rescues ERC20 tokens held by the contract", async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const tokenA = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      0n,
      deployer.address,
      CAP,
    ]);

    const tokenB = await ethers.deployContract("BEP20Token", [
      "Other",
      "OTR",
      18,
      0n,
      deployer.address,
      1_000_000_000_000_000_000n,
    ]);

    // mint tokenB to tokenA's address
    await tokenB.mint(await tokenA.getAddress(), 500n);
    expect(await tokenB.balanceOf(await tokenA.getAddress())).to.equal(500n);

    // rescue tokenB from tokenA to recipient
    await tokenA.rescueTokens(await tokenB.getAddress(), recipient.address, 200n);
    expect(await tokenB.balanceOf(recipient.address)).to.equal(200n);
    expect(await tokenB.balanceOf(await tokenA.getAddress())).to.equal(300n);
  });

  it("reverts when IERC20 transfer returns false", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await ethers.deployContract("BEP20Token", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      deployer.address,
      CAP,
    ]);

    // deploy a failing ERC20 that always returns false on transfer
    const failing = await ethers.deployContract("FailingERC20");
    await expect(
      token.rescueTokens(await failing.getAddress(), deployer.address, 1n)
    ).to.be.revertedWithCustomError(token, "TokenTransferFailed");
  });
});