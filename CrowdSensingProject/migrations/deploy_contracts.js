const CrowdSensing = artifacts.require("CrowdSensing");

module.exports = function (deployer) {
    deployer.deploy(CrowdSensing, 2, web3.utils.toWei("1", "ether"), web3.utils.toWei("0.1", "ether"));
};
