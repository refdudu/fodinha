import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_RULES, activePlayers, advanceHand, amendTrick, bidOrder, closeTotals,
  currentBidder, forbiddenBid, handResult, maxCards, newGame, placeBid,
  recordTrick, removeLastTrick, reopenSummary, resetBids, setMode, setTotal
} from "./game";
import type { Game, Rules, EntryMode } from "./game";
import "./style.css";

const KEY = "fodinha-contador-v1";

interface MatchHistory {
  id: string;
  timestamp: number;
  names: string[];
  winners: string[];
  hands: number;
}

interface Stored {
  game: Game | null;
  undo: Game[];
  history: MatchHistory[];
  recentNames: string[];
}

const EMPTY: Stored = { game: null, undo: [], history: [], recentNames: [] };

function readStorage(): Stored {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return EMPTY;
    const value = JSON.parse(saved) as Stored;
    if (!Array.isArray(value.history) || !Array.isArray(value.undo)) return EMPTY;
    return { ...EMPTY, ...value };
  } catch {
    return EMPTY;
  }
}

function Button({ children, onClick, subtle = false, disabled = false, className = "" }: {
  children: React.ReactNode; onClick: () => void; subtle?: boolean; disabled?: boolean; className?: string;
}) {
  return <button type="button" className={"btn " + (subtle ? "btn-muted " : "btn-primary ") + className}
    disabled={disabled} onClick={onClick}>{children}</button>;
}

