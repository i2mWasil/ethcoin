// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ETC.sol";
import "./CreditScoreNFT.sol";

contract CDP {
    ETC public etc;
    CreditScoreNFT public creditNFT;

    struct Position {
        uint256 collateral;
        uint256 debt;
    }

    mapping(address => Position) public positions;

    constructor(address _etc, address _creditNFT) {
        etc = ETC(_etc);
        creditNFT = CreditScoreNFT(_creditNFT);
    }

    function getCollateralRatio(address user) public view returns (uint256) {
        uint256 score = creditNFT.getScore(user);

        if (score <= 30) return 150;
        if (score <= 60) return 120;
        if (score <= 85) return 100;
        return 80;
    }

    function depositAndMint() external payable {
        require(msg.value > 0, "No ETH");

        uint256 ratio = getCollateralRatio(msg.sender);

        uint256 mintAmount = (msg.value * 100) / ratio;

        positions[msg.sender].collateral += msg.value;
        positions[msg.sender].debt += mintAmount;

        etc.mint(msg.sender, mintAmount);
    }

    function repay() external payable {
        Position storage pos = positions[msg.sender];

        require(pos.debt > 0, "No debt");

        uint256 repayAmount = msg.value;

        pos.debt -= repayAmount;

        etc.burn(msg.sender, repayAmount);
    }
}