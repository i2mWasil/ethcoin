// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ETC.sol";
import "./CreditScoreNFT.sol";

/**
 * @title  CDP  (Collateralized Debt Position)
 * @notice Users deposit ETH as collateral and receive ETC stablecoin.
 *         The required collateral ratio is determined by the user's
 *         on-chain credit score stored in CreditScoreNFT.
 *
 * Events emitted here are the triggers that the off-chain scorer service
 * listens to so it knows when to recompute and push an updated score.
 */
contract CDP {

    ETC public etc;
    CreditScoreNFT public creditNFT;

    struct Position {
        uint256 collateral; // wei
        uint256 debt;       // ETC units (18 decimals)
    }

    mapping(address => Position) public positions;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /**
     * @notice Emitted when a user deposits ETH collateral and mints ETC.
     * @param user       The borrower.
     * @param collateral Amount of ETH deposited (wei).
     * @param debt       Amount of ETC minted (18-decimal units).
     */
    event LoanTaken(
        address indexed user,
        uint256 collateral,
        uint256 debt
    );

    /**
     * @notice Emitted when a user repays part or all of their ETC debt.
     * @param user   The repaying wallet.
     * @param amount Amount of ETC repaid (18-decimal units).
     */
    event LoanRepaid(
        address indexed user,
        uint256 amount
    );

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address _etc, address _creditNFT) {
        etc = ETC(_etc);
        creditNFT = CreditScoreNFT(_creditNFT);
    }

    // ------------------------------------------------------------------
    // View helpers
    // ------------------------------------------------------------------

    /**
     * @notice Return the required collateral ratio (percentage) for a user
     *         based on their credit score.
     *         Score 0      => 150 %  (no history)
     *         Score 1-60   => 120 %
     *         Score 61-85  => 100 %
     *         Score > 85   =>  80 %
     */
    function getCollateralRatio(address user) public view returns (uint256) {
        uint256 score = creditNFT.getScore(user);

        if (score == 0)  return 150;
        if (score <= 60) return 120;
        if (score <= 85) return 100;
        return 80;
    }

    // ------------------------------------------------------------------
    // Core actions
    // ------------------------------------------------------------------

    /**
     * @notice Deposit ETH and mint ETC proportional to the collateral ratio.
     *         Emits {LoanTaken}.
     */
    function depositAndMint() external payable {
        require(msg.value > 0, "No ETH");

        uint256 ratio = getCollateralRatio(msg.sender);
        uint256 mintAmount = (msg.value * 100) / ratio;

        positions[msg.sender].collateral += msg.value;
        positions[msg.sender].debt       += mintAmount;

        etc.mint(msg.sender, mintAmount);

        emit LoanTaken(msg.sender, msg.value, mintAmount);
    }

    /**
     * @notice Repay ETC debt. msg.value carries the repayment amount in
     *         the same unit as debt (18-decimal ETC).
     *         Emits {LoanRepaid}.
     */
    function repay() external payable {
        Position storage pos = positions[msg.sender];
        require(pos.debt > 0, "No debt");

        uint256 repayAmount = msg.value;
        pos.debt -= repayAmount;

        etc.burn(msg.sender, repayAmount);

        emit LoanRepaid(msg.sender, repayAmount);
    }
}
