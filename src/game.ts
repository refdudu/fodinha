export type EntryMode = "tricks" | "totals";
export type LastBolo = "discard" | "previous";
export type AllOutRule = "extra" | "draw";
export type Phase = "bids" | "play" | "summary" | "finished";

export interface Rules {
  lives: number;
  deckSize: number;
  footRule: boolean;
  lastBolo: LastBolo;
  allOutRule: AllOutRule;
  defaultMode: EntryMode;
}

export interface Player {
  id: string;
  name: string;
  lives: number;
}

export interface Game {
  id: string;
  startedAt: number;
  players: Player[];
  rules: Rules;
  dealerId: string;
  hand: number;
  cards: number;
  phase: Phase;
  bids: Record<string, number>;
  tricks: (string | null)[];
  totals: Record<string, number>;
  mode: EntryMode;
  winnerIds: string[];
  tieBreaker: boolean;
}

export interface Score {
  player: Player;
  bid: number;
  won: number;
  lost: number;
  remaining: number;
  eliminated: boolean;
}

export interface HandResult {
  scores: Score[];
  discarded: number;
  allOut: boolean;
  survivors: string[];
}

export const DEFAULT_RULES: Rules = {
  lives: 5,
  deckSize: 40,
  footRule: true,
  lastBolo: "discard",
  allOutRule: "extra",
  defaultMode: "tricks"
};

export function activePlayers(game: Game): Player[] {
  return game.players.filter(player => player.lives > 0);
}

export function maxCards(game: Game): number {
  const count = activePlayers(game).length;
  return count ? Math.floor(game.rules.deckSize / count) : 0;
}

export function bidOrder(game: Game): Player[] {
  const active = activePlayers(game);
  const index = active.findIndex(player => player.id === game.dealerId);
  const i = index < 0 ? 0 : index;
  return [...active.slice(i + 1), ...active.slice(0, i + 1)];
}

export function currentBidder(game: Game): Player | undefined {
  return bidOrder(game).find(player => !(player.id in game.bids));
}

export function forbiddenBid(game: Game, playerId: string, value: number): boolean {
  if (!game.rules.footRule) return false;
  const order = bidOrder(game);
  if (order.at(-1)?.id !== playerId) return false;
  const sum = order.slice(0, -1).reduce((total, player) => total + (game.bids[player.id] ?? 0), 0);
  return sum + value === game.cards;
}

export function newGame(names: string[], rules: Rules, dealerIndex: number, id: string): Game {
  const trimmed = names.map(name => name.trim());
  if (trimmed.length < 2 || trimmed.length > 40) throw new Error("Adicione de 2 a 40 jogadores.");
  if (trimmed.some(name => !name)) throw new Error("Preencha todos os nomes.");
  if (new Set(trimmed.map(name => name.toLocaleLowerCase("pt-BR"))).size !== trimmed.length) {
    throw new Error("Os jogadores precisam ter nomes diferentes.");
  }
  if (!Number.isInteger(rules.lives) || rules.lives < 1 || rules.lives > 99) throw new Error("Escolha de 1 a 99 vidas.");
  if (!Number.isInteger(rules.deckSize) || rules.deckSize < trimmed.length) {
    throw new Error("O baralho precisa ter ao menos uma carta por jogador.");
  }
  const players = trimmed.map((name, i) => ({ id: "p" + i, name, lives: rules.lives }));
  return {
    id, startedAt: Date.now(), players, rules, dealerId: players[dealerIndex]?.id ?? players[0].id,
    hand: 1, cards: 1, phase: "bids", bids: {}, tricks: [], totals: {},
    mode: rules.defaultMode, winnerIds: [], tieBreaker: false
  };
}

export function placeBid(game: Game, playerId: string, amount: number): Game {
  if (game.phase !== "bids" || currentBidder(game)?.id !== playerId) throw new Error("Não é a vez desse jogador.");
  if (!Number.isInteger(amount) || amount < 0 || amount > game.cards || forbiddenBid(game, playerId, amount)) {
    throw new Error("Esse palpite não é permitido pelas regras.");
  }
  const bids = { ...game.bids, [playerId]: amount };
  return { ...game, bids, phase: bidOrder(game).every(player => player.id in bids) ? "play" : "bids" };
}

export function recordTrick(game: Game, winnerId: string | null): Game {
  if (game.phase !== "play" || game.mode !== "tricks" || game.tricks.length >= game.cards) {
    throw new Error("A vaza não pode ser registrada agora.");
  }
  if (winnerId !== null && !activePlayers(game).some(player => player.id === winnerId)) {
    throw new Error("Jogador inválido.");
  }
  const tricks = [...game.tricks, winnerId];
  return { ...game, tricks, phase: tricks.length === game.cards ? "summary" : "play" };
}

export function amendTrick(game: Game, index: number, winnerId: string | null): Game {
  if (game.mode !== "tricks" || !["summary", "play"].includes(game.phase) || index < 0 || index >= game.tricks.length) {
    throw new Error("Vaza inválida.");
  }
  if (winnerId !== null && !activePlayers(game).some(player => player.id === winnerId)) throw new Error("Jogador inválido.");
  const tricks = game.tricks.map((winner, i) => i === index ? winnerId : winner);
  return { ...game, tricks, phase: tricks.length === game.cards ? "summary" : "play" };
}

