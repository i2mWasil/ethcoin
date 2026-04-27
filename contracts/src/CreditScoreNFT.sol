// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  CreditScoreNFT
 * @notice Soulbound ERC-721 that stores an AI-computed credit score per wallet.
 *         Only addresses granted SCORER_ROLE can call updateScore.
 *         The deployer is automatically granted DEFAULT_ADMIN_ROLE so they can
 *         grant/revoke SCORER_ROLE to the off-chain scorer service.
 */
contract CreditScoreNFT is ERC721, AccessControl {

    // ------------------------------------------------------------------
    // Roles
    // ------------------------------------------------------------------

    /// @dev Granted to the off-chain scorer service wallet.
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    /// @dev address => credit score (0-100 integer range).
    mapping(address => uint256) public scores;

    /// @dev Tracks whether a soulbound token has already been minted for a wallet.
    mapping(address => bool) public minted;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /**
     * @notice Emitted every time a credit score is written on-chain.
     * @param user      The wallet whose score was updated.
     * @param score     The new score value (0-100).
     * @param updater   The SCORER_ROLE address that submitted the update.
     * @param timestamp Block timestamp of the update.
     */
    event ScoreUpdated(
        address indexed user,
        uint256 score,
        address indexed updater,
        uint256 timestamp
    );

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor() ERC721("CreditScore", "CSCORE") {
        // msg.sender becomes the admin and can grant SCORER_ROLE later.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Deployer is also granted SCORER_ROLE for convenience during testing;
        // revoke it in production once the scorer service wallet is configured.
        _grantRole(SCORER_ROLE, msg.sender);
    }

    // ------------------------------------------------------------------
    // Core logic
    // ------------------------------------------------------------------

    /**
     * @notice Write a new credit score for `user`.
     *         Mints the soulbound token on first call for a given wallet.
     * @param user   Wallet address to update.
     * @param score  New credit score in range [0, 100].
     */
    function updateScore(address user, uint256 score)
        external
        onlyRole(SCORER_ROLE)
    {
        require(user != address(0), "CreditScoreNFT: zero address");
        require(score <= 100, "CreditScoreNFT: score out of range");

        scores[user] = score;

        if (!minted[user]) {
            _mint(user, uint256(uint160(user)));
            minted[user] = true;
        }

        emit ScoreUpdated(user, score, msg.sender, block.timestamp);
    }

    /**
     * @notice Return the stored credit score for `user`.
     *         Returns 0 if the wallet has never been scored.
     */
    function getScore(address user) external view returns (uint256) {
        return scores[user];
    }

    // ------------------------------------------------------------------
    // Soulbound enforcement
    // ------------------------------------------------------------------

    /**
     * @dev Block all transfers except minting (auth == address(0)).
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (auth != address(0)) {
            revert("Soulbound: non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    // ------------------------------------------------------------------
    // ERC-165 override (required because both ERC721 and AccessControl
    // implement supportsInterface).
    // ------------------------------------------------------------------

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

