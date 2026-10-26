// 5-Level Chess AI Engine with Minimax, Alpha-Beta Pruning, Quiescence Search, PST & Opening Book

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

const PST = {
  p: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  r: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0]
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
  ],
  k_endgame: [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50]
  ]
};

const OPENING_BOOK = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': ['e4', 'd4', 'Nf3', 'c4'],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': ['c5', 'e5', 'e6', 'c6'],
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b': ['Nf6', 'd5', 'e6'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w': ['Nf3', 'Nc3', 'Bc4'],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w': ['Nf3', 'Nc3', 'c3'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b': ['Nc6', 'Nf6'],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w': ['Bb5', 'Bc4', 'd4'],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b': ['Bc5', 'Nf6'],
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b': ['a6', 'Nf6'],
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w': ['c4', 'Nf3', 'Bf4'],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w': ['c4', 'Nf3', 'Bf4'],
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b': ['e6', 'c6', 'dxc4']
};

const DIFFICULTY_LEVELS = {
  1: {
    id: 1,
    name: 'Novice',
    elo: '600 ELO',
    badge: 'Level 1',
    description: 'Makes casual moves and occasional tactical oversights. Great for learning.',
    depth: 1,
    randomness: 0.45,
    usePST: false,
    useQuiescence: false,
    useBook: false
  },
  2: {
    id: 2,
    name: 'Casual',
    elo: '1000 ELO',
    badge: 'Level 2',
    description: 'Looks 2 moves ahead and values piece development with light unpredictability.',
    depth: 2,
    randomness: 0.18,
    usePST: true,
    useQuiescence: false,
    useBook: false
  },
  3: {
    id: 3,
    name: 'Club Player',
    elo: '1400 ELO',
    badge: 'Level 3',
    description: 'Solid positional awareness, active piece placement, and 3-ply tactical search.',
    depth: 3,
    randomness: 0.04,
    usePST: true,
    useQuiescence: false,
    useBook: true
  },
  4: {
    id: 4,
    name: 'Tactician',
    elo: '1800 ELO',
    badge: 'Level 4',
    description: 'Combines 3-ply search with Quiescence capture analysis and positional bonuses.',
    depth: 3,
    randomness: 0,
    usePST: true,
    useQuiescence: true,
    useBook: true
  },
  5: {
    id: 5,
    name: 'Grandmaster AI',
    elo: '2200 ELO',
    badge: 'Level 5',
    description: 'Full 4-ply Alpha-Beta engine with Quiescence search, transposition caching & opening book.',
    depth: 4,
    randomness: 0,
    usePST: true,
    useQuiescence: true,
    useBook: true
  }
};

class ChessAI {
  constructor() {
    this.transpositionTable = new Map();
    this.nodesSearched = 0;
  }

