const CoinGame = artifacts.require("BadCoinGame");

module.exports = function(deployer) {
  deployer.deploy(CoinGame, {'value': web3.utils.toWei("1","ether")});
};
