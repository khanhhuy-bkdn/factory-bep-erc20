// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./BEP20Token.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenFactory is Ownable {
    // --- Events ---
    event TokenCreated(
        address indexed token,
        address indexed owner,
        string name,
        string symbol
    );
    event CreateFeeSet(uint256 fee);
    event FeeRecipientSet(address recipient);
    event PublicCreateSet(bool enabled);
    event AuthorizedCreatorSet(address account, bool value);
    event FeeCharged(address indexed payer, address indexed recipient, uint256 amount);

    // --- Custom Errors ---
    error EmptyName();
    error EmptySymbol();
    error InvalidCap();
    error FeeTooLow();
    error ZeroFeeRecipient();
    error NotAuthorized();

    // --- Storage ---
    address[] public allTokens;
    uint256 public createFee; // fee in native coin (e.g., BNB/ETH)
    address public feeRecipient; // default to owner
    bool public publicCreate = true; // if false, only authorized addresses can create
    mapping(address => bool) public authorizedCreator;

    constructor() Ownable(msg.sender) {
        feeRecipient = msg.sender;
    }

    // --- Admin controls ---
    function setCreateFee(uint256 fee_) external onlyOwner {
        createFee = fee_;
        emit CreateFeeSet(fee_);
    }

    function setFeeRecipient(address recipient_) external onlyOwner {
        if (recipient_ == address(0)) revert ZeroFeeRecipient();
        feeRecipient = recipient_;
        emit FeeRecipientSet(recipient_);
    }

    function setPublicCreate(bool enabled) external onlyOwner {
        publicCreate = enabled;
        emit PublicCreateSet(enabled);
    }

    function setAuthorizedCreator(address account, bool value) external onlyOwner {
        authorizedCreator[account] = value;
        emit AuthorizedCreatorSet(account, value);
    }

    // --- Create Token ---
    function createToken(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 cap_
    ) external payable returns (address tokenAddr) {
        // Access control: either public or explicitly authorized
        if (!publicCreate && !authorizedCreator[msg.sender]) revert NotAuthorized();

        // Input validation
        if (bytes(name_).length == 0) revert EmptyName();
        if (bytes(symbol_).length == 0) revert EmptySymbol();
        if (cap_ < initialSupply_) revert InvalidCap();

        // Fee enforcement
        if (msg.value < createFee) revert FeeTooLow();
        if (createFee > 0) {
            (bool sent, ) = payable(feeRecipient).call{value: msg.value}("");
            require(sent, "Fee transfer failed");
            emit FeeCharged(msg.sender, feeRecipient, msg.value);
        }

        // Deploy token
        BEP20Token token = new BEP20Token(
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            msg.sender,
            cap_
        );
        tokenAddr = address(token);
        allTokens.push(tokenAddr);
        emit TokenCreated(tokenAddr, msg.sender, name_, symbol_);
    }

    // --- Read helpers to avoid returning large arrays ---
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getTokenAt(uint256 index) external view returns (address) {
        return allTokens[index];
    }

    function getTokens(uint256 start, uint256 size) external view returns (address[] memory list) {
        uint256 len = allTokens.length;
        if (start >= len) return new address[](0);
        uint256 end = start + size;
        if (end > len) end = len;
        uint256 outLen = end - start;
        list = new address[](outLen);
        for (uint256 i = 0; i < outLen; i++) {
            list[i] = allTokens[start + i];
        }
    }
}
