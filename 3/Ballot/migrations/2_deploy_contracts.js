const Ballot = artifacts.require("Ballot");

const languages = ["Alemán", "Búlgaro", "Chino", "Danés", "Español"]
const options = languages.map(web3.utils.stringToHex)


module.exports = function(deployer) {
  deployer.deploy(Ballot, options);
};
