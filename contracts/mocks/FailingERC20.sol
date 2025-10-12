// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Minimal ERC20-like contract that always fails on transfer.
// Used only for testing BEP20Token.rescueTokens failure path.
contract FailingERC20 is IERC20 {
    string public constant name = "Failing";
    string public constant symbol = "FAIL";
    uint8 public constant decimals = 18;

    function totalSupply() external pure returns (uint256) {
        return 0;
    }
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }
    function approve(address, uint256) external pure returns (bool) {
        return false;
    }
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
    function transferFrom(
        address,
        address,
        uint256
    ) external pure returns (bool) {
        return false;
    }
}
