const Ballot = artifacts.require("Ballot");

const languages = ["Alemán", "Búlgaro", "Chino", "Danés", "Español"]
const options = languages.map(web3.utils.stringToHex)


async function verifyThrows(pred, message) {
  let e;
  try {
    await pred();
  } catch (ex) {
    e = ex;
  }
  assert.throws(() => {
    if (e) { throw e; }
  }, message);
}

contract('Ballot', (accounts) => {
  describe("Contract Initialization", function () {
    var BallotInstance;
    before(async function () {
      BallotInstance = await Ballot.new(options);
    });
    it(`should have ${options.length} proposals`, async () => {
      const numProposals = (await BallotInstance.numProposals()).toNumber();

      assert.equal(numProposals, options.length, `There are ${numProposals} proposals`);
    });
    it('no account should be allowed to vote', async () => {
      for (let account of accounts) {
        let canVote = (await BallotInstance.voters(account)).canVote;
        assert(!canVote, `${account} shouldn't be allowed to vote`)
      }
    });
    it("should have correct default values", async () => {
      let started = await BallotInstance.started();
      assert(!started, "started is not false");
      let ended = await BallotInstance.ended();
      assert(!ended, "ended is not false");
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, 0, "numVoters is not zero");
    });
    it("all proposals should have zero votes", async () => {
      for (let i = 0; i < options.length; i++) {
        let proposal = await BallotInstance.proposals(i);
        assert.equal(proposal.voteCount.toNumber(), 0, `proposal ${i} vote count is not zero`);
      }
    });
    it("should have correct proposal names", async () => {
      for (let i = 0; i < options.length; i++) {
        let namebytes = (await BallotInstance.proposals(i)).name;
        let name = web3.utils.hexToString(namebytes);
        assert.equal(name, languages[i], `proposal ${i} name is not '${languages[i]}'`);
      }
    });
  });
  describe("Before start", function () {
    var BallotInstance;
    beforeEach(async function () {
      BallotInstance = await Ballot.new(options);
    });
    it('should give one voter the right to vote correctly', async () => {
      for (let account of accounts) {
        await BallotInstance.giveRightToVote(account)
        let canVote = (await BallotInstance.voters(account)).canVote;
        assert(canVote, `${account} should be allowed to vote`)
      }
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, accounts.length, "wrong number of voters registered");
    });
    it('should withdraw one voter the right to vote correctly', async () => {
      for (let account of accounts) {
        await BallotInstance.giveRightToVote(account)
        await BallotInstance.withdrawRightToVote(account)
        let canVote = (await BallotInstance.voters(account)).canVote;
        assert(!canVote, `${account} shouldn't be allowed to vote`)
      }
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, 0, "wrong number of voters registered");
    });
    it('should give a list of voters the right to vote correctly', async () => {
      await BallotInstance.giveAllRightToVote(accounts)
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, accounts.length, "wrong number of voters registered");
      for (let account of accounts) {
        let canVote = (await BallotInstance.voters(account)).canVote;
        assert(canVote, `${account} should be allowed to vote`)
      }
    });
    it("only chairperson should be able to give the right to vote", async () => {
      await verifyThrows(async () => {
        await BallotInstance.giveRightToVote(accounts[0], { 'from': accounts[1] });
      }, /revert/);
      await verifyThrows(async () => {
        await BallotInstance.giveAllRightToVote(accounts, { 'from': accounts[1] });
      }, /revert/);
    });
    it("only chairperson should be able to withdraw the right to vote", async () => {
      await BallotInstance.giveRightToVote(accounts[0]);
      await verifyThrows(async () => {
        await BallotInstance.withdrawRightToVote(accounts[0], { 'from': accounts[1] });
      }, /revert/);
    });
    it('should not allow to vote before start', async () => {
      await BallotInstance.giveAllRightToVote(accounts)
      for (let account of accounts) {
        let canVote = (await BallotInstance.voters(account)).canVote;
        await verifyThrows(async () => {
          if (canVote)
            await BallotInstance.vote(0, { 'from': account });
        }, /revert/);
      }
    });
    it('should not allow to end before start', async () => {
      await verifyThrows(async () => {
        await BallotInstance.end();
      }, /revert/);
    });
  });
  describe("Voting", function () {
    var BallotInstance;
    beforeEach(async function () {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.giveAllRightToVote(accounts)
      await BallotInstance.start();
    });
    it("all proposals should have zero votes", async () => {
      for (let i = 0; i < options.length; i++) {
        let proposal = await BallotInstance.proposals(i);
        assert.equal(proposal.voteCount.toNumber(), 0, `proposal ${i} vote count is not zero`);
      }
    });
    it("should have correct proposal names", async () => {
      for (let i = 0; i < options.length; i++) {
        let namebytes = (await BallotInstance.proposals(i)).name;
        let name = web3.utils.hexToString(namebytes);
        assert.equal(name, languages[i], `proposal ${i} name is not '${languages[i]}'`);
      }
    });
    it('should not allow to start again', async () => {
      await verifyThrows(async () => {
        await BallotInstance.start();
      }, /revert/);
    });
    it("shouldn't allow new individual voter registrations", async () => {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.start();
      await verifyThrows(async () => {
        await BallotInstance.giveRightToVote(accounts[0]);
      }, /revert/);
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, 0, "wrong number of voters")
    });
    it("shouldn't allow new multiple voters registrations", async () => {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.start();
      await verifyThrows(async () => {
        await BallotInstance.giveAllRightToVote(accounts);
      }, /revert/);
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, 0, "wrong number of voters")
    });
    it("should reject votes from unregistered accounts", async () => {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.start();
      for (let account of accounts) {
        await verifyThrows(async () => {
          await BallotInstance.vote(0, { 'from': account });
        }, /revert/);
      }
    });
    it('should register the vote correctly', async () => {
      let numProposals = (await BallotInstance.numProposals()).toNumber();
      let votes = Array(numProposals).fill(0);
      for (let i = 0; i < accounts.length; i++) {
        let voter = accounts[i];
        let proposal = i % 2 ? i % numProposals : 1;
        await BallotInstance.vote(proposal, { 'from': voter });
        votes[proposal] += 1;
        let voterStatus = await BallotInstance.voters(voter);
        assert.equal(proposal, voterStatus.vote,
          `Voter ${i} voted for proposal ${proposal}, but proposal ${voterStatus.vote.toNumber()} was recorded`);
        assert(voterStatus.voted, `The vote was not registered for voter ${i}`)
      }
      for (let proposal = 0; proposal < numProposals; proposal++) {
        let proposalStatus = await BallotInstance.proposals(proposal);
        let voteCount = proposalStatus.voteCount.toNumber();
        assert.equal(votes[proposal], voteCount,
          `There were ${votes[proposal]} votes for proposal ${proposal} but ${voteCount} were recorded`);
      }
    });
    it('should reject double voting', async () => {
      for (let i = 0; i < accounts.length; i++) {
        let voter = accounts[i];
        await BallotInstance.vote(0, { 'from': voter });
        await verifyThrows(async () => {
          await BallotInstance.vote(0, { 'from': voter });
        }, /revert/);
      }
    });
    it("should not show the results", async () => {
      await verifyThrows(async () => {
        await BallotInstance.winningProposals();
      }, /revert/);
      await verifyThrows(async () => {
        await BallotInstance.winners();
      }, /revert/);
    });
  });
  describe("After voting ended", function () {
    var BallotInstance;
    beforeEach(async function () {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.giveAllRightToVote(accounts);
      await BallotInstance.start();
      await BallotInstance.end();
    });
    it('should not allow to start again', async () => {
      await verifyThrows(async () => {
        await BallotInstance.start();
      }, /revert/);
    });
    it('should not allow to end again', async () => {
      await verifyThrows(async () => {
        await BallotInstance.end();
      }, /revert/);
    });
    it("shouldn't allow new individual voter registrations", async () => {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.start();
      await BallotInstance.end();
      await verifyThrows(async () => {
        await BallotInstance.giveRightToVote(accounts[0]);
      }, /revert/);
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, 0, "wrong number of voters")
    });
    it("shouldn't allow new multiple voters registrations", async () => {
      BallotInstance = await Ballot.new(options);
      await BallotInstance.start();
      await BallotInstance.end();
      await verifyThrows(async () => {
        await BallotInstance.giveAllRightToVote(accounts);
      }, /revert/);
      let numVoters = (await BallotInstance.numVoters()).toNumber();
      assert.equal(numVoters, 0, "wrong number of voters")
    });
    it('should not allow to vote after end', async () => {
      for (let account of accounts) {
        let canVote = (await BallotInstance.voters(account)).canVote
        await verifyThrows(async () => {
          if (canVote)
            await BallotInstance.vote(0, { 'from': account });
        }, /revert/);
      }
    });
    it("winningProposals() should return an empty list if there are no votes", async () => {
      let winningProposals = await BallotInstance.winningProposals();
      assert.equal(winningProposals.length, 0, "there are winning proposals")
    });
    it("winners() should return an empty list if there are no votes", async () => {
      let winners = await BallotInstance.winners();
      assert.equal(winners.length, 0, "there are winners")
    });
    it("should return the correct winner when there is only one", async () => {
      let voter = accounts[0];
      for (let i = 0; i < options.length; i++) {
        BallotInstance = await Ballot.new(options);
        await BallotInstance.giveRightToVote(voter);
        await BallotInstance.start();
        await BallotInstance.vote(i);
        await BallotInstance.end();
        let winningProposals = await BallotInstance.winningProposals();
        assert.equal(winningProposals.length, 1, `there are ${winningProposals.length} winning proposals`)
        assert.equal(winningProposals[0], i, `the winning proposal is ${winningProposals[0]}, should be ${i}`);
      }
    });
    it("should return the correct winners when there are many", async () => {
      let votesPerOption = Math.trunc(accounts.length / options.length);
      let votesNeeded = votesPerOption ? votesPerOption * options.length : accounts.length;
      let optionsVoted = votesPerOption ? options.length : accounts.length;
      BallotInstance = await Ballot.new(options);
      for (let i = 0; i < votesNeeded; i++) {
        let voter = accounts[i];
        await BallotInstance.giveRightToVote(voter);
      }
      await BallotInstance.start();
      for (let i = 0; i < votesNeeded; i++) {
        let voter = accounts[i];
        await BallotInstance.vote(i % options.length, { 'from': voter });
      }
      await BallotInstance.end();
      let winningProposals = await BallotInstance.winningProposals();
      assert.equal(winningProposals.length, optionsVoted, `there are ${winningProposals.length} winning proposals`);
      for (let i = 0; i < winningProposals.length; i++) {
        assert.equal(winningProposals[i], i, `the winning proposal is ${winningProposals[i]}, should be ${i}`);
      }
    });
  });
});
