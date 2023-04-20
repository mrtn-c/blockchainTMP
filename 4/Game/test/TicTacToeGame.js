/* eslint-disable no-undef */
"use strict";
const Game = artifacts.require("TicTacToe");
const name = "TicTacToe";
var shared = require("./shared");
const BN = web3.utils.BN;

const verifyThrows = shared.verifyThrows;
const checkEvent = shared.checkEvent;
const bet = shared.bet;


contract(name, (accounts) => {
	const creator = accounts[0].toLowerCase();
	const challenger = accounts[1].toLowerCase();
	var t = (from = creator, value = 0) => ({ 'from': from, 'value': value });
	var other = (account) => account.toLowerCase() == creator ? challenger : creator;
	async function play(game, move, inTurn = true) {
		let player = await game.nextPlayer();
		if (!inTurn) {
			player = other(player);
		}
		let row = Math.floor(move / 3);
		let col = move % 3;
		return await game.play(row, col, t(player));
	}

	async function transferred(txr) {
		let tx = await web3.eth.getTransaction(txr.tx);
		let player = tx.from;
		let spent = new BN(tx.gasPrice * txr.receipt.gasUsed);
		let current = txr.receipt.blockNumber
		let before = new BN(await web3.eth.getBalance(player, current - 1))
		let after = new BN(await web3.eth.getBalance(player, current))
		return after.add(spent).sub(before)
	}
	var won = [
		[0, 3, 1, 4, 2],
		[3, 0, 4, 1, 5],
		[6, 3, 7, 4, 8],
		[0, 1, 3, 4, 6],
		[1, 2, 4, 5, 7],
		[2, 0, 5, 3, 8],
		[8, 7, 4, 3, 0],
		[2, 1, 4, 0, 6],
		[8, 0, 3, 1, 4, 2],
		[8, 3, 0, 4, 1, 5],
		[1, 6, 3, 7, 4, 8],
		[8, 0, 1, 3, 4, 6],
		[3, 1, 2, 4, 5, 7],
		[1, 2, 0, 5, 3, 8],
		[1, 8, 7, 4, 3, 0],
		[8, 2, 1, 4, 0, 6],
		[4, 0, 3, 1, 2, 5, 7, 8, 6],
	];
	var draw = [
		[4, 0, 1, 7, 6, 2, 5, 3, 8],
		[4, 2, 5, 3, 1, 7, 8, 0, 6],
		[0, 3, 1, 4, 5, 2, 6, 7, 8],
		[2, 4, 1, 0, 8, 5, 3, 6, 7],
		[4, 8, 5, 6, 7, 3, 0, 1, 2],
		[2, 5, 4, 6, 8, 0, 3, 7, 1]
	]


	shared.shouldBehaveLikeGame(Game, accounts);
	describe("Playing", function () {
		var game;
		it("should emit PlayerTurn after join", async () => {
			let game = await Game.new(t(creator, bet));
			let txr = await game.join(t(challenger, bet));
			checkEvent(txr, "PlayerTurn");
		})
		it("should reject playing out of turn", async () => {
			game = await Game.new(t(creator, bet));
			await game.join(t(challenger, bet));
			await verifyThrows(async () => {
				let player = other(await game.nextPlayer());
				await game.play(0, 0, t(player));
			}, /other player/);
		});
		it("shouldn't allow to claim winnings", async () => {
			await verifyThrows(async () => {
				await game.claimWinnings(t(creator));
			}, /ended/);
			await verifyThrows(async () => {
				await game.claimWinnings(t(challenger));
			}, /ended/);
		});
		it("should allow playing in turn", async () => {
			let nextPlayer = await game.nextPlayer();
			await game.play(1, 1, t(nextPlayer));
		});
		it("should reject selecting a non empty spot", async () => {
			let nextPlayer = await game.nextPlayer();
			await verifyThrows(async () => {
				await game.play(1, 1, t(nextPlayer));
			}, /invalid/);
		});
		it("should allow both players to be the first", async function () {
			let creatorFirst, challengerFirst;
			for (let i = 0; i < 10; i++) {
				let game = await Game.new(t(creator, bet));
				await game.join(t(challenger, bet));
				let firstPlayer = (await game.nextPlayer()).toLowerCase()
				if (firstPlayer == creator) {
					creatorFirst = true;
				} else {
					challengerFirst = true;
				}
			}
			assert(creatorFirst, "creator was never the first player");
			assert(challengerFirst, "challenger was never the first player");
		});
		draw.forEach(function (drawGame) {
			describe("Draw: " + drawGame, function () {
				let game, firstPlayer, txr;
				it("should create the game and allow to join", async () => {
					game = await Game.new(t(creator, bet));
					await game.join(t(challenger, bet));
					firstPlayer = (await game.nextPlayer()).toLowerCase();
				});
				for (let i = 0; i < drawGame.length; i++) {
					it(`move ${i}: shouldn't allow to claim winnings`, async () => {
						await verifyThrows(async () => {
							await game.claimWinnings(t(creator));
						}, /ended/);
						await verifyThrows(async () => {
							await game.claimWinnings(t(challenger));
						}, /ended/);
					});
					it(`move ${i}: shouldn't allow the creator to kill the game`, async () => {
						await verifyThrows(async () => {
							await game.kill(t(creator));
						}, /kill a running game/);
					});
					it(`move ${i}: souldn't allow playing out of turn`, async () => {
						await verifyThrows(async () => {
							await play(game, drawGame[i], false);
						}, /other player/);
					});
					it(`move ${i}: should reject playing outside the board`, async () => {
						let player = await game.nextPlayer();
						for (let [row, col] of [[0, 3], [1, 3], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]]) {
							await verifyThrows(async () => {
								await game.play(row, col, t(player));
							}, /invalid/);
						}
					});
					if (i > 0) {
						it(`move ${i}: shouldn't allow selecting a non empty spot`, async () => {
							await verifyThrows(async () => {
								await play(game, drawGame[i - 1]);
							}, /invalid/);
						});
					}
					it(`move ${i}: should allow to play`, async () => {
						txr = await play(game, drawGame[i]);
					});
					it("should emit the Play event", async () => {
						checkEvent(txr, "Play", txr.receipt.from, Math.floor(drawGame[i] / 3), drawGame[i] % 3);
					});
				}
				it("should be a draw", async () => {
					const emptyAddress = shared.emptyAddress;
					assert.equal(await game.status(), 2, "the game has not ended")
					assert.equal(await game.winner(), emptyAddress, "winner is not the empty address");
				});
				it("should emit the Draw event", async () => {
					checkEvent(txr, "Draw", creator, challenger);
				});
				it("should emit WinningsTransferred", async () => {
					checkEvent(txr, "WinningsTransferred", txr.receipt.from, bet);
				});
				it("should have transferred the bet to the last player", async () => {
					assert.equal(bet, await transferred(txr), "the amount transferred is wrong")
				});
				it("shouldn't allow to kill the game until the challenger's winnings are withdrawn", async () => {
					if (txr.receipt.from.toLowerCase() == creator) {
						// The last player was the creator, so the challenger has not withdrawn their winnings yet
						await verifyThrows(async () => {
							await game.kill(t(creator));
						}, /revert/);
					}
				});
				it("should allow the second player to withdraw their winnings", async () => {
					let secondPlayer = other(firstPlayer)
					txr = await game.claimWinnings(t(secondPlayer));
				});
				it("should emit WinningsTransferred", async () => {
					checkEvent(txr, "WinningsTransferred", txr.receipt.from, bet);
				});
				it("should have zero balance after the second player claimed their winnings", async () => {
					assert.equal(0, await web3.eth.getBalance(game.address));
				});
				it("should allow the creator to kill the game", async () => {
					txr = await game.kill();
				});
				it("should emit GameTerminated", async () => {
					checkEvent(txr, "GameTerminated", creator);
				});
			});
		});
		won.forEach(function (wonGame) {
			describe("Won: " + wonGame, function () {
				let game, firstPlayer, expectedWinner, txr;
				it("should create the game and allow to join", async () => {
					game = await Game.new(t(creator, bet));
					await game.join(t(challenger, bet));
					firstPlayer = (await game.nextPlayer()).toLowerCase();
					expectedWinner = wonGame.length % 2 ? firstPlayer : other(firstPlayer);
				});
				for (let i = 0; i < wonGame.length; i++) {
					it(`move ${i}: shouldn't allow to claim winnings`, async () => {
						await verifyThrows(async () => {
							await game.claimWinnings(t(creator));
						}, /ended/);
						await verifyThrows(async () => {
							await game.claimWinnings(t(challenger));
						}, /ended/);
					});
					it(`move ${i}: shouldn't allow the creator to kill the game`, async () => {
						await verifyThrows(async () => {
							await game.kill(t(creator));
						}, /kill a running game/);
					});
					it(`move ${i}: shouldn't allow playing out of turn`, async () => {
						await verifyThrows(async () => {
							await play(game, wonGame[i], false);
						}, /other player/);
					});
					if (i > 0) {
						it(`move ${i}: shouldn't allow selecting a non empty spot`, async () => {
							await verifyThrows(async () => {
								await play(game, wonGame[i - 1]);
							}, /invalid/);
						});
					}
					it(`move ${i}: should allow to play`, async () => {
						txr = await play(game, wonGame[i]);
					});
					it("should emit the Play event", async () => {
						checkEvent(txr, "Play", txr.receipt.from, Math.floor(wonGame[i] / 3), wonGame[i]%3);
					});
				}
				it("shouldn't allow to play after the game ended", async () => {
					let player = other(await game.winner());
					for (let i = 0; i < 9; i++) {
						if (wonGame.includes(i)) {
							continue;
						}
						await verifyThrows(async () => {
							await game.play(Math.floor(i / 3), i % 3, t(player));
						}, /not running/);
						break;
					}
				});
				it("should emit the Winner event", async () => {
					checkEvent(txr, "Winner", expectedWinner);
				});
				it("should emit WinningsTransferred", async () => {
					checkEvent(txr, "WinningsTransferred", expectedWinner, 2 * bet);
				});
				it("should win the expected winner", async () => {
					assert.equal((await game.winner()).toLowerCase(), expectedWinner, "wrong winner");
				});
				it("should have zero balance after the winnings have been transferred", async () => {
					assert.equal(0, await web3.eth.getBalance(game.address));
				});
				it("should allow the creator to kill the game", async () => {
					txr = await game.kill();
				});
				it("should emit GameTerminated", async () => {
					checkEvent(txr, "GameTerminated", accounts[0]);
				});
			});
		});
	});
});