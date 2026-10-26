# Grandmaster 3D Chess — Saved PWA Version (v5)

This directory contains the saved, verified **v5** release of **Grandmaster 3D Chess PWA**.

## Saved Files
- [`index.html`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/index.html) — Main application shell & UI
- [`manifest.json`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/manifest.json) — Web App Manifest for PWA installation
- [`sw.js`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/sw.js) — Offline Service Worker (`chess-3d-pwa-v5`)
- [`css/styles.css`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/css/styles.css) — Luxury dark & gold glassmorphic UI styling
- [`js/board3d.js`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/js/board3d.js) — 3D Chessboard with Dual-Tone 3D Grid Bars, Lambert glare-free squares, Staunton 3D pieces, and smooth spherical orbit camera
- [`js/ai.js`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/js/ai.js) — 5-Level Chess AI Engine (600 to 2200 ELO)
- [`js/sound.js`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/js/sound.js) — Web Audio API sound synthesizer
- [`js/app.js`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/js/app.js) — Game controller & PWA installer
- [`icons/icon.svg`](file:///C:/Users/pelpa/.gemini/antigravity/scratch/chess-3d-pwa/icons/icon.svg) — Scalable vector app icon

## How to Launch
1. **Direct Launch**: Open `index.html` directly in any modern browser.
2. **Local PWA Server**:
   ```powershell
   python -m http.server 8080 --directory "C:\Users\pelpa\.gemini\antigravity\scratch\chess-3d-pwa"
   ```
   Then open `http://localhost:8080`.
