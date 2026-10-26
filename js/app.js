// Main Application Controller for Grandmaster 3D Chess PWA
const PIECE_UNICODE = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const MATERIAL_WORTH = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

class ChessApp {
  constructor() {
    this.game = new window.Chess();
    this.ai = new window.ChessAI();
    this.sound = new window.SoundFX();

    this.playerColor = 'w';
    this.difficulty = parseInt(localStorage.getItem('chess3d_difficulty') || '3', 10);
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null;
    this.isAnimating = false;
    this.isAIThinking = false;
    this.pendingPromotion = null;
    this.deferredInstallPrompt = null;

    this.initDOM();
    this.board3d = new window.Board3D(this.canvasContainer, {
      onSquareClick: (sq) => this.handleSquareClick(sq)
    });

    this.bindUIEvents();
    this.updateDifficultyUI();
    this.startNewGame(false);
    this.registerPWA();
  }

  initDOM() {
    this.canvasContainer = document.getElementById('canvas-container');
    this.statusText = document.getElementById('status-text');
    this.statusBanner = document.getElementById('status-banner');
    this.turnDot = document.getElementById('turn-dot');
    this.thinkingBadge = document.getElementById('thinking-badge');

    this.diffButtons = document.querySelectorAll('.diff-btn');
    this.diffNameEl = document.getElementById('diff-name');
    this.diffEloEl = document.getElementById('diff-elo');
    this.diffDescEl = document.getElementById('diff-desc');

    this.colorButtons = document.querySelectorAll('.color-btn');
    this.camButtons = document.querySelectorAll('.cam-btn');
    this.themeSelect = document.getElementById('theme-select');

    this.capturedByWhiteEl = document.getElementById('captured-by-white');
    this.capturedByBlackEl = document.getElementById('captured-by-black');
    this.whiteAdvEl = document.getElementById('white-adv');
    this.blackAdvEl = document.getElementById('black-adv');

    this.historyList = document.getElementById('history-list');

    this.btnNewGame = document.getElementById('btn-new-game');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnHint = document.getElementById('btn-hint');
    this.btnSound = document.getElementById('btn-sound');
    this.btnInstall = document.getElementById('btn-install');

    this.promoModal = document.getElementById('promo-modal');
    this.promoButtons = document.querySelectorAll('.promo-btn');

    this.gameOverModal = document.getElementById('gameover-modal');
    this.gameOverTitle = document.getElementById('gameover-title');
    this.gameOverSubtitle = document.getElementById('gameover-subtitle');
    this.btnPlayAgain = document.getElementById('btn-play-again');

    this.installModal = document.getElementById('install-modal');
    this.installModalTitle = document.getElementById('install-modal-title');
    this.installModalDesc = document.getElementById('install-modal-desc');
    this.btnDownloadLocalInstaller = document.getElementById('btn-download-local-installer');
    this.btnDownloadStandalone = document.getElementById('btn-download-standalone');
    this.btnCloseInstall = document.getElementById('btn-close-install');
  }

