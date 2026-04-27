// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ETC.sol";
import "../src/CDP.sol";
import "../src/CreditScoreNFT.sol";

contract Deploy is Script {
    function run() external {
        address scorerAddress = vm.envOr("SCORER_ADDRESS", address(0));

        vm.startBroadcast();

        ETC etc = new ETC();
        CreditScoreNFT nft = new CreditScoreNFT();
        CDP cdp = new CDP(address(etc), address(nft));

        etc.transferOwnership(address(cdp));

        if (scorerAddress != address(0) && !nft.hasRole(nft.SCORER_ROLE(), scorerAddress)) {
            nft.grantRole(nft.SCORER_ROLE(), scorerAddress);
        }

        vm.stopBroadcast();
    }
}