function App() {
  const [data, setData] = useState<Stored>(readStorage);
  const dataRef = useRef(data);
  const [view, setView] = useState<"home" | "game">(() => data.game && data.game.phase !== "finished" ? "game" : "home");
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [rules, setRules] = useState<Rules>({ ...DEFAULT_RULES });
  const [bidValue, setBidValue] = useState(0);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [editingTrick, setEditingTrick] = useState<number | null>(null);

  const game = data.game;
  const active = game ? activePlayers(game) : [];
  const bidder = game?.phase === "bids" ? currentBidder(game) : undefined;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [data]);

  useEffect(() => {
    setBidValue(0);
  }, [game?.hand, Object.keys(game?.bids ?? {}).length]);

  // Mantém ações consecutivas sincronizadas, mesmo antes do próximo render do React.
  function replaceData(next: Stored) {
    dataRef.current = next;
    setData(next);
  }

  function update(transform: (current: Game) => Game) {
    const previous = dataRef.current;
    const current = previous.game;
    if (!current) return;
    try {
      const next = transform(current);
      if (next === current) return;
      const nextHistory: MatchHistory[] = next.phase === "finished" && current.phase !== "finished"
        ? [{
            id: next.id,
            timestamp: Date.now(),
            names: next.players.map(player => player.name),
            winners: next.players.filter(player => next.winnerIds.includes(player.id)).map(player => player.name),
            hands: next.hand
          }, ...previous.history.filter(match => match.id !== next.id)].slice(0, 30)
        : previous.history;
      replaceData({
        ...previous, game: next, history: nextHistory,
        undo: [...previous.undo, current].slice(-60)
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar esta ação.");
    }
  }

  function undo() {
    const current = dataRef.current;
    if (!current.undo.length) return;
    const previous = current.undo[current.undo.length - 1];
    replaceData({
      ...current, game: previous, undo: current.undo.slice(0, -1),
      history: current.game?.phase === "finished"
        ? current.history.filter(match => match.id !== current.game?.id)
        : current.history
    });
    setError("");
  }

  function startGame() {
    try {
      const current = dataRef.current;
      if (current.game && current.game.phase !== "finished" && !window.confirm("Substituir a partida atual? O histórico dela não será salvo.")) return;
      // Não descarte campos vazios: newGame deve apontar o erro antes de iniciar.
      const trimmed = names.map(name => name.trim());
      const fresh = newGame(trimmed, rules, dealerIndex, String(Date.now()));
      replaceData({
        ...current, game: fresh, undo: [],
        recentNames: [...new Set([...trimmed, ...current.recentNames])].slice(0, 80)
      });
      setError("");
      setView("game");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar.");
    }
  }

  function stopGame() {
    const current = dataRef.current;
    if (current.game && current.game.phase !== "finished" && !window.confirm("Descartar a partida em andamento?")) return;
    replaceData({ ...current, game: null, undo: [] });
    setView("home");
    setError("");
  }

  function changeName(index: number, name: string) {
    setNames(prev => prev.map((item, i) => i === index ? name : item));
  }

  function changeRule<K extends keyof Rules>(key: K, value: Rules[K]) {
    setRules(prev => ({ ...prev, [key]: value }));
  }

  function numericChange(value: string, fallback: number) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  }

  const results = game?.phase === "summary" ? handResult(game) : null;
  const carry = game?.tricks.reduce((count, winner) => winner === null ? count + 1 : 0, 0) ?? 0;
  const totalAssigned = active.reduce((sum, player) => sum + (game?.totals[player.id] ?? 0), 0);
  const modeLocked = Boolean(game && (game.tricks.length || Object.values(game.totals).some(value => value > 0)));

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} type="button" aria-label="Ir ao início">
          <span className="brand-icon">♥</span> FODINHA
        </button>
        {game && view === "game" && <button className="link" type="button" onClick={undo} disabled={!data.undo.length}>↶ Desfazer</button>}
      </header>

      {saveError && <div role="alert" className="alert">O navegador bloqueou o salvamento. Evite fechar a página.</div>}
      {error && <div role="alert" className="alert">{error} <button type="button" onClick={() => setError("")} aria-label="Fechar">×</button></div>}

      {view === "home" && <>
        <section className="headline">
          <div className="eyebrow">CONTADOR DE PARTIDAS</div>
          <h1>Só jogar.<br /><span>O resto é conta.</span></h1>
          <p>Truco gaúcho, vidas, palpites e vazas. Sem cadastro.</p>
        </section>

        {game && game.phase !== "finished" && (
          <div className="panel resume">
            <div><strong>Partida em andamento</strong><small>Mão {game.hand} · {activePlayers(game).length} jogadores</small></div>
            <Button onClick={() => setView("game")}>Continuar →</Button>
          </div>
        )}

        <section className="panel">
          <div className="section-heading"><h2>Nova partida</h2><span className="muted">01 / 02</span></div>
          <label className="field-label">Jogadores <span className="muted">na ordem da mesa</span></label>
          <div className="players-input">
            {names.map((name, index) => (
              <div className="name-row" key={index}>
                <span className="index">{String(index + 1).padStart(2, "0")}</span>
                <input aria-label={"Nome do jogador " + (index + 1)} maxLength={30} value={name}
                  onChange={event => changeName(index, event.target.value)} placeholder={"Jogador " + (index + 1)}
                  list="recent-names" />
                <button className="icon-button" type="button" aria-label="Remover jogador" title="Remover"
                  disabled={names.length <= 2} onClick={() => {
                    setNames(prev => prev.filter((_, i) => i !== index));
                    setDealerIndex(current => current === index ? 0 : current > index ? current - 1 : current);
                  }}>×</button>
              </div>
            ))}
          </div>
          <datalist id="recent-names">{data.recentNames.map(name => <option key={name} value={name} />)}</datalist>
          <button className="link add-player" type="button" disabled={names.length >= 40}
            onClick={() => setNames(prev => [...prev, ""])}>+ Adicionar jogador</button>

          <label className="field-label" htmlFor="dealer">Quem distribui primeiro?</label>
          <select id="dealer" value={dealerIndex} onChange={event => setDealerIndex(Number(event.target.value))}>
            {names.map((name, index) => <option key={index} value={index}>{name.trim() || "Jogador " + (index + 1)}</option>)}
          </select>

          <div className="rule-top"><h3>Regras</h3><span className="muted">02 / 02</span></div>
          <div className="settings-grid">
            <label>Vidas iniciais
              <input type="number" min={1} max={99} value={rules.lives}
                onChange={event => changeRule("lives", numericChange(event.target.value, 5))} />
            </label>
            <label>Baralho
              <select value={rules.deckSize} onChange={event => changeRule("deckSize", Number(event.target.value))}>
                <option value={40}>40 cartas</option><option value={80}>80 cartas (2 baralhos)</option>
              </select>
            </label>
          </div>
          <details className="advanced">
            <summary>Regras avançadas <span>⌄</span></summary>
            <div className="advanced-content">
              <label className="toggle">
                <span>Regra do pé<small>Último palpite não pode fechar a soma.</small></span>
                <input type="checkbox" checked={rules.footRule} onChange={event => changeRule("footRule", event.target.checked)} />
              </label>
              <label>Se a última vaza melar
                <select value={rules.lastBolo} onChange={event => changeRule("lastBolo", event.target.value as Rules["lastBolo"])}>
                  <option value="discard">Descartar bolo</option>
                  <option value="previous">Dar ao último vencedor</option>
                </select>
              </label>
              <label>Se todos forem eliminados
                <select value={rules.allOutRule} onChange={event => changeRule("allOutRule", event.target.value as Rules["allOutRule"])}>
                  <option value="extra">Desempate com 1 vida</option>
                  <option value="draw">Partida empatada</option>
                </select>
              </label>
              <label>Registro padrão
                <select value={rules.defaultMode} onChange={event => changeRule("defaultMode", event.target.value as EntryMode)}>
                  <option value="tricks">Vaza por vaza</option>
                  <option value="totals">Total no final</option>
                </select>
              </label>
            </div>
          </details>
          <Button className="wide start" onClick={startGame}>Iniciar partida <span>→</span></Button>
          <p className="hint">As cartas aumentam até o máximo possível. Uma eliminação reinicia em 1 carta.</p>
        </section>

        <section className="history-section">
          <div className="section-heading"><h2>Partidas anteriores</h2><span className="muted">{data.history.length}</span></div>
          {data.history.length === 0 ? <p className="muted">O histórico aparecerá aqui depois da primeira partida.</p> :
            data.history.map(match => (
              <div className="history-row" key={match.id}>
                <div><strong>{match.winners.length === 1 ? match.winners[0] : "Empate: " + match.winners.join(", ")}</strong>
                  <small>{match.names.join(" · ")}</small></div>
                <span className="muted">{match.hands} mãos</span>
              </div>
            ))}
        </section>
        <footer>Salvo somente neste dispositivo · Funciona offline depois de instalado</footer>
      </>}

      {view === "game" && game && <>
        <div className="match-heading">
          <div><div className="eyebrow">{game.tieBreaker ? "DESEMPATE" : "PARTIDA EM ANDAMENTO"}</div>
            <h1>{game.phase === "finished" ? "Fim de jogo" : "Mão " + String(game.hand).padStart(2, "0")}</h1>
            <p>{game.phase === "finished" ? "Placar encerrado" : game.cards + (game.cards === 1 ? " carta por jogador" : " cartas por jogador")}</p>
          </div>
          <div className="round-badge"><strong>{active.length}</strong><small>ativos</small></div>
        </div>

        <div className="stats-bar">
          <span>Distribui: <strong>{game.players.find(player => player.id === game.dealerId)?.name}</strong></span>
          <span>Pé: <strong>{bidOrder(game).at(-1)?.name}</strong></span>
          <span>Máx.: <strong>{maxCards(game)} cartas</strong></span>
        </div>

        <section className="board">
          {game.players.map(player => {
            const score = results?.scores.find(item => item.player.id === player.id);
            return <div key={player.id} className={"player-card " + (player.lives === 0 ? "eliminated" : "")}>
              <div className="player-name">{player.name}
                {game.dealerId === player.id && <span className="tiny-badge">D</span>}
              </div>
              <div className="lives"><span className="heart">♥</span> {score ? score.remaining : player.lives}</div>
              <div className="player-meta">{player.lives === 0 ? "Eliminado" : score
                ? "Palpite " + score.bid + " · Fez " + score.won
                : game.bids[player.id] === undefined ? "Aguardando palpite" : "Palpite: " + game.bids[player.id]}</div>
            </div>;
          })}
        </section>

        {game.phase === "bids" && bidder && (
          <section className="panel phase-panel">
            <div className="eyebrow">ETAPA 1 · PALPITES</div>
            <h2>Quantas vazas?</h2>
            <p className="muted">Vez de <strong className="bright">{bidder.name}</strong>{bidder.id === bidOrder(game).at(-1)?.id ? " · Último a apostar (pé)" : ""}</p>
            <div className="counter">
              <button type="button" aria-label="Diminuir palpite" onClick={() => setBidValue(value => Math.max(0, value - 1))}>−</button>
              <strong>{bidValue}</strong>
              <button type="button" aria-label="Aumentar palpite" onClick={() => setBidValue(value => Math.min(game.cards, value + 1))}>+</button>
            </div>
            {forbiddenBid(game, bidder.id, bidValue) && <p className="warning">O pé não pode fechar a soma dos palpites.</p>}
            <Button className="wide" disabled={forbiddenBid(game, bidder.id, bidValue)} onClick={() => update(current => placeBid(current, bidder.id, bidValue))}>
              Confirmar palpite →
            </Button>
            <div className="bid-list">
              {bidOrder(game).filter(player => player.id in game.bids).map(player => (
                <span key={player.id}>{player.name}: <strong>{game.bids[player.id]}</strong></span>
              ))}
            </div>
          </section>
        )}

        {game.phase === "play" && (
          <section className="panel phase-panel">
            <div className="eyebrow">ETAPA 2 · RESULTADOS</div>
            <div className="section-heading"><h2>{game.mode === "tricks" ? "Quem ganhou?" : "Quantas fez?"}</h2>
              <span className="muted">{game.mode === "tricks" ? game.tricks.length + "/" + game.cards : totalAssigned + "/" + game.cards}</span>
            </div>
            <div className="segmented">
              <button type="button" className={game.mode === "tricks" ? "selected" : ""}
                disabled={game.mode === "tricks" || modeLocked}
                onClick={() => update(current => setMode(current, "tricks"))}>Por vaza</button>
              <button type="button" className={game.mode === "totals" ? "selected" : ""}
                disabled={game.mode === "totals" || modeLocked}
                onClick={() => update(current => setMode(current, "totals"))}>Por totais</button>
            </div>
            {game.mode === "tricks" ? <>
              <p className="muted">{game.tricks.length === game.cards ? "Todas as vazas foram registradas." : "Vaza " + (game.tricks.length + 1) + " de " + game.cards}</p>
              {carry > 0 && game.tricks.length < game.cards && <div className="bolo">Bolo acumulado: <strong>{carry + 1} pontos na próxima vaza</strong></div>}
              {game.tricks.length < game.cards && <div className="winner-grid">
                {active.map(player => <Button key={player.id} subtle onClick={() => update(current => recordTrick(current, player.id))}>
                  {player.name}
                </Button>)}
                <Button subtle className="melt" onClick={() => update(current => recordTrick(current, null))}>✕ Melou! (bolo)</Button>
              </div>}
              {game.tricks.length > 0 && <div className="trick-list">
                <div className="section-heading"><h3>Vazas registradas</h3>
                  <button className="link" type="button" onClick={() => update(removeLastTrick)}>Apagar última</button>
                </div>
                {game.tricks.map((winner, index) => (
                  <div className="trick-row" key={index}>
                    <span>Vaza {index + 1}</span>
                    {editingTrick === index ? <select value={winner ?? "melt"} onChange={event => {
                      update(current => amendTrick(current, index, event.target.value === "melt" ? null : event.target.value));
                      setEditingTrick(null);
                    }}>
                      <option value="melt">Melou!</option>
                      {active.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
                    </select> : <button type="button" className="link" onClick={() => setEditingTrick(index)}>
                      {winner === null ? "Melou" : game.players.find(player => player.id === winner)?.name} · Editar
                    </button>}
                  </div>
                ))}
              </div>}
              {game.tricks.length === game.cards && <Button className="wide" onClick={() => update(current => ({ ...current, phase: "summary" }))}>Conferir resultado →</Button>}
            </> : <>
              <p className="muted">Informe quantas vazas cada jogador recebeu, incluindo os pontos de bolo.</p>
              <div className="totals-list">
                {active.map(player => <div className="total-row" key={player.id}>
                  <strong>{player.name}</strong>
                  <div className="stepper">
                    <button type="button" aria-label={"Diminuir vazas de " + player.name} onClick={() => update(current => setTotal(current, player.id, (current.totals[player.id] ?? 0) - 1))}
                      disabled={(game.totals[player.id] ?? 0) <= 0}>−</button>
                    <span>{game.totals[player.id] ?? 0}</span>
                    <button type="button" aria-label={"Aumentar vazas de " + player.name} onClick={() => update(current => setTotal(current, player.id, (current.totals[player.id] ?? 0) + 1))}
                      disabled={totalAssigned >= game.cards}>+</button>
                  </div>
                </div>)}
              </div>
              {game.cards - totalAssigned > 0 && <p className="hint">{game.cards - totalAssigned} ponto(s) sem vencedor serão descartados.</p>}
              <Button className="wide" onClick={() => update(closeTotals)}>Conferir resultado →</Button>
            </>}
            <button type="button" className="link below" onClick={() => {
              if (window.confirm("Recomeçar os palpites? Os resultados desta mão serão apagados.")) update(resetBids);
            }}>Corrigir palpites</button>
          </section>
        )}

        {game.phase === "summary" && results && (
          <section className="panel phase-panel">
            <div className="eyebrow">ETAPA 3 · CONFERÊNCIA</div>
            <h2>Resultado da mão</h2>
            <div className="score-table">
              <div className="score-header"><span>Jogador</span><span>Palp.</span><span>Fez</span><span>Perde</span><span>Vidas</span></div>
              {results.scores.map(score => <div className="score-row" key={score.player.id}>
                <span>{score.player.name}</span>
                <span>{score.bid}</span><span>{score.won}</span>
                <span className={score.lost ? "negative" : "positive"}>{score.lost ? "−" + score.lost : "0"}</span>
                <span>{score.remaining}</span>
              </div>)}
            </div>
            {results.discarded > 0 && <p className="hint">{results.discarded} ponto(s) de bolo sem vencedor descartado(s).</p>}
            {results.scores.some(score => score.eliminated) && <div className="elimination-note">
              Eliminado(s): {results.scores.filter(score => score.eliminated).map(score => score.player.name).join(", ")}
            </div>}
            {results.allOut && <div className="bolo">{game.rules.allOutRule === "extra"
              ? "Todos zeraram. A próxima mão será de desempate com 1 vida."
              : "Todos zeraram. A partida terminará empatada."}</div>}
            <Button className="wide" onClick={() => update(advanceHand)}>Confirmar {results.survivors.length <= 1 && !results.allOut ? "resultado final" : "e próxima mão"} →</Button>
            <button type="button" className="link below" onClick={() => update(reopenSummary)}>Corrigir vazas ou totais</button>
          </section>
        )}

        {game.phase === "finished" && (
          <section className="panel finished">
            <div className="trophy">♠</div>
            <div className="eyebrow">RESULTADO FINAL</div>
            <h2>{game.winnerIds.length === 1 ? "Temos um vencedor!" : "Partida empatada"}</h2>
            <div className="winner-name">{game.players.filter(player => game.winnerIds.includes(player.id)).map(player => player.name).join(" & ")}</div>
            <p className="muted">Encerrada após {game.hand} mãos.</p>
            <Button className="wide" onClick={() => setView("home")}>Voltar ao início →</Button>
          </section>
        )}

        {game.phase !== "finished" && <button type="button" className="link bottom-exit" onClick={stopGame}>Encerrar sem salvar esta partida</button>}
      </>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
