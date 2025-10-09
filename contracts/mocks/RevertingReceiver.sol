// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// A receiver that always reverts on receiving native coin.
contract RevertingReceiver {
    receive() external payable {
        revert("cannot receive");
    }
}