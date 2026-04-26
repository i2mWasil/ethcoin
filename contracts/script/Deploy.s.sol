pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/USX.sol";
import "../src/CDP.sol";
import "../src/CreditScoreNFT.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        USX usx = new USX();
        CreditScoreNFT nft = new CreditScoreNFT();

        CDP cdp = new CDP(address(usx), address(nft));

        usx.transferOwnership(address(cdp));

        vm.stopBroadcast();
    }
}