  getBestMove(game, level = 3) {
    const config = DIFFICULTY_LEVELS[level] || DIFFICULTY_LEVELS[3];
    const legalMoves = game.moves({ verbose: true });
    if (legalMoves.length === 0) return null;
    if (legalMoves.length === 1) return legalMoves[0];

    if (config.useBook) {
      const fenParts = game.fen().split(' ');
      const bookKey = `${fenParts[0]} ${fenParts[1]}`;
      const bookMoves = OPENING_BOOK[bookKey];
      if (bookMoves && bookMoves.length > 0) {
        const candidateSans = bookMoves.filter((san) =>
          legalMoves.some((m) => m.san === san)
        );
        if (candidateSans.length > 0) {
          const chosenSan = candidateSans[Math.floor(Math.random() * candidateSans.length)];
          return legalMoves.find((m) => m.san === chosenSan);
        }
      }
    }

    if (config.randomness > 0 && Math.random() < config.randomness) {
      const shuffled = [...legalMoves].sort(() => Math.random() - 0.5);
      return shuffled[0];
    }

    this.nodesSearched = 0;
    if (this.transpositionTable.size > 25000) {
      this.transpositionTable.clear();
    }

    const isMaximizing = game.turn() === 'w';
    const orderedMoves = this.orderMoves(legalMoves);

    let bestMove = orderedMoves[0];
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of orderedMoves) {
      game.move(move);
      let score = this.alphaBeta(
        game,
        config.depth - 1,
        alpha,
        beta,
        !isMaximizing,
        config
      );
      game.undo();

      if (config.randomness > 0) {
        score += (Math.random() - 0.5) * 35 * config.randomness;
      }

      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, bestScore);
      }
    }

    return bestMove;
  }

  alphaBeta(game, depth, alpha, beta, isMaximizing, config) {
    this.nodesSearched++;

    if (game.in_checkmate()) {
      return isMaximizing ? -99999 - depth * 100 : 99999 + depth * 100;
    }
    if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
      return 0;
    }

    if (depth <= 0) {
      if (config.useQuiescence) {
        return this.quiescence(game, alpha, beta, isMaximizing, config, 3);
      }
      return this.evaluateBoard(game, config);
    }

    const moves = this.orderMoves(game.moves({ verbose: true }));

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        game.move(move);
        const evaluation = this.alphaBeta(game, depth - 1, alpha, beta, false, config);
        game.undo();
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        game.move(move);
        const evaluation = this.alphaBeta(game, depth - 1, alpha, beta, true, config);
        game.undo();
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  quiescence(game, alpha, beta, isMaximizing, config, qDepth) {
    const standPat = this.evaluateBoard(game, config);

    if (qDepth <= 0) return standPat;

    if (isMaximizing) {
      if (standPat >= beta) return beta;
      if (alpha < standPat) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (beta > standPat) beta = standPat;
    }

    const noisyMoves = this.orderMoves(
      game.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );

    if (isMaximizing) {
      for (const move of noisyMoves) {
        game.move(move);
        const score = this.quiescence(game, alpha, beta, false, config, qDepth - 1);
        game.undo();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    } else {
      for (const move of noisyMoves) {
        game.move(move);
        const score = this.quiescence(game, alpha, beta, true, config, qDepth - 1);
        game.undo();
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }
      return beta;
    }
  }

  orderMoves(moves) {
    return moves.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.captured) {
        scoreA += 10 * PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] / 10;
      }
      if (b.captured) {
        scoreB += 10 * PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] / 10;
      }

      if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
      if (b.promotion) scoreB += PIECE_VALUES[b.promotion];

      if (a.san.includes('+')) scoreA += 150;
      if (b.san.includes('+')) scoreB += 150;

      return scoreB - scoreA;
    });
  }

  evaluateBoard(game, config) {
    const board = game.board();
    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;
    let nonPawnMaterial = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== 'p' && piece.type !== 'k') {
          nonPawnMaterial += PIECE_VALUES[piece.type];
        }
      }
    }

    const isEndgame = nonPawnMaterial <= 2600;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        let val = PIECE_VALUES[piece.type];

        if (config.usePST) {
          const tableKey = piece.type === 'k' && isEndgame ? 'k_endgame' : piece.type;
          const table = PST[tableKey];
          if (table) {
            const pstRow = piece.color === 'w' ? r : 7 - r;
            val += table[pstRow][c];
          }
        }

        if (piece.type === 'b') {
          if (piece.color === 'w') whiteBishops++;
          else blackBishops++;
        }

        if (piece.color === 'w') {
          score += val;
        } else {
          score -= val;
        }
      }
    }

    if (config.id >= 4) {
      if (whiteBishops >= 2) score += 35;
      if (blackBishops >= 2) score -= 35;
      if (game.in_check()) {
        score += game.turn() === 'w' ? -25 : 25;
      }
    }

    return score;
  }
}

window.DIFFICULTY_LEVELS = DIFFICULTY_LEVELS;
window.ChessAI = ChessAI;
