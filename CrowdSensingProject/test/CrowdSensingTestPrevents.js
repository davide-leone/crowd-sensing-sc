const CrowdSensing = artifacts.require("CrowdSensing");
const { expect } = require("chai");

contract("CrowdSensing - Prevents", (accounts) => {
    const [owner, user, nonOwner, verifier, unauthorizedVerifier] = accounts;
    
	// Setup campaign parameters
	const minParticipants = 2;
    const rewardAmount = web3.utils.toWei("1", "ether");
    const fee = web3.utils.toWei("0.1", "ether");
	const newFee = web3.utils.toWei("0.02", "ether");

    let crowdSensingInstance;

    beforeEach(async () => {
        crowdSensingInstance = await CrowdSensing.new(minParticipants, rewardAmount, fee, { from: owner });
    });

    it("Should prevent non-owner from adding verifiers", async () => {
        // Try to add a verifier and expect an error
		try {
            await crowdSensingInstance.addVerifier(verifier, { from: nonOwner });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("Caller is not the owner");
        }
    });

    it("Should prevent non-owner from removing verifiers", async () => {
        await crowdSensingInstance.addVerifier(verifier, { from: owner });
        // Try to remove a verifier and expect an error
		try {
            await crowdSensingInstance.removeVerifier(verifier, { from: nonOwner });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("Caller is not the owner");
        }
    });
	
	it("Should prevent non-owner from changing the fee", async () => {
        // Try to change the fee and expect an error
		try {
            await crowdSensingInstance.setFee(newFee, { from: nonOwner });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("Caller is not the owner");
        }
    });

    it("Should prevent submission without fee", async () => {
        // Add a partecipant
		await crowdSensingInstance.requestEncryptionKey({ from: user });
        // Try to submit data without the fee and expect an error
		try {
            await crowdSensingInstance.submitData("ipfs://datahash", { from: user, value: 0 });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("Insufficient fee");
        }
    });

    it("Should prevent data submission when no verifiers available", async () => {
        // Add a partecipant
		await crowdSensingInstance.requestEncryptionKey({ from: user });
        // Try to submit data when there are zero verifier and expect an error
		try {
            await crowdSensingInstance.submitData("ipfs://datahash", { from: user, value: fee });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("No verifiers available");
        }
    });

    it("Should prevent unauthorized verifiers from verifying data", async () => {
        // Add a verifier
		await crowdSensingInstance.addVerifier(verifier, { from: owner });
        // Add a partecipant
		await crowdSensingInstance.requestEncryptionKey({ from: user });
        // Submit data
		await crowdSensingInstance.submitData("ipfs://datahash", { from: user, value: fee });
        // Try to verify data by a non-verifier and expect an error
		try {
            await crowdSensingInstance.verifyData(user, true, { from: unauthorizedVerifier });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("Not assigned verifier");
        }
    });

    it("Should prevent distribution of rewards if contract balance is insufficient", async () => {
        // Add a verifier
		await crowdSensingInstance.addVerifier(verifier, { from: owner });
        // Add the first verified participant
		await crowdSensingInstance.requestEncryptionKey({ from: user });
        await crowdSensingInstance.submitData("ipfs://datahash", { from: user, value: fee });
        await crowdSensingInstance.verifyData(user, true, { from: verifier });
        
		// Add enough verified participants to meet the threshold
        for (let i = 1; i < minParticipants; i++) {
            await crowdSensingInstance.requestEncryptionKey({ from: accounts[i + 1] });
            await crowdSensingInstance.submitData("ipfs://datahash", { from: accounts[i + 1], value: fee });
            await crowdSensingInstance.verifyData(accounts[i + 1], true, { from: verifier });
        }
        // Try to distribute rewards when the balance is insufficient and expect an error
        try {
            await crowdSensingInstance.distributeRewards({ from: owner });
            expect.fail("Expected revert not received");
        } catch (error) {
            expect(error.reason).to.equal("Insufficient contract balance");
        }
    });

    it("Should prevent non-owner from withdrawing funds", async () => {
        // Try a withdrawal attemp by non-owner and expect an error
		try {
            await crowdSensingInstance.withdraw({ from: nonOwner });
            assert.fail("Expected revert not received");
        } catch (error) {
            expect(error.message).to.include("Caller is not the owner");
        }
    });
});