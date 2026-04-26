// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract CreditScoreNFT is ERC721 {
    mapping(address => uint256) public scores;
    mapping(address => bool) public minted;

    constructor() ERC721("CreditScore", "CSCORE") {}

    function updateScore(address user, uint256 score) external {
        scores[user] = score;

        if (!minted[user]) {
            _mint(user, uint256(uint160(user)));
            minted[user] = true;
        }
    }

    function getScore(address user) external view returns (uint256) {
        return scores[user];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        // prevent transfers → soulbound
        if (auth != address(0)) {
            revert("Soulbound: non-transferable");
        }
        return super._update(to, tokenId, auth);
    }
}