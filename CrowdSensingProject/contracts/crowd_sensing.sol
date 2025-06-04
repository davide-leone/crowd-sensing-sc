// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CrowdSensing {
    // Struct to store user data information
	struct UserData {
        string dataLocation; // Indicates where the data is stored (e.g., IPFS)
        bool isVerified; // Indicates whether the data has been verified
        bool isRewarded; // Indicates if the user has received a reward
        bytes32 encryptionKey; // Encryption key for user data
        uint256 chunkSize; // Size of data chunks
    }

    struct Campaign {
        uint256 minParticipants; // Required number of verified participants before rewards can be distributed
        uint256 currentParticipants; // Number of verified users
        uint256 rewardAmount; // Reward given to each verified participant
        bool isClosed; // Indicates if the campaign is closed
    }

    address public owner; // Entity or person interested in the data gathering
    uint256 public fee; // Fee to discourage cheating and prevent DoS attacks.
    mapping(address => UserData) public userData; // Mapping from user address to their data
    mapping(address => address) public assignedVerifiers; // Mapping from assigned verifier to each user
    Campaign public campaign;
    address[] public verifiedUsers; // Users whose data has been verified
    address[] public verifiers;
    
	// Events to log important actions
    event EncryptionKeyGenerated(address indexed user, bytes32 encryptionKey, uint256 chunkSize);
    event EncryptionKeyShared(address indexed user, bytes32 encryptionKey);
	event DataSubmitted(address indexed user, string dataLocation);
    event DataVerified(address indexed verifier, address indexed user, bool isValid);
    event RewardDistributed(address indexed user, uint256 amount);
    event VerifierAdded(address verifier);
	event VerifierRemoved(address verifier);
	event VerifierRewarded(address indexed verifier, uint256 amount);
	event FeeUpdated(uint256 oldFee, uint256 newFee);
    event CampaignClosed();
    
	// Restrict function access to only the contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }
    
	// Initializes the campaign and sets the contract owner
    constructor(uint256 _minParticipants, uint256 _rewardAmount, uint256 _fee) {
        owner = msg.sender;
        campaign = Campaign(_minParticipants, 0, _rewardAmount, false);
        fee = _fee;
    }
	
	// Restart a new campaign after closing the previous one
	function restartCampaign(uint256 _minParticipants, uint256 _rewardAmount) public onlyOwner {
		require(campaign.isClosed, "Previous campaign not closed");

		for (uint256 i = 0; i < verifiedUsers.length; i++) {
			userData[verifiedUsers[i]].isVerified = false;
			userData[verifiedUsers[i]].isRewarded = false;
		}

		delete verifiedUsers; // Clear after resetting user statuses

		campaign = Campaign(_minParticipants, 0, _rewardAmount, false);
	}
		
	// Allows owner to add verifiers  
    function addVerifier(address verifier) public onlyOwner {
        verifiers.push(verifier);
		emit VerifierAdded(verifier);
    }
    
	// Allows owner to remove verifiers
    function removeVerifier(address verifier) public onlyOwner {
        for (uint i = 0; i < verifiers.length; i++) {
            if (verifiers[i] == verifier) {
                verifiers[i] = verifiers[verifiers.length - 1];
                verifiers.pop();
				emit VerifierRemoved(verifier);
                break;
            }
        }
    }
	
	// Checks if an address is a verifier (for testing)
	function isVerifier(address verifier) public view returns (bool) {
		for (uint i = 0; i < verifiers.length; i++) {
			if (verifiers[i] == verifier) return true;
		}
		return false;
	}
	
	// Allows owner to change the fee
	function setFee(uint256 newFee) public onlyOwner {
		require(newFee > 0, "Fee must be greater than zero");
		emit FeeUpdated(fee, newFee);
		fee = newFee;
	}
    
	// Allows users to request an encryption key before submitting data
    function requestEncryptionKey() public {
        require(!userData[msg.sender].isVerified, "Already participated");
        bytes32 encryptionKey = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        uint256 chunkSize = 256; // Default chunk size
        userData[msg.sender].encryptionKey = encryptionKey;
        userData[msg.sender].chunkSize = chunkSize;
        emit EncryptionKeyGenerated(msg.sender, encryptionKey, chunkSize);
    }
    
	// Allows users to submit data by paying a fee.
    function submitData(string memory dataLocation) public payable {
        require(msg.value >= fee, "Insufficient fee");
        require(!campaign.isClosed, "Campaign is closed");
        require(userData[msg.sender].encryptionKey != 0, "Request encryption key first");
        require(!userData[msg.sender].isVerified, "Already submitted");
        
        userData[msg.sender].dataLocation = dataLocation;
        address assignedVerifier = selectVerifier();
        assignedVerifiers[msg.sender] = assignedVerifier;
        
        emit DataSubmitted(msg.sender, dataLocation);
    }
    
	// Selects a verifier for a user
    function selectVerifier() internal view returns (address) {
        require(verifiers.length > 0, "No verifiers available");
        return verifiers[uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), msg.sender))) % verifiers.length];
    }
    
	// Allows verifiers to request data for verification
    function requestDataVerification(address user) public view returns (string memory, bytes32) {
        require(msg.sender == assignedVerifiers[user], "Not assigned verifier");
        return (userData[user].dataLocation, userData[user].encryptionKey);
    }
    
	// Allows verifiers to validate submitted data 
    function verifyData(address user, bool isValid) public {
        require(msg.sender == assignedVerifiers[user], "Not assigned verifier");
        require(!userData[user].isVerified, "Data already verified");
        
        userData[user].isVerified = isValid;
        // If valid, the user is added to verified users, the participant count is updated and the verifier is rewarded
		if (isValid) {
            campaign.currentParticipants += 1;
            verifiedUsers.push(user);
            payable(msg.sender).transfer(fee / 2); // Reward verifier
            emit VerifierRewarded(msg.sender, fee / 2);
        }
        
        emit DataVerified(msg.sender, user, isValid);
    }
    
	// Distributes rewards to verified users once the minimum threshold is met
    function distributeRewards() public onlyOwner {
        require(campaign.currentParticipants >= campaign.minParticipants, "Threshold not met");
        require(!campaign.isClosed, "Campaign already closed");
        require(address(this).balance >= campaign.currentParticipants * campaign.rewardAmount, "Insufficient contract balance");
        
        for (uint i = 0; i < verifiedUsers.length; i++) {
            address user = verifiedUsers[i];
            if (!userData[user].isRewarded) {
                userData[user].isRewarded = true;
                payable(user).transfer(campaign.rewardAmount);
                emit RewardDistributed(user, campaign.rewardAmount);
                emit EncryptionKeyShared(user, userData[user].encryptionKey);
            }
        }
        
        campaign.isClosed = true;
        emit CampaignClosed();
    }
    
	// Allows the contract to receive ETH
    receive() external payable {}
    
	// Allows owner to withdraw contract balance once the campaign is closed
    function withdraw() public onlyOwner {
        require(campaign.isClosed, "Campaign is still active");
		payable(owner).transfer(address(this).balance);
    }
}