  bindUIEvents() {
    this.diffButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.difficulty = parseInt(btn.dataset.level, 10);
        localStorage.setItem('chess3d_difficulty', String(this.difficulty));
        this.sound.playSelect();
        this.updateDifficultyUI();
      });
    });

    this.colorButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.dataset.color;
        if (chosen === this.playerColor) return;
        this.playerColor = chosen;
        this.colorButtons.forEach((b) => b.classList.toggle('active', b === btn));
        this.sound.playSelect();
        this.startNewGame(true);
      });
    });

    this.camButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.cam;
        this.camButtons.forEach((b) => b.classList.toggle('active', b === btn));
        this.board3d.setCameraPreset(preset, true);
        this.sound.playSelect();
      });
    });

    this.themeSelect.addEventListener('change', (e) => {
      this.board3d.setTheme(e.target.value);
      this.sound.playSelect();
    });

    this.btnNewGame.addEventListener('click', () => {
      this.sound.playSelect();
      this.startNewGame(true);
    });

    this.btnUndo.addEventListener('click', () => this.undoMove());
    this.btnHint.addEventListener('click', () => this.showHint());

    this.btnSound.addEventListener('click', () => {
      const enabled = this.sound.toggle();
      this.btnSound.textContent = enabled ? '🔊 Sound: On' : '🔇 Sound: Off';
      if (enabled) this.sound.playSelect();
    });

    this.promoButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pieceType = btn.dataset.piece;
        this.promoModal.classList.add('hidden');
        if (this.pendingPromotion) {
          const { from, to } = this.pendingPromotion;
          this.pendingPromotion = null;
          this.executePlayerMove(from, to, pieceType);
        }
      });
    });

    this.btnPlayAgain.addEventListener('click', () => {
      this.gameOverModal.classList.add('hidden');
      this.startNewGame(true);
    });

    this.btnInstall.addEventListener('click', () => this.handleInstallClick());

    if (this.btnCloseInstall) {
      this.btnCloseInstall.addEventListener('click', () => {
        this.installModal.classList.add('hidden');
      });
    }

    if (this.btnDownloadLocalInstaller) {
      this.btnDownloadLocalInstaller.addEventListener('click', () => {
        this.sound.playSelect();
        this.downloadWindowsAppInstaller();
      });
    }

    if (this.btnDownloadStandalone) {
      this.btnDownloadStandalone.addEventListener('click', () => {
        this.sound.playSelect();
        this.downloadStandaloneApp();
      });
    }
  }

  updateDifficultyUI() {
    const levels = window.DIFFICULTY_LEVELS;
    const info = levels[this.difficulty] || levels[3];
    this.diffButtons.forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.level, 10) === this.difficulty);
    });
    this.diffNameEl.textContent = `${info.badge} — ${info.name}`;
    this.diffEloEl.textContent = info.elo;
    this.diffDescEl.textContent = info.description;
  }

  startNewGame(animateCam = true) {
    this.game.reset();
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null;
    this.isAnimating = false;
    this.isAIThinking = false;
    this.pendingPromotion = null;
    this.promoModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');

    this.board3d.syncBoard(this.game, null);

    const camPreset = this.playerColor === 'w' ? 'white' : 'black';
    this.board3d.setCameraPreset(camPreset, animateCam);
    this.camButtons.forEach((b) => b.classList.toggle('active', b.dataset.cam === camPreset));

    this.updateHUD();

    if (this.playerColor === 'b') {
      this.triggerAIMove();
    }
  }

  handleSquareClick(sq) {
    if (this.isAnimating || this.isAIThinking || this.game.game_over()) return;
    if (this.game.turn() !== this.playerColor) return;

    const moveCandidate = this.legalMovesForSelected.find((m) => m.to === sq);
    if (this.selectedSquare && moveCandidate) {
      const piece = this.game.get(this.selectedSquare);
      const isPromo =
        piece &&
        piece.type === 'p' &&
        ((piece.color === 'w' && sq[1] === '8') || (piece.color === 'b' && sq[1] === '1'));

      if (isPromo) {
        this.pendingPromotion = { from: this.selectedSquare, to: sq };
        this.promoModal.classList.remove('hidden');
        return;
      }

      this.executePlayerMove(this.selectedSquare, sq, 'q');
      return;
    }

    const clickedPiece = this.game.get(sq);
    if (clickedPiece && clickedPiece.color === this.playerColor) {
      if (this.selectedSquare === sq) {
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
      } else {
        this.selectedSquare = sq;
        this.legalMovesForSelected = this.game.moves({ square: sq, verbose: true });
        this.sound.playSelect();
      }
      this.board3d.renderHighlights(
        this.game,
        this.selectedSquare,
        this.legalMovesForSelected,
        this.lastMove
      );
    } else {
      this.selectedSquare = null;
      this.legalMovesForSelected = [];
      this.board3d.renderHighlights(this.game, null, [], this.lastMove);
    }
  }

  executePlayerMove(from, to, promotion = 'q') {
    const moveObj = this.game.move({ from, to, promotion });
    if (!moveObj) return;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = { from: moveObj.from, to: moveObj.to };
    this.isAnimating = true;

    this.board3d.renderHighlights(this.game, null, [], this.lastMove);
    this.playMoveSound(moveObj);
    this.updateHUD();

    this.board3d.animateMove(moveObj, () => {
      if (moveObj.promotion) {
        this.board3d.syncBoard(this.game, this.lastMove);
      } else {
        this.board3d.renderHighlights(this.game, null, [], this.lastMove);
      }
      this.isAnimating = false;

      if (this.checkGameOver()) return;
      this.triggerAIMove();
    });
  }

  triggerAIMove() {
    if (this.game.game_over()) return;
    this.isAIThinking = true;
    this.thinkingBadge.classList.remove('hidden');
    this.updateHUD();

    setTimeout(() => {
      const aiMove = this.ai.getBestMove(this.game, this.difficulty);
      this.thinkingBadge.classList.add('hidden');
      this.isAIThinking = false;

      if (!aiMove) {
        this.checkGameOver();
        return;
      }

      const moveObj = this.game.move(aiMove);
      this.lastMove = { from: moveObj.from, to: moveObj.to };
      this.isAnimating = true;
      this.playMoveSound(moveObj);
      this.updateHUD();

      this.board3d.animateMove(moveObj, () => {
        if (moveObj.promotion) {
          this.board3d.syncBoard(this.game, this.lastMove);
        } else {
          this.board3d.renderHighlights(this.game, null, [], this.lastMove);
        }
        this.isAnimating = false;
        this.checkGameOver();
        this.updateHUD();
      });
    }, 260);
  }

  playMoveSound(moveObj) {
    if (this.game.in_check()) {
      this.sound.playCheck();
    } else if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) {
      this.sound.playCastle();
    } else if (moveObj.captured) {
      this.sound.playCapture();
    } else {
      this.sound.playMove();
    }
  }

  undoMove() {
    if (this.isAnimating || this.isAIThinking) return;
    const history = this.game.history();
    if (history.length === 0) return;

    if (this.game.turn() === this.playerColor && history.length >= 2) {
      this.game.undo();
      this.game.undo();
    } else {
      this.game.undo();
    }

    const verboseHist = this.game.history({ verbose: true });
    const prev = verboseHist[verboseHist.length - 1];
    this.lastMove = prev ? { from: prev.from, to: prev.to } : null;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    this.sound.playSelect();
    this.board3d.syncBoard(this.game, this.lastMove);
    this.updateHUD();
  }

  showHint() {
    if (this.isAnimating || this.isAIThinking || this.game.game_over()) return;
    if (this.game.turn() !== this.playerColor) return;

    const hintMove = this.ai.getBestMove(this.game, 4);
    if (!hintMove) return;

    this.selectedSquare = hintMove.from;
    this.legalMovesForSelected = [hintMove];
    this.sound.playSelect();
    this.board3d.renderHighlights(
      this.game,
      this.selectedSquare,
      this.legalMovesForSelected,
      this.lastMove
    );
  }

  updateHUD() {
    const turn = this.game.turn();
    const inCheck = this.game.in_check();

    this.turnDot.className = `turn-dot ${turn === 'b' ? 'black' : ''}`;
    this.statusBanner.classList.toggle('in-check', inCheck);

    if (this.game.game_over()) {
      if (this.game.in_checkmate()) {
        const winner = turn === 'w' ? 'Black' : 'White';
        this.statusText.textContent = `Checkmate — ${winner} Wins!`;
      } else {
        this.statusText.textContent = 'Game Drawn';
      }
    } else {
      const turnLabel = turn === this.playerColor ? 'Your Turn' : 'Computer Thinking...';
      const colorName = turn === 'w' ? 'White' : 'Black';
      this.statusText.textContent = inCheck
        ? `${colorName} is in Check! (${turnLabel})`
        : `${colorName} to Move • ${turnLabel}`;
    }

    this.btnUndo.disabled = this.game.history().length === 0 || this.isAIThinking;
    this.btnHint.disabled = turn !== this.playerColor || this.game.game_over() || this.isAIThinking;

    this.updateCapturesAndScore();
    this.updateMoveHistory();
  }

  updateCapturesAndScore() {
    const history = this.game.history({ verbose: true });
    const capturedByWhite = [];
    const capturedByBlack = [];

    history.forEach((m) => {
      if (m.captured) {
        if (m.color === 'w') capturedByWhite.push(m.captured);
        else capturedByBlack.push(m.captured);
      }
    });

    const order = ['q', 'r', 'b', 'n', 'p'];
    capturedByWhite.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    capturedByBlack.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    this.capturedByWhiteEl.textContent =
      capturedByWhite.map((p) => PIECE_UNICODE.b[p]).join(' ') || '—';
    this.capturedByBlackEl.textContent =
      capturedByBlack.map((p) => PIECE_UNICODE.w[p]).join(' ') || '—';

    let whiteScore = 0;
    let blackScore = 0;
    const board = this.game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        if (p.color === 'w') whiteScore += MATERIAL_WORTH[p.type];
        else blackScore += MATERIAL_WORTH[p.type];
      }
    }

    const diff = whiteScore - blackScore;
    this.whiteAdvEl.textContent = diff > 0 ? `+${diff}` : '';
    this.blackAdvEl.textContent = diff < 0 ? `+${Math.abs(diff)}` : '';
  }

  updateMoveHistory() {
    const history = this.game.history();
    this.historyList.innerHTML = '';

    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'history-row';

      const numSpan = document.createElement('span');
      numSpan.className = 'history-num';
      numSpan.textContent = `${Math.floor(i / 2) + 1}.`;

      const whiteSpan = document.createElement('span');
      whiteSpan.className = `history-move ${i === history.length - 1 ? 'latest' : ''}`;
      whiteSpan.textContent = history[i];

      const blackSpan = document.createElement('span');
      blackSpan.className = `history-move ${i + 1 === history.length - 1 ? 'latest' : ''}`;
      blackSpan.textContent = history[i + 1] || '';

      row.appendChild(numSpan);
      row.appendChild(whiteSpan);
      row.appendChild(blackSpan);
      this.historyList.appendChild(row);
    }

    this.historyList.scrollTop = this.historyList.scrollHeight;
  }

  checkGameOver() {
    if (!this.game.game_over()) return false;

    const turn = this.game.turn();
    let title = 'Game Over';
    let subtitle = '';
    let playerWon = false;

    if (this.game.in_checkmate()) {
      const winnerColor = turn === 'w' ? 'b' : 'w';
      playerWon = winnerColor === this.playerColor;
      const lvlName = window.DIFFICULTY_LEVELS[this.difficulty].name;
      title = playerWon ? 'Victory by Checkmate!' : 'Checkmate!';
      subtitle = playerWon
        ? `You defeated the ${lvlName} AI (Level ${this.difficulty})!`
        : `The ${lvlName} AI (Level ${this.difficulty}) won the match.`;
    } else if (this.game.in_stalemate()) {
      title = 'Draw by Stalemate';
      subtitle = 'No legal moves remain, and the King is not in check.';
    } else if (this.game.in_threefold_repetition()) {
      title = 'Draw by Repetition';
      subtitle = 'The exact same board position has occurred three times.';
    } else if (this.game.insufficient_material()) {
      title = 'Draw — Insufficient Material';
      subtitle = 'Neither side has sufficient material to force checkmate.';
    } else {
      title = '50-Move Rule Draw';
      subtitle = '50 consecutive moves occurred without a pawn advance or capture.';
    }

    this.sound.playGameOver(playerWon);
    this.gameOverTitle.textContent = title;
    this.gameOverSubtitle.textContent = subtitle;
    this.gameOverModal.classList.remove('hidden');
    this.updateHUD();
    return true;
  }

  createIconPNGBlob(size) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#1a1c29');
      grad.addColorStop(1, '#0b0c12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = Math.max(4, Math.floor(size * 0.04));
      const pad = Math.floor(size * 0.08);
      ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);

      ctx.fillStyle = '#f5d76e';
      ctx.font = `bold ${Math.floor(size * 0.54)}px "Segoe UI Symbol", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♞', size / 2, size * 0.53);

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  async populatePNGIconsInCache() {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open('chess-3d-pwa-v9');
      for (const size of [192, 512]) {
        const blob = await this.createIconPNGBlob(size);
        if (blob) {
          const response = new Response(blob, {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'image/png' }
          });
          await cache.put(`./icons/icon-${size}.png`, response);
        }
      }
    } catch (e) {}
  }

  registerPWA() {
    if (
      'serviceWorker' in navigator &&
      (location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1')
    ) {
      this.populatePNGIconsInCache().then(() => {
        navigator.serviceWorker
          .register('./sw.js', { scope: './' })
          .then((reg) => {
            reg.update();
          })
          .catch(() => {});
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      this.btnInstall.textContent = '📲 Install Local App Now';
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.btnInstall.textContent = '✅ Local App Installed';
      if (this.installModal) this.installModal.classList.add('hidden');
    });
  }

  async handleInstallClick() {
    this.sound.playSelect();

    if (this.deferredInstallPrompt) {
      this.deferredInstallPrompt.prompt();
      const { outcome } = await this.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        this.deferredInstallPrompt = null;
        this.btnInstall.textContent = '✅ Local App Installed';
      }
      return;
    }

    if (window.location.protocol === 'file:') {
      try {
        const res = await fetch('http://localhost:8080/manifest.json', { mode: 'cors' });
        if (res.ok) {
          window.location.href = 'http://localhost:8080/';
          return;
        }
      } catch (e) {}
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      this.installModalTitle.textContent = '✅ Running as Local App';
      this.installModalDesc.textContent =
        'Grandmaster 3D Chess is already running in standalone local app mode!';
    } else {
      this.installModalTitle.textContent = 'Install as Local Desktop App';
      this.installModalDesc.textContent =
        'Click the gold button below to download and run the 1-Click Local App Installer, or double-click Install-Local-App.bat in the project folder:';
    }

    this.installModal.classList.remove('hidden');
  }

  downloadWindowsAppInstaller() {
    const psPath = 'C:\\Users\\pelpa\\.gemini\\antigravity\\scratch\\chess-3d-pwa\\install-and-run.ps1';
    const batContent = [
      '@echo off',
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + psPath + '"'
    ].join('\r\n');

    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Install-Local-App.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async downloadStandaloneApp() {
    const styleSheets = Array.from(document.styleSheets);
    let cssText = '';
    try {
      for (const sheet of styleSheets) {
        if (sheet.cssRules) {
          for (const rule of sheet.cssRules) {
            cssText += rule.cssText + '\n';
          }
        }
      }
    } catch (e) {}

    const clone = document.documentElement.cloneNode(true);
    const modal = clone.querySelector('#install-modal');
    if (modal) modal.classList.add('hidden');

    if (cssText) {
      const link = clone.querySelector('link[href^="css/styles.css"]');
      if (link) {
        const styleEl = document.createElement('style');
        styleEl.textContent = cssText;
        link.replaceWith(styleEl);
      }
    }

    const scripts = clone.querySelectorAll('script[src]');
    scripts.forEach((s) => {
      const src = s.getAttribute('src');
      if (src && !src.startsWith('http')) {
        s.setAttribute('src', new URL(src, window.location.href).href);
      }
    });

    const htmlString = '<!DOCTYPE html>\n' + clone.outerHTML;
    const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Grandmaster-3D-Chess.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new ChessApp();
});
