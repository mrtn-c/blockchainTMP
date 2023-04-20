/* eslint-disable no-undef */
"use strict";
const Game = artifacts.require("BadCoinGame");
const name = "BadCoinGame";
const shared = require("./shared");
const verifyThrows = shared.verifyThrows;



contract(name, (accounts) => {
	const betAmount = shared.bet;
	const bet = {"value":betAmount};
	const from1 = {"from": accounts[1]};
	const betfrom1 = {"from": accounts[1], "value": betAmount};
	shared.shouldBehaveLikeGame(Game, accounts);
	describe("Playing", function() {
		var game;
		it("should reject playing out of turn", async () => {
			game = await Game.new(bet);
			await game.join(betfrom1);
			await verifyThrows(async () => {
				await game.play(true);
			},/other player/);
		});
		it("shouldn't allow to claim winnings", async () => {
			await verifyThrows(async () => {
				await game.claimWinnings();
			}, /ended/);
			await verifyThrows(async () => {
				await game.claimWinnings(from1);
			}, /ended/);
		});
		it("should allow playing in turn", async () => {
			await game.play(true, from1);
		});
	});
});