/* eslint-disable no-undef */
"use strict";
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
const bet = web3.utils.toWei("100", "milliether");
const emptyAddress = "0x0000000000000000000000000000000000000000";
function checkEvent(txr,event,...values){
    for (let log of txr.receipt.logs){
        if (log.event == event){
            let args = log.args
            for (let i in values){
                assert.equal(String(values[i]).toLowerCase(), String(args[i]).toLowerCase(), `${event}: bad argument ${i}`);
            }
            return;
        }
    }
    assert.fail(`event ${event} not emitted`)
}

exports.verifyThrows = verifyThrows;
exports.checkEvent = checkEvent;
exports.bet = bet;
exports.emptyAddress = emptyAddress
exports.shouldBehaveLikeGame = function (Game, accounts) {
	var game;


	describe("Game initialization", function () {
        let txr;
		it("should reject contract creation without a bet", async () => {
			await verifyThrows(async () => {
				await Game.new();
			}, /bet is needed/);
		});
		it("should create a game with a bet", async () => {
			game = await Game.new({ "value": bet });
        });
        it("should emit the GameCreated event", async() => {
            txr = await web3.eth.getTransactionReceipt(game.transactionHash)
            let topic = web3.utils.keccak256("GameCreated(address,address)");
            let addr = game.address.substr(2).toLowerCase();
            let data = web3.utils.leftPad(accounts[0].toLowerCase(),64)+web3.utils.leftPad(addr,64);
            for (let log of txr.logs){
                if (log.topics[0] == topic){
                    assert.equal(log.data, data, "Wrong event arguments");
                    return;
                }
            }
            assert.fail("event GameCreated not emitted");
        })
		it("should have the creator account as players[0]", async () => {
			game = await Game.new({ "from": accounts[0], "value": bet });
			let creator = await game.players(0);
			assert.equal(creator, accounts[0], "wrong value of players[0]");
		});
		it("should have the correct bet value", async () => {
			let bet_ = await game.bet();
			assert.equal(bet, bet_, "wrong bet value");
		});
		it("should have no winner", async () => {
			let winner = await game.winner();
			assert.equal(winner, emptyAddress, "there is a non empty winner");
		});
		it("should have one player", async () => {
			let player = await game.players(1);
			assert.equal(player, emptyAddress, "there is a non empty second player");
		});
		it("status should be Status.created", async () => {
			let status = await game.status();
			assert.equal(status, 0, "wrong status");
		});
		it("shouldn't allow to invoke nextPlayer()", async () => {
			await verifyThrows(async () => {
				await game.nextPlayer();
			}, /not running/);
		});
		it("shouldn't allow to invoke canPlay()", async () => {
			await verifyThrows(async () => {
				await game.canPlay();
			}, /not running/);
		});
		it("shouldn't allow other accounts to kill the game", async () => {
			await verifyThrows(async () => {
				await game.kill({ "from": accounts[1] });
			}, /creator/);
		});
		it("should allow creator to kill the game", async () => {
			let before = (await web3.eth.getBalance(accounts[0]));
			txr = await game.kill();
			let after = (await web3.eth.getBalance(accounts[0]));
			assert(after > before, "perhaps the bet wasn't transferred back");
			await verifyThrows(async () => {
				await game.bet();
			}, /Returned values aren't valid/);
        });
        it("should emit GameTerminated", async () => {
            checkEvent(txr, "GameTerminated", accounts[0]);
        });
		it("should reject a join without a bet", async () => {
			game = await Game.new({ "value": bet });
			await verifyThrows(async () => {
				await game.join({ "from": accounts[1] });
			}, /bet is needed/);
		});
		it("should reject a join with a wrong bet", async () => {
			await verifyThrows(async () => {
				await game.join({ "from": accounts[1], "value": 1 });
			}, /invalid bet value/);
		});
		it("should allow another player to join", async () => {
			txr = await game.join({ "from": accounts[1], "value": bet });
        });
        it("should emit PlayerJoined", async () => {
            checkEvent(txr, "PlayerJoined", accounts[1]);
        });
		it("shouldn't allow to claim winnings", async () => {
			await verifyThrows(async () => {
				await game.claimWinnings();
			}, /ended/);
			await verifyThrows(async () => {
				await game.claimWinnings({ "from": accounts[1] });
			}, /ended/);
		});
	});
	describe("After join", function () {
		it("should have the challenger as players[1]", async () => {
			let challenger = await game.players(1);
			assert.equal(challenger, accounts[1], "wrong value of players[1]");
		});
		it("should have the correct bet value", async () => {
			let bet_ = await game.bet();
			assert.equal(bet, bet_, "wrong bet value");
		});
		it("should have no winner", async () => {
			let winner = await game.winner();
			assert.equal(winner, emptyAddress, "there is a non empty winner");
		});
		it("should have two players", async () => {
			let player = await game.players(0);
			assert.equal(player, accounts[0], "the creator player is wrong");
		});
		it("status should be Status.running", async () => {
			let status = await game.status();
			assert.equal(status, 1, "wrong status");
		});
		it("should give a valid nextPlayer()", async () => {
			let nextPlayer = await game.nextPlayer();
			assert(nextPlayer == accounts[0] || nextPlayer == accounts[1], "nextPlayer() is wrong");
		});
		it("should correctly inform is a player canPlay()", async () => {
			let nextPlayer = await game.nextPlayer();
			for (let i = 0; i < 2; i++) {
				let canPlay_ = accounts[i] == nextPlayer;
				let canPlay = await game.canPlay({ "from": accounts[i] });
				assert.equal(canPlay, canPlay_, "wrong canPlay() result");
			}
		});
		it("shouldn't allow other accounts to kill the game", async () => {
			await verifyThrows(async () => {
				await game.kill({ "from": accounts[1] });
			}, /creator/);
		});
		it("shouldn't allow the creator to kill the game", async () => {
			await verifyThrows(async () => {
				await game.kill({ "from": accounts[0] });
			}, /kill a running game/);
		});
		it("shouldn't allow another player to join", async () => {
			await verifyThrows(async () => {
				await game.join({ "from": accounts[2], "value": bet });
			}, /two players/);
		});
		it("shouldn't allow to claim winnings", async () => {
			await verifyThrows(async () => {
				await game.claimWinnings();
			}, /ended/);
			await verifyThrows(async () => {
				await game.claimWinnings({ "from": accounts[1] });
			}, /ended/);
		});
	});
};