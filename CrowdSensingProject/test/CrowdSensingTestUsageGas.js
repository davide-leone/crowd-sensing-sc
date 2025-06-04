const CrowdSensing = artifacts.require("CrowdSensing");

contract("CrowdSensing - Gas Usage", async (accounts) => {
    let contractInstance;
    const owner = accounts[0];
    const verifiers = accounts.slice(1, 5); // Four verifiers
    const users = accounts.slice(5); // Remaining accounts as users
	// const testUserCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const testUserCounts = [10, 20, 30, 40, 50, 60, 70, 80, 90];
	// const testUserCounts = [100, 150, 200, 250, 300, 350, 400, 450, 500];
    const fee = web3.utils.toWei("0.01", "ether");
    const rewardAmount = web3.utils.toWei("0.05", "ether");
    // const minParticipants = 1;
	const minParticipants = 5;
	// const minParticipants = 25;

    beforeEach(async () => {
        contractInstance = await CrowdSensing.new(minParticipants, rewardAmount, fee, { from: owner });
        for (let verifier of verifiers) {
            await contractInstance.addVerifier(verifier, { from: owner });
        }
    });

    it("Measures gas usage for different numbers of users with multiple verifiers", async () => {
        for (let count of testUserCounts) {
            console.log(`\n### Testing with ${count} users ###`);

            contractInstance = await CrowdSensing.new(minParticipants, rewardAmount, fee, { from: owner });
            // Add multiple verifiers
			for (let verifier of verifiers) {
                await contractInstance.addVerifier(verifier, { from: owner });
            }

            let gasSubmitTotal = 0; // Total gas for data submission
            let gasVerifyTotal = 0; // Total gas for data verification
            let totalGasUsed = 0; // Total gas used

            // Users request encryption keys and submit data
            for (let i = 0; i < count; i++) {
                await contractInstance.requestEncryptionKey({ from: users[i] });

                let txSubmit = await contractInstance.submitData(`ipfs://data_${i}`, { from: users[i], value: fee });
                gasSubmitTotal += txSubmit.receipt.gasUsed;
                totalGasUsed += txSubmit.receipt.gasUsed;
            }

            console.log(`Gas for Data Submission: ${gasSubmitTotal}`);
            console.log(`Gas for Data Submission (avg): ${gasSubmitTotal / count}`);

            // Data verification by randomly assign verifiers
            for (let i = 0; i < count; i++) {
                let assignedVerifier = await contractInstance.assignedVerifiers(users[i]);
                let txVerify = await contractInstance.verifyData(users[i], true, { from: assignedVerifier });
                gasVerifyTotal += txVerify.receipt.gasUsed;
                totalGasUsed += txVerify.receipt.gasUsed;
            }

            console.log(`Gas for Data Verification: ${gasVerifyTotal}`);
            console.log(`Gas for Data Verification (avg): ${gasVerifyTotal / count}`);

            // Fund contract dynamically for rewards
            const totalRewardNeeded = BigInt(count) * BigInt(rewardAmount);
            await web3.eth.sendTransaction({
                from: owner,
                to: contractInstance.address,
                value: totalRewardNeeded.toString(),
            });

            // Distribute rewards
            let txRewards = await contractInstance.distributeRewards({ from: owner });
            totalGasUsed += txRewards.receipt.gasUsed;
            console.log(`Gas for Reward Distribution: ${txRewards.receipt.gasUsed}`);
            console.log(`Total Gas Used: ${totalGasUsed}`);
        }
    });
});
