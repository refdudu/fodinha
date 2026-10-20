import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES, advanceHand, bidOrder, forbiddenBid, handResult, newGame,
  placeBid, recordTrick, setMode, setTotal, closeTotals, amendTrick
} from "./game";

const fresh = (lives = 5) => newGame(["Ana", "Beto", "Cris"], { ...DEFAULT_RULES, lives }, 0, "teste");
const bid = (game: ReturnType<typeof fresh>, amounts: number[]) => {
  let current = game;
  for (const [index, player] of bidOrder(game).entries()) current = placeBid(current, player.id, amounts[index]);
  return current;
};

describe("Fodinha", () => {
  it("rejeita nomes vazios e repetidos sem mudar a ordem da mesa", () => {
    expect(() => newGame(["Ana", " ", "Cris"], DEFAULT_RULES, 0, "teste")).toThrow("Preencha todos os nomes.");
    expect(() => newGame(["Ana", "ana"], DEFAULT_RULES, 0, "teste")).toThrow("nomes diferentes");
    expect(newGame(["Ana", "Beto", "Cris"], DEFAULT_RULES, 1, "teste").dealerId).toBe("p1");
  });

  it("inicia com uma carta, ordem pós-distribuidor e pé por último", () => {
    const game = fresh();
    expect(game.cards).toBe(1);
    expect(bidOrder(game).map(player => player.name)).toEqual(["Beto", "Cris", "Ana"]);
    expect(forbiddenBid(placeBid(game, "p1", 0), "p0", 1)).toBe(true);
  });

  it("bloqueia o palpite do pé que fecha a soma", () => {
    const game = placeBid(placeBid(fresh(), "p1", 0), "p2", 0);
    expect(() => placeBid(game, "p0", 1)).toThrow();
    expect(placeBid(game, "p0", 0).phase).toBe("play");
  });

  it("soma bolo e descarta melada final", () => {
    let game = bid(fresh(), [0, 0, 0]);
    game = { ...game, cards: 3 };
    game = recordTrick(game, null);
    game = recordTrick(game, "p1");
    game = recordTrick(game, null);
    expect(handResult(game).scores.find(score => score.player.id === "p1")?.won).toBe(2);
    expect(handResult(game).discarded).toBe(1);
    game = { ...game, rules: { ...game.rules, lastBolo: "previous" } };
    expect(handResult(game).scores.find(score => score.player.id === "p1")?.won).toBe(3);
  });

  it("permite corrigir vaza sem refazer a mão", () => {
    let game = bid(fresh(), [0, 0, 0]);
    game = recordTrick(game, "p1");
    expect(game.phase).toBe("summary");
    game = amendTrick(game, 0, "p2");
    expect(handResult(game).scores.find(score => score.player.id === "p2")?.won).toBe(1);
  });

  it("reinicia com uma carta quando alguém sai", () => {
    let game = bid(fresh(1), [0, 0, 0]);
    game = recordTrick(game, "p1");
    const next = advanceHand(game);
    expect(next.cards).toBe(1);
    expect(next.players.find(player => player.id === "p1")?.lives).toBe(0);
    expect(next.phase).toBe("bids");
  });

  it("chega ao máximo e continua no máximo", () => {
    let game = fresh();
    game = { ...game, cards: 13, phase: "summary", bids: { p0: 0, p1: 0, p2: 0 }, tricks: Array(13).fill(null) };
    const next = advanceHand(game);
    expect(next.cards).toBe(13);
  });

  it("abre desempate se todos forem eliminados", () => {
    let game = bid(fresh(1), [0, 0, 0]);
    game = recordTrick(game, "p1");
    game = { ...game, bids: { p0: 1, p1: 0, p2: 1 } };
    const next = advanceHand(game);
    expect(next.phase).toBe("bids");
    expect(next.tieBreaker).toBe(true);
    expect(next.players.every(player => player.lives === 1)).toBe(true);
  });

  it("aceita registro por totais sem inventar vencedor para bolo", () => {
    let game = bid(fresh(), [0, 0, 0]);
    game = setMode(game, "totals");
    game = { ...game, cards: 3 };
    game = setTotal(game, "p1", 2);
    game = closeTotals(game);
    expect(handResult(game).discarded).toBe(1);
    expect(handResult(game).scores.find(score => score.player.id === "p1")?.won).toBe(2);
  });

  it("termina empatado se a regra configurada for empate", () => {
    let game = bid(fresh(1), [0, 0, 0]);
    game = recordTrick(game, "p1");
    game = { ...game, bids: { p0: 1, p1: 0, p2: 1 }, rules: { ...game.rules, allOutRule: "draw" } };
    const result = advanceHand(game);
    expect(result.phase).toBe("finished");
    expect(result.winnerIds).toEqual(["p0", "p1", "p2"]);
  });
});
