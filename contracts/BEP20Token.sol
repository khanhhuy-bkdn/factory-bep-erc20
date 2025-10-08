// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Essential BEP20 Token
 * @notice ERC-20 compatible token with configurable decimals, supply cap, mintable, burnable,
 *         pausable transfers, and address blacklist. Includes rescue function for stuck assets.
 */
contract BEP20Token is ERC20, ERC20Burnable, ERC20Capped, ERC20Pausable, Ownable {
    uint8 private _customDecimals;
    mapping(address => bool) private _blacklisted;

    event BlacklistUpdated(address indexed account, bool isBlacklisted);

    // --- Custom Errors ---
    error InitialSupplyExceedsCap();
    error SenderBlacklisted();
    error RecipientBlacklisted();
    error InvalidRecipient();
    error TokenTransferFailed();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        address owner_,
        uint256 cap_
    ) ERC20(name_, symbol_) ERC20Capped(cap_) Ownable(owner_) {
        _customDecimals = decimals_;
        // mint initial supply to owner
        if (initialSupply_ > 0) {
            if (initialSupply_ > cap_) revert InitialSupplyExceedsCap();
            _mint(owner_, initialSupply_);
        }
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    // --- Minting ---
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount); // cap enforced by ERC20Capped
    }

    // --- Pausing ---
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Blacklist Management ---
    function setBlacklist(address account, bool value) external onlyOwner {
        _blacklisted[account] = value;
        emit BlacklistUpdated(account, value);
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    // --- Transfer/Burn/Mint guardrails ---
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Capped, ERC20Pausable) {
        if (_blacklisted[from]) revert SenderBlacklisted();
        if (_blacklisted[to]) revert RecipientBlacklisted();
        super._update(from, to, value);
    }

    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        if (token == address(0)) {
            // rescue native BNB
            payable(to).transfer(amount);
        } else {
            bool ok = IERC20(token).transfer(to, amount);
            if (!ok) revert TokenTransferFailed();
        }
    }

    // Allow the contract to receive native coin (BNB/ETH)
    receive() external payable {}
}