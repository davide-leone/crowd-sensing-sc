const CrowdSensing = artifacts.require("CrowdSensing");
const { expect } = require("chai");

contract("CrowdSensing - Allows", accounts => {
  const [owner, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, verifier1, verifier2] = accounts;

  // Setup campaign parameters
  const minParticipants = [1, 5];
  const rewardAmount = web3.utils.toWei("0.1", "ether");
  const fee = web3.utils.toWei("0.01", "ether");
  const newFee = web3.utils.toWei("0.02", "ether");
  
  let crowdSensingInstance1;
  let crowdSensingInstance2;

  beforeEach(async () => {
    // Two instances:
	// - one for the tests with only one user, low threshold and only one verifier
	crowdSensingInstance1 = await CrowdSensing.new(minParticipants[0], rewardAmount, fee, { from: owner });
    await crowdSensingInstance1.addVerifier(verifier1, { from: owner });
	// - one for the tests with more users, higher threshold and two verifiers
	crowdSensingInstance2 = await CrowdSensing.new(minParticipants[1], rewardAmount, fee, { from: owner });
	await crowdSensingInstance2.addVerifier(verifier1, { from: owner });
    await crowdSensingInstance2.addVerifier(verifier2, { from: owner });
  });
  
  it("Should allow owner to add verifiers", async () => {
	// Add verifier2
	await crowdSensingInstance1.addVerifier(verifier2, { from: owner });
	
	// Check if verifier2 was added 
	const isVerifier = await crowdSensingInstance1.isVerifier(verifier2);
	assert.equal(isVerifier, true, "Verifier2 not added correctly");
  });

  it("Should allow the owner to remove an existing verifier", async () => {
    // Remove verifier2
	const tx = await crowdSensingInstance1.removeVerifier(verifier2, { from: owner });
    
	// Check if verifier2 was removed 
	const isVerifier = await crowdSensingInstance1.isVerifier(verifier2);
	assert.equal(isVerifier, false, "Verifier2 not removed correctly");
  });
  
  it("Should allow the owner to change the submission fee", async () => {
    // Change the fee
    await crowdSensingInstance1.setFee(newFee, { from: owner });
    
    // Check if the fee was updated correctly
    const updatedFee = await crowdSensingInstance1.fee();  
    expect(updatedFee.toString()).to.equal(newFee, "Fee update did not work correctly");
  });

  it("Should generate an encryption key for a user", async () => {
    const tx = await crowdSensingInstance1.requestEncryptionKey({ from: user1 });
    
    // Check event emission for encryption key generation
    const event = tx.logs.find(log => log.event === "EncryptionKeyGenerated");
    expect(event.args.user).to.equal(user1);
    expect(event.args.chunkSize.toNumber()).to.equal(256);
  });

  it("Should allow a user to submit data and assign a verifier", async () => {
    // First, user requests an encryption key
    await crowdSensingInstance1.requestEncryptionKey({ from: user1 });
    
    // Then, submit data (ensuring to send the fee)
    const dataLocation = "https://example.com/data/user1";
    const tx = await crowdSensingInstance1.submitData(dataLocation, { from: user1, value: fee });
    
    // Check event emission for data submission
    const event = tx.logs.find(log => log.event === "DataSubmitted");
    expect(event.args.user).to.equal(user1);
    expect(event.args.dataLocation).to.equal(dataLocation);
    
    // Verify that a verifier was assigned
    const assignedVerifier = await crowdSensingInstance1.assignedVerifiers(user1);
    expect(assignedVerifier).to.equal(verifier1);
  });

  it("Should allow the assigned verifier to verify data", async () => {
	// User1 gets encryption key and submits data
	await crowdSensingInstance1.requestEncryptionKey({ from: user1 });
	const dataLocation = "https://example.com/data/user1";
	await crowdSensingInstance1.submitData(dataLocation, { from: user1, value: fee });
	  
	// Check initial campaign participants count
	let campaign = await crowdSensingInstance1.campaign();
	const initialParticipants = campaign.currentParticipants.toNumber();

	// As the assigned verifier (verifier1), retrieve data and encryption key
	const result = await crowdSensingInstance1.requestDataVerification(user1, { from: verifier1 });
	const retrievedDataLocation = result[0];
	const retrievedEncryptionKey = result[1];
	expect(retrievedDataLocation).to.equal(dataLocation);
	  
	// Verify data as valid
	const verifierInitialBalance = web3.utils.toBN(await web3.eth.getBalance(verifier1));
	const tx = await crowdSensingInstance1.verifyData(user1, true, { from: verifier1 });
	  
	// Check that the verification event is emitted
	const verifyEvent = tx.logs.find(log => log.event === "DataVerified");
	expect(verifyEvent.args.verifier).to.equal(verifier1);
	expect(verifyEvent.args.user).to.equal(user1);
	expect(verifyEvent.args.isValid).to.equal(true);

	// Campaign participants Should have increased
	campaign = await crowdSensingInstance1.campaign();
	expect(campaign.currentParticipants.toNumber()).to.equal(initialParticipants + 1);

    // Check that verifier received half the fee as reward
	const verifierFinalBalance = web3.utils.toBN(await web3.eth.getBalance(verifier1));
	expect(verifierFinalBalance.gt(verifierInitialBalance)).to.be.true;
  });

  it("Should distribute rewards once threshold is met", async () => {
    // User1 setup: request key, submit data, and get verified
    await crowdSensingInstance1.requestEncryptionKey({ from: user1 });
    const dataLocation1 = "https://example.com/data/user1";
    await crowdSensingInstance1.submitData(dataLocation1, { from: user1, value: fee });
    await crowdSensingInstance1.verifyData(user1, true, { from: verifier1 });
    
    // Owner funds the contract so that reward distribution can occur
    await web3.eth.sendTransaction({ from: owner, to: crowdSensingInstance1.address, value: web3.utils.toWei("1", "ether") });
    
    // Check contract balance
    const contractBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(crowdSensingInstance1.address));
    expect(contractBalanceBefore.gte(web3.utils.toBN(rewardAmount))).to.be.true;
    
    // Distribute rewards
    const tx = await crowdSensingInstance1.distributeRewards({ from: owner });
    
    // Check reward distribution events
    const rewardEvent = tx.logs.find(log => log.event === "RewardDistributed");
    expect(rewardEvent.args.user).to.equal(user1);
    expect(rewardEvent.args.amount.toString()).to.equal(rewardAmount);

    // Campaign Should be marked as closed
    const campaign = await crowdSensingInstance1.campaign();
    expect(campaign.isClosed).to.equal(true);
  });

  it("Should handle more participants and a larger threshold", async () => {
    // 10 participants
    const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];

    // Each user requests encryption key and submits data
    for (let i = 0; i < users.length; i++) {
      await crowdSensingInstance2.requestEncryptionKey({ from: users[i] });
      const dataLocation = `https://example.com/data/user${i + 1}`;
      await crowdSensingInstance2.submitData(dataLocation, { from: users[i], value: fee });
    }

	for (let i = 0; i < users.length; i++) {
	  // Get the verifier that was actually assigned to this user and verify the data
	  const assignedVerifier = await crowdSensingInstance2.assignedVerifiers(users[i]);
	  await crowdSensingInstance2.verifyData(users[i], true, { from: assignedVerifier });
	}
	
	const verifiedUsersCount = (await crowdSensingInstance2.campaign()).currentParticipants.toNumber();
	
    // Distribute rewards (after threshold is met)
    await web3.eth.sendTransaction({ from: owner, to: crowdSensingInstance2.address, value: web3.utils.toWei("1", "ether") });

    // Check contract balance
    const contractBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(crowdSensingInstance2.address));
    expect(contractBalanceBefore.gte(web3.utils.toBN(rewardAmount * verifiedUsersCount))).to.be.true;

    const tx = await crowdSensingInstance2.distributeRewards({ from: owner });

    // Check reward distribution events
    let distributedRewards = 0;
    tx.logs.forEach(log => {
      if (log.event === "RewardDistributed") {
        distributedRewards += parseInt(log.args.amount);
      }
    });

    expect(distributedRewards).to.equal(verifiedUsersCount * parseInt(rewardAmount), "Total rewards distributed is incorrect");
    
    // Check that the campaign is closed
    const campaign = await crowdSensingInstance2.campaign();
    expect(campaign.isClosed).to.equal(true);
  });

  it("Should handle multiple verifiers and assign participants randomly", async () => {
    // 10 participants
    const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];

    // Request encryption keys and submit data
    for (let i = 0; i < users.length; i++) {
      await crowdSensingInstance2.requestEncryptionKey({ from: users[i] });
      const dataLocation = `https://example.com/data/user${i + 1}`;
      await crowdSensingInstance2.submitData(dataLocation, { from: users[i], value: fee });
    }

    // Track how many participants each verifier is assigned
    const verifierCounts = { [verifier1]: 0, [verifier2]: 0 };

    // Simulate verification by checking which verifier was assigned to each user
    for (let i = 0; i < users.length; i++) {
      const assignedVerifier = await crowdSensingInstance2.assignedVerifiers(users[i]);
      if (assignedVerifier === verifier1) {
        verifierCounts[verifier1] += 1;
      } else if (assignedVerifier === verifier2) {
        verifierCounts[verifier2] += 1;
      }
    }
	// Debug
    // console.log("Verifier 1 assigned to:", verifierCounts[verifier1], "participants");
    // console.log("Verifier 2 assigned to:", verifierCounts[verifier2], "participants");

    // Ensure that each verifier has at least 1 participants assigned
    expect(verifierCounts[verifier1]).to.be.at.least(1);
    expect(verifierCounts[verifier2]).to.be.at.least(1);
  });

  it("Should allow owner to withdraw remaining funds after the campaign is closed", async () => {
     // Ensure at least one user submits data and gets verified
    await crowdSensingInstance1.requestEncryptionKey({ from: user1 });
    await crowdSensingInstance1.submitData("https://example.com/data/user1", { from: user1, value: fee });
    await crowdSensingInstance1.verifyData(user1, true, { from: verifier1 });

    // Fund the contract to enable reward distribution
    await web3.eth.sendTransaction({ from: owner, to: crowdSensingInstance1.address, value: web3.utils.toWei("1", "ether") });

    // Distribute rewards to close the campaign
    await crowdSensingInstance1.distributeRewards({ from: owner });

    // Verify that the campaign is now closed
    const campaign = await crowdSensingInstance1.campaign();
    expect(campaign.isClosed).to.equal(true, "Campaign should be closed after distributing rewards");

    // Check balances before withdrawal
    const contractBalance = await web3.eth.getBalance(crowdSensingInstance1.address);
    const ownerBalanceBefore = await web3.eth.getBalance(owner);

    // Withdraw remaining funds
    await crowdSensingInstance1.withdraw({ from: owner });

    // Ensure contract balance is zero after withdrawal
    const contractBalanceAfter = await web3.eth.getBalance(crowdSensingInstance1.address);
    expect(contractBalanceAfter).to.equal("0", "Contract balance should be zero after withdrawal");

    // Check that owner's balance increased
    const ownerBalanceAfter = await web3.eth.getBalance(owner);
    expect(web3.utils.toBN(ownerBalanceAfter).gt(web3.utils.toBN(ownerBalanceBefore))).to.be.true;
  });
  
  it("Should allow campaign restart after closing", async () => {
    await crowdSensingInstance1.requestEncryptionKey({ from: user1 });
    await crowdSensingInstance1.submitData("https://example.com/data/user1", { from: user1, value: fee });
    await crowdSensingInstance1.verifyData(user1, true, { from: verifier1 });
    await web3.eth.sendTransaction({ from: owner, to: crowdSensingInstance1.address, value: web3.utils.toWei("1", "ether") });
    await crowdSensingInstance1.distributeRewards({ from: owner });
    await crowdSensingInstance1.restartCampaign(2, rewardAmount, { from: owner });
    const campaign = await crowdSensingInstance1.campaign();
    expect(campaign.isClosed).to.be.false;
  });
});