export function removeLastTrick(game: Game): Game {
  if (game.mode !== "tricks" || !game.tricks.length || !["summary", "play"].includes(game.phase)) return game;
  return { ...game, tricks: game.tricks.slice(0, -1), phase: "play" };
}

export function setMode(game: Game, mode: EntryMode): Game {
  if (game.phase !== "play") throw new Error("Mude o modo antes do resultado.");
  if (game.tricks.length || Object.values(game.totals).some(value => value > 0)) {
    throw new Error("Desfaça os lançamentos antes de trocar o modo.");
  }
  return { ...game, mode };
}

export function setTotal(game: Game, playerId: string, amount: number): Game {
  if (game.mode !== "totals" || !["play", "summary"].includes(game.phase)) throw new Error("Modo de totais não está ativo.");
  if (!activePlayers(game).some(player => player.id === playerId)) throw new Error("Jogador inválido.");
  if (!Number.isInteger(amount) || amount < 0 || amount > game.cards) throw new Error("Total inválido.");
  const totals = { ...game.totals, [playerId]: amount };
  if (Object.values(totals).reduce((a, b) => a + b, 0) > game.cards) {
    throw new Error("A soma das vazas não pode superar as cartas da mão.");
  }
  return { ...game, totals, phase: "play" };
}

export function closeTotals(game: Game): Game {
  if (game.phase !== "play" || game.mode !== "totals") throw new Error("Não é possível conferir esses totais.");
  return { ...game, phase: "summary" };
}

export function reopenSummary(game: Game): Game {
  if (game.phase !== "summary") return game;
  return { ...game, phase: "play" };
}

export function resetBids(game: Game): Game {
  if (!["play", "summary"].includes(game.phase)) return game;
  return { ...game, phase: "bids", bids: {}, tricks: [], totals: {}, mode: game.rules.defaultMode };
}

export function handResult(game: Game): HandResult {
  const active = activePlayers(game);
  const wins: Record<string, number> = Object.fromEntries(active.map(player => [player.id, 0]));
  let discarded = 0;
  if (game.mode === "totals") {
    for (const player of active) wins[player.id] = game.totals[player.id] ?? 0;
    discarded = game.cards - Object.values(wins).reduce((a, b) => a + b, 0);
  } else {
    let carry = 0;
    let lastWinner: string | null = null;
    for (const winner of game.tricks) {
      if (winner === null) carry++;
      else {
        wins[winner] += carry + 1;
        carry = 0;
        lastWinner = winner;
      }
    }
    if (carry && game.rules.lastBolo === "previous" && lastWinner !== null) wins[lastWinner] += carry;
    else discarded = carry;
  }
  const scores = active.map(player => {
    const won = wins[player.id];
    const bid = game.bids[player.id] ?? 0;
    const lost = Math.abs(bid - won);
    const remaining = Math.max(0, player.lives - lost);
    return { player, bid, won, lost, remaining, eliminated: remaining === 0 };
  });
  const survivors = scores.filter(score => !score.eliminated).map(score => score.player.id);
  return { scores, discarded, survivors, allOut: survivors.length === 0 };
}

export function nextDealer(game: Game, aliveIds: string[]): string {
  const oldIndex = game.players.findIndex(player => player.id === game.dealerId);
  for (let step = 1; step <= game.players.length; step++) {
    const player = game.players[(oldIndex + step) % game.players.length];
    if (aliveIds.includes(player.id)) return player.id;
  }
  return game.dealerId;
}

export function advanceHand(game: Game): Game {
  if (game.phase !== "summary") throw new Error("Confira o resultado antes de avançar.");
  const result = handResult(game);
  const currentIds = activePlayers(game).map(player => player.id);
  const players = game.players.map(player => {
    const score = result.scores.find(item => item.player.id === player.id);
    return { ...player, lives: score?.remaining ?? player.lives };
  });
  const finished = (ids: string[]): Game => ({ ...game, players, phase: "finished", winnerIds: ids });
  if (result.survivors.length === 1) return finished(result.survivors);
  if (result.allOut && game.rules.allOutRule === "draw") return finished(currentIds);

  const tieBreaker = result.allOut;
  const nextPlayers = tieBreaker
    ? players.map(player => ({ ...player, lives: currentIds.includes(player.id) ? 1 : 0 }))
    : players;
  const nextIds = tieBreaker ? currentIds : result.survivors;
  const eliminated = result.scores.some(score => score.eliminated);
  const max = Math.floor(game.rules.deckSize / nextIds.length);
  const cards = (tieBreaker || eliminated) ? 1 : Math.min(game.cards + 1, max);

  return {
    ...game, players: nextPlayers, dealerId: nextDealer(game, nextIds), hand: game.hand + 1,
    cards, phase: "bids", bids: {}, tricks: [], totals: {}, mode: game.rules.defaultMode,
    winnerIds: [], tieBreaker
  };
}
