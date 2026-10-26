// 3D Chess Board & Staunton Piece Engine — High-Contrast Dual-Tone 3D Grid Lines
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const SQUARE_SIZE = 1.25;
const BOARD_OFFSET = (7 * SQUARE_SIZE) / 2;

const BOARD_THEMES = {
  classic: {
    name: 'Classic Walnut & Ivory',
    lightSquare: '#f5deb3',
    darkSquare: '#5c2e14',
    gridOuterHex: 0x050505,
    gridCenterHex: 0xd4af37,
    gridLineColor: '#050505',
    groutColor: '#050505',
    frameColor: '#261307',
    frameTrim: '#d4af37',
    whitePiece: { color: 0xfaf3e3, specular: 0x555555, shininess: 55 },
    blackPiece: { color: 0x222730, specular: 0x666666, shininess: 75 },
    grainStyle: 'wood'
  },
  royal: {
    name: 'Obsidian & Gold Marble',
    lightSquare: '#e6ecf2',
    darkSquare: '#1c2433',
    gridOuterHex: 0x05070a,
    gridCenterHex: 0xf5cc51,
    gridLineColor: '#05070a',
    groutColor: '#05070a',
    frameColor: '#0f131a',
    frameTrim: '#f5cc51',
    whitePiece: { color: 0xf0c954, specular: 0xffe699, shininess: 95 },
    blackPiece: { color: 0x323b4d, specular: 0x8ea4d2, shininess: 85 },
    grainStyle: 'marble'
  },
  emerald: {
    name: 'Grandmaster Tournament',
    lightSquare: '#eeeed2',
    darkSquare: '#2f5e3b',
    gridOuterHex: 0x071209,
    gridCenterHex: 0xe0b841,
    gridLineColor: '#071209',
    groutColor: '#071209',
    frameColor: '#17261b',
    frameTrim: '#d4af37',
    whitePiece: { color: 0xfcf8f0, specular: 0x555555, shininess: 55 },
    blackPiece: { color: 0x3b2314, specular: 0x665544, shininess: 65 },
    grainStyle: 'wood'
  }
};

class Board3D {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.onSquareClick = callbacks.onSquareClick || (() => {});
    this.webglAvailable = true;

    const width = (container && container.clientWidth) || window.innerWidth || 1024;
    const height = (container && container.clientHeight) || window.innerHeight || 768;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

    // Safe WebGLRenderer initialization (prevents crashes in headless scanners like PWABuilder)
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      });
    } catch (e1) {
      try {
        this.renderer = new THREE.WebGLRenderer();
      } catch (e2) {
        this.webglAvailable = false;
        this.renderer = null;
      }
    }

    if (this.renderer) {
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (container) {
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);
      }
    } else if (container) {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = width;
      fallbackCanvas.height = height;
      container.innerHTML = '';
      container.appendChild(fallbackCanvas);
    }

    // Built-in Smooth Spherical Orbit Camera State
    this.spherical = new THREE.Spherical(13.8, 0.82, 0);
    this.targetSpherical = new THREE.Spherical(13.8, 0.82, 0);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.isDraggingOrbit = false;
    this.prevPointer = { x: 0, y: 0 };
    this.pointerDownPos = { x: 0, y: 0 };

    // Groups
    this.boardGroup = new THREE.Group();
    this.piecesGroup = new THREE.Group();
    this.highlightsGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);
    this.scene.add(this.highlightsGroup);

    // State maps
    this.squareMeshes = new Map();
    this.pieceMeshes = new Map();
    this.activeAnimations = [];
    this.currentTheme = 'classic';

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.initLights();
    this.initMaterials();
    this.initGeometries();
    this.buildBoard();
    this.setCameraPreset('white', false);
    if (this.renderer) {
      this.bindEvents();
      this.clock = new THREE.Clock();
      this.animate();
    }
  }

  initLights() {
    const ambient = new THREE.HemisphereLight(0xffffff, 0x222938, 0.6);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 0.82);
    keyLight.position.set(8, 16, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 35;
    const d = 7.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x90b8ff, 0.35);
    rimLight.position.set(-10, 10, -9);
    this.scene.add(rimLight);
  }

  createProceduralSquareTexture(baseColor, accentColor, style = 'wood') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);

    if (style === 'wood') {
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
        const y = Math.random() * 256;
        const h = 1 + Math.random() * 3;
        ctx.fillRect(0, y, 256, h);
      }
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 256, 0);
        ctx.bezierCurveTo(
          Math.random() * 256, 85,
          Math.random() * 256, 170,
          Math.random() * 256, 256
        );
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 18;
    ctx.strokeRect(0, 0, 256, 256);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 236, 236);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  initMaterials() {
    const theme = BOARD_THEMES[this.currentTheme];

    this.whitePieceMat = new THREE.MeshPhongMaterial({
      color: theme.whitePiece.color,
      specular: theme.whitePiece.specular,
      shininess: theme.whitePiece.shininess
    });

    this.blackPieceMat = new THREE.MeshPhongMaterial({
      color: theme.blackPiece.color,
      specular: theme.blackPiece.specular,
      shininess: theme.blackPiece.shininess
    });

    this.feltMat = new THREE.MeshLambertMaterial({
      color: 0x14532d
    });

    this.updateBoardMaterials(theme);
  }

  updateBoardMaterials(theme) {
    this.lightSquareMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: this.createProceduralSquareTexture(theme.lightSquare, theme.frameTrim, theme.grainStyle)
    });

    this.darkSquareMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: this.createProceduralSquareTexture(theme.darkSquare, theme.frameTrim, theme.grainStyle)
    });

    this.groutMat = new THREE.MeshBasicMaterial({
      color: theme.groutColor
    });

    this.gridOuterMat = new THREE.MeshBasicMaterial({
      color: theme.gridOuterHex
    });

    this.gridCenterMat = new THREE.MeshBasicMaterial({
      color: theme.gridCenterHex
    });

    this.frameMat = new THREE.MeshPhongMaterial({
      color: theme.frameColor,
      specular: 0x221100,
      shininess: 30
    });

    this.trimMat = new THREE.MeshPhongMaterial({
      color: theme.frameTrim,
      specular: 0xfff0b3,
      shininess: 80
    });
  }

  setTheme(themeKey) {
    if (!BOARD_THEMES[themeKey]) return;
    this.currentTheme = themeKey;
    const theme = BOARD_THEMES[themeKey];

    this.whitePieceMat.color.setHex(theme.whitePiece.color);
    this.whitePieceMat.specular.setHex(theme.whitePiece.specular);
    this.whitePieceMat.shininess = theme.whitePiece.shininess;

    this.blackPieceMat.color.setHex(theme.blackPiece.color);
    this.blackPieceMat.specular.setHex(theme.blackPiece.specular);
    this.blackPieceMat.shininess = theme.blackPiece.shininess;

    this.updateBoardMaterials(theme);
    this.buildBoard();
  }

  initGeometries() {
    this.pieceGeometries = {};
    const segments = 32;

    const makeLathe = (pts) => {
      const vectors = pts.map(([x, y]) => new THREE.Vector2(x, y));
      return new THREE.LatheGeometry(vectors, segments);
    };

    this.pieceGeometries.p = [
      makeLathe([
        [0, 0.02], [0.38, 0.02], [0.38, 0.09], [0.33, 0.14],
        [0.27, 0.2], [0.16, 0.48], [0.13, 0.72], [0.24, 0.77],
        [0.14, 0.82], [0, 0.82]
      ])
    ];
    const pawnHead = new THREE.SphereGeometry(0.21, 28, 20);
    pawnHead.translate(0, 1.0, 0);
    this.pieceGeometries.p.push(pawnHead);

    const rookBase = makeLathe([
      [0, 0.02], [0.42, 0.02], [0.42, 0.1], [0.36, 0.16],
      [0.3, 0.24], [0.24, 0.85], [0.31, 0.92], [0.31, 1.12],
      [0.21, 1.12], [0.21, 1.02], [0, 1.02]
    ]);
    this.pieceGeometries.r = [rookBase];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6;
      const merlon = new THREE.BoxGeometry(0.11, 0.14, 0.09);
      merlon.rotateY(-angle);
      merlon.translate(Math.cos(angle) * 0.26, 1.18, Math.sin(angle) * 0.26);
      this.pieceGeometries.r.push(merlon);
    }

    const bishopBase = makeLathe([
      [0, 0.02], [0.41, 0.02], [0.41, 0.1], [0.35, 0.16],
      [0.27, 0.24], [0.16, 0.76], [0.26, 0.81], [0.17, 0.86],
      [0.25, 1.08], [0.2, 1.28], [0.08, 1.42], [0, 1.44]
    ]);
    const bishopTopBall = new THREE.SphereGeometry(0.065, 20, 16);
    bishopTopBall.translate(0, 1.49, 0);
    this.pieceGeometries.b = [bishopBase, bishopTopBall];

    const knightPedestal = makeLathe([
      [0, 0.02], [0.42, 0.02], [0.42, 0.1], [0.36, 0.17],
      [0.29, 0.26], [0.24, 0.36], [0, 0.36]
    ]);

    const horseShape = new THREE.Shape();
    horseShape.moveTo(-0.18, 0.34);
    horseShape.lineTo(0.18, 0.34);
    horseShape.bezierCurveTo(0.22, 0.55, 0.14, 0.75, 0.26, 0.92);
    horseShape.lineTo(0.34, 0.87);
    horseShape.lineTo(0.4, 0.95);
    horseShape.lineTo(0.36, 1.06);
    horseShape.lineTo(0.16, 1.18);
    horseShape.lineTo(0.12, 1.34);
    horseShape.lineTo(0.02, 1.24);
    horseShape.bezierCurveTo(-0.22, 1.15, -0.28, 0.78, -0.18, 0.34);

    const extrudeSettings = {
      steps: 1,
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 4
    };
    const knightHead = new THREE.ExtrudeGeometry(horseShape, extrudeSettings);
    knightHead.translate(0, 0, -0.11);
    knightHead.rotateY(Math.PI / 2);
    this.pieceGeometries.n = [knightPedestal, knightHead];

    const queenBody = makeLathe([
      [0, 0.02], [0.45, 0.02], [0.45, 0.11], [0.39, 0.18],
      [0.31, 0.27], [0.18, 0.88], [0.3, 0.94], [0.2, 1.0],
      [0.28, 1.36], [0.33, 1.5], [0.22, 1.46], [0, 1.44]
    ]);
    this.pieceGeometries.q = [queenBody];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const pearl = new THREE.SphereGeometry(0.048, 14, 12);
      pearl.translate(Math.cos(angle) * 0.29, 1.54, Math.sin(angle) * 0.29);
      this.pieceGeometries.q.push(pearl);
    }
    const queenOrb = new THREE.SphereGeometry(0.08, 18, 14);
    queenOrb.translate(0, 1.56, 0);
    this.pieceGeometries.q.push(queenOrb);

    const kingBody = makeLathe([
      [0, 0.02], [0.47, 0.02], [0.47, 0.12], [0.41, 0.19],
      [0.33, 0.29], [0.2, 0.96], [0.33, 1.03], [0.22, 1.1],
      [0.31, 1.48], [0.35, 1.6], [0.24, 1.65], [0, 1.65]
    ]);
    const crossVert = new THREE.BoxGeometry(0.075, 0.28, 0.075);
    crossVert.translate(0, 1.81, 0);
    const crossHoriz = new THREE.BoxGeometry(0.22, 0.075, 0.075);
    crossHoriz.translate(0, 1.84, 0);
    this.pieceGeometries.k = [kingBody, crossVert, crossHoriz];
  }

  buildBoard() {
    while (this.boardGroup.children.length > 0) {
      this.boardGroup.remove(this.boardGroup.children[0]);
    }
    this.squareMeshes.clear();

    const boardWidth = 8 * SQUARE_SIZE;
    const frameWidth = boardWidth + 1.4;

    const frameGeo = new THREE.BoxGeometry(frameWidth, 0.5, frameWidth);
    const frameMesh = new THREE.Mesh(frameGeo, this.frameMat);
    frameMesh.position.y = -0.29;
    frameMesh.receiveShadow = true;
    frameMesh.castShadow = true;
    this.boardGroup.add(frameMesh);

    const trimGeo = new THREE.BoxGeometry(boardWidth + 0.26, 0.5, boardWidth + 0.26);
    const trimMesh = new THREE.Mesh(trimGeo, this.trimMat);
    trimMesh.position.y = -0.28;
    this.boardGroup.add(trimMesh);

    const groutGeo = new THREE.BoxGeometry(boardWidth + 0.1, 0.16, boardWidth + 0.1);
    const groutMesh = new THREE.Mesh(groutGeo, this.groutMat);
    groutMesh.position.y = -0.095;
    this.boardGroup.add(groutMesh);

    const tileGap = 0.08;
    const squareGeo = new THREE.BoxGeometry(
      SQUARE_SIZE - tileGap,
      0.16,
      SQUARE_SIZE - tileGap
    );

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const sqName = `${FILES[c]}${8 - r}`;
        const mesh = new THREE.Mesh(
          squareGeo,
          isLight ? this.lightSquareMat : this.darkSquareMat
        );

        const pos = this.squareToWorld(sqName);
        mesh.position.set(pos.x, -0.08, pos.z);
        mesh.receiveShadow = true;
        mesh.userData = { square: sqName, isLight };

        this.boardGroup.add(mesh);
        this.squareMeshes.set(sqName, mesh);
      }
    }

    const halfBoard = boardWidth / 2;
    const outerWidth = 0.085;
    const innerWidth = 0.028;

    const fileOuterGeo = new THREE.BoxGeometry(outerWidth, 0.025, boardWidth + outerWidth);
    const rankOuterGeo = new THREE.BoxGeometry(boardWidth + outerWidth, 0.025, outerWidth);

    const fileInnerGeo = new THREE.BoxGeometry(innerWidth, 0.032, boardWidth + outerWidth);
    const rankInnerGeo = new THREE.BoxGeometry(boardWidth + outerWidth, 0.032, innerWidth);

    for (let i = 0; i <= 8; i++) {
      const coord = -halfBoard + i * SQUARE_SIZE;

      const fileOuter = new THREE.Mesh(fileOuterGeo, this.gridOuterMat);
      fileOuter.position.set(coord, 0.012, 0);
      this.boardGroup.add(fileOuter);

      const fileInner = new THREE.Mesh(fileInnerGeo, this.gridCenterMat);
      fileInner.position.set(coord, 0.016, 0);
      this.boardGroup.add(fileInner);

      const rankOuter = new THREE.Mesh(rankOuterGeo, this.gridOuterMat);
      rankOuter.position.set(0, 0.012, coord);
      this.boardGroup.add(rankOuter);

      const rankInner = new THREE.Mesh(rankInnerGeo, this.gridCenterMat);
      rankInner.position.set(0, 0.016, coord);
      this.boardGroup.add(rankInner);
    }

    const gridHelper = new THREE.GridHelper(boardWidth, 8, 0x000000, 0x000000);
    gridHelper.position.y = 0.033;
    this.boardGroup.add(gridHelper);

    this.buildCoordinateLabels(boardWidth);
  }

  buildCoordinateLabels(boardWidth) {
    const makeLabelPlane = (char) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = BOARD_THEMES[this.currentTheme].frameTrim;
      ctx.font = 'bold 38px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, 32, 34);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const geo = new THREE.PlaneGeometry(0.42, 0.42);
      geo.rotateX(-Math.PI / 2);
      return new THREE.Mesh(geo, mat);
    };

    const edgeOffset = boardWidth / 2 + 0.4;
    for (let i = 0; i < 8; i++) {
      const fileBottom = makeLabelPlane(FILES[i].toUpperCase());
      fileBottom.position.set(i * SQUARE_SIZE - BOARD_OFFSET, -0.02, edgeOffset);
      this.boardGroup.add(fileBottom);

      const fileTop = makeLabelPlane(FILES[i].toUpperCase());
      fileTop.position.set(i * SQUARE_SIZE - BOARD_OFFSET, -0.02, -edgeOffset);
      fileTop.rotation.z = Math.PI;
      this.boardGroup.add(fileTop);

      const rankLeft = makeLabelPlane(String(8 - i));
      rankLeft.position.set(-edgeOffset, -0.02, i * SQUARE_SIZE - BOARD_OFFSET);
      this.boardGroup.add(rankLeft);

      const rankRight = makeLabelPlane(String(8 - i));
      rankRight.position.set(edgeOffset, -0.02, i * SQUARE_SIZE - BOARD_OFFSET);
      this.boardGroup.add(rankRight);
    }
  }

  squareToWorld(sq) {
    const fileIdx = FILES.indexOf(sq[0]);
    const rankIdx = 8 - parseInt(sq[1], 10);
    return {
      x: fileIdx * SQUARE_SIZE - BOARD_OFFSET,
      z: rankIdx * SQUARE_SIZE - BOARD_OFFSET
    };
  }

  createPieceMesh(type, color) {
    const group = new THREE.Group();
    const mat = color === 'w' ? this.whitePieceMat : this.blackPieceMat;
    const geos = this.pieceGeometries[type] || this.pieceGeometries.p;

    geos.forEach((geo) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    const feltGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.02, 24);
    feltGeo.translate(0, 0.01, 0);
    const felt = new THREE.Mesh(feltGeo, this.feltMat);
    group.add(felt);

    if (type === 'n') {
      group.rotation.y = color === 'w' ? Math.PI : 0;
    }

    group.userData = { type, color };
    return group;
  }

  syncBoard(chessInstance, lastMove = null) {
    while (this.piecesGroup.children.length > 0) {
      this.piecesGroup.remove(this.piecesGroup.children[0]);
    }
    this.pieceMeshes.clear();

    const board = chessInstance.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const sq = `${FILES[c]}${8 - r}`;
        const mesh = this.createPieceMesh(piece.type, piece.color);
        const pos = this.squareToWorld(sq);
        mesh.position.set(pos.x, 0, pos.z);
        mesh.userData.square = sq;
        this.piecesGroup.add(mesh);
        this.pieceMeshes.set(sq, mesh);
      }
    }

    this.renderHighlights(chessInstance, null, [], lastMove);
  }

  animateMove(moveObj, onComplete) {
    if (!this.renderer) {
      if (onComplete) onComplete();
      return;
    }

    const fromSq = moveObj.from;
    const toSq = moveObj.to;
    const pieceMesh = this.pieceMeshes.get(fromSq);

    if (!pieceMesh) {
      if (onComplete) onComplete();
      return;
    }

    let capturedSq = toSq;
    if (moveObj.flags && moveObj.flags.includes('e')) {
      capturedSq = `${toSq[0]}${fromSq[1]}`;
    }
    const targetPiece = this.pieceMeshes.get(capturedSq);
    if (targetPiece && targetPiece !== pieceMesh) {
      this.pieceMeshes.delete(capturedSq);
      this.activeAnimations.push({
        type: 'capture',
        mesh: targetPiece,
        elapsed: 0,
        duration: 0.24
      });
    }

    if (moveObj.flags && (moveObj.flags.includes('k') || moveObj.flags.includes('q'))) {
      const rank = fromSq[1];
      const isKingside = moveObj.flags.includes('k');
      const rookFrom = isKingside ? `h${rank}` : `a${rank}`;
      const rookTo = isKingside ? `f${rank}` : `d${rank}`;
      const rookMesh = this.pieceMeshes.get(rookFrom);
      if (rookMesh) {
        this.pieceMeshes.delete(rookFrom);
        this.pieceMeshes.set(rookTo, rookMesh);
        rookMesh.userData.square = rookTo;
        this.activeAnimations.push({
          type: 'move',
          mesh: rookMesh,
          startPos: rookMesh.position.clone(),
          endPos: new THREE.Vector3(this.squareToWorld(rookTo).x, 0, this.squareToWorld(rookTo).z),
          arcHeight: 0.5,
          elapsed: 0,
          duration: 0.34
        });
      }
    }

    this.pieceMeshes.delete(fromSq);
    this.pieceMeshes.set(toSq, pieceMesh);
    pieceMesh.userData.square = toSq;

    const endWorld = this.squareToWorld(toSq);
    const isKnight = moveObj.piece === 'n';

    this.activeAnimations.push({
      type: 'move',
      mesh: pieceMesh,
      startPos: pieceMesh.position.clone(),
      endPos: new THREE.Vector3(endWorld.x, 0, endWorld.z),
      arcHeight: isKnight ? 1.35 : 0.45,
      elapsed: 0,
      duration: 0.34,
      onComplete
    });
  }

  renderHighlights(chessInstance, selectedSq = null, legalMoves = [], lastMove = null) {
    while (this.highlightsGroup.children.length > 0) {
      this.highlightsGroup.remove(this.highlightsGroup.children[0]);
    }

    this.pieceMeshes.forEach((mesh, sq) => {
      if (!this.activeAnimations.some((a) => a.mesh === mesh)) {
        mesh.position.y = sq === selectedSq ? 0.22 : 0;
      }
    });

    if (lastMove) {
      [lastMove.from, lastMove.to].forEach((sq) => {
        const pos = this.squareToWorld(sq);
        const padGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.85, SQUARE_SIZE * 0.85);
        padGeo.rotateX(-Math.PI / 2);
        const padMat = new THREE.MeshBasicMaterial({
          color: 0xd4af37,
          transparent: true,
          opacity: 0.4
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(pos.x, 0.036, pos.z);
        this.highlightsGroup.add(pad);
      });
    }

    if (selectedSq) {
      const pos = this.squareToWorld(selectedSq);
      const ringGeo = new THREE.RingGeometry(0.42, 0.53, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfce38a,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, 0.038, pos.z);
      this.highlightsGroup.add(ring);
    }

    legalMoves.forEach((move) => {
      const pos = this.squareToWorld(move.to);
      const isCapture = Boolean(move.captured) || (move.flags && move.flags.includes('e'));

      if (isCapture) {
        const capRingGeo = new THREE.RingGeometry(0.44, 0.56, 32);
        capRingGeo.rotateX(-Math.PI / 2);
        const capRingMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(capRingGeo, capRingMat);
        ring.position.set(pos.x, 0.04, pos.z);
        ring.userData = { targetSquare: move.to };
        this.highlightsGroup.add(ring);
      } else {
        const dotGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24);
        const dotMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.88
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(pos.x, 0.045, pos.z);
        dot.userData = { targetSquare: move.to };
        this.highlightsGroup.add(dot);
      }
    });

    if (chessInstance && chessInstance.in_check()) {
      const turn = chessInstance.turn();
      const board = chessInstance.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.type === 'k' && p.color === turn) {
            const kingSq = `${FILES[c]}${8 - r}`;
            const pos = this.squareToWorld(kingSq);
            const checkGeo = new THREE.CircleGeometry(0.55, 32);
            checkGeo.rotateX(-Math.PI / 2);
            const checkMat = new THREE.MeshBasicMaterial({
              color: 0xff1e1e,
              transparent: true,
              opacity: 0.68
            });
            const checkMesh = new THREE.Mesh(checkGeo, checkMat);
            checkMesh.position.set(pos.x, 0.039, pos.z);
            this.highlightsGroup.add(checkMesh);
          }
        }
      }
    }
  }

  setCameraPreset(preset, animate = true) {
    if (preset === 'white') {
      this.targetSpherical.set(13.8, 0.84, 0);
    } else if (preset === 'black') {
      this.targetSpherical.set(13.8, 0.84, Math.PI);
    } else if (preset === 'top') {
      this.targetSpherical.set(14.5, 0.08, this.targetSpherical.theta);
    }

    if (!animate) {
      this.spherical.copy(this.targetSpherical);
      this.updateCameraFromSpherical();
    }
  }

  updateCameraFromSpherical() {
    this.camera.position.setFromSpherical(this.spherical).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
  }

  bindEvents() {
    if (!this.renderer) return;
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.isDraggingOrbit = true;
      this.prevPointer = { x: e.clientX, y: e.clientY };
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDraggingOrbit) return;
      this.isDraggingOrbit = false;

      const dx = Math.abs(e.clientX - this.pointerDownPos.x);
      const dy = Math.abs(e.clientY - this.pointerDownPos.y);
      if (dx <= 6 && dy <= 6 && e.target === dom) {
        const sq = this.pickSquare(e);
        if (sq) {
          this.onSquareClick(sq);
        }
      }
    });

    dom.addEventListener('pointermove', (e) => {
      if (this.isDraggingOrbit) {
        const deltaX = e.clientX - this.prevPointer.x;
        const deltaY = e.clientY - this.prevPointer.y;
        this.prevPointer = { x: e.clientX, y: e.clientY };

        this.targetSpherical.theta -= deltaX * 0.0075;
        this.targetSpherical.phi = Math.max(
          0.08,
          Math.min(Math.PI / 2 - 0.08, this.targetSpherical.phi - deltaY * 0.0065)
        );
      } else {
        const sq = this.pickSquare(e);
        this.container.style.cursor = sq ? 'pointer' : 'grab';
      }
    });

    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.targetSpherical.radius = Math.max(
          7.5,
          Math.min(22, this.targetSpherical.radius + e.deltaY * 0.008)
        );
      },
      { passive: false }
    );

    window.addEventListener('resize', () => {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  pickSquare(event) {
    if (!this.renderer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const pieceHits = this.raycaster.intersectObjects(this.piecesGroup.children, true);
    if (pieceHits.length > 0) {
      let obj = pieceHits[0].object;
      while (obj && !obj.userData.square && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData.square) return obj.userData.square;
    }

    const squareHits = this.raycaster.intersectObjects(Array.from(this.squareMeshes.values()));
    if (squareHits.length > 0) {
      return squareHits[0].object.userData.square;
    }

    return null;
  }

  animate() {
    if (!this.renderer) return;
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    const damp = Math.min(1, dt * 10);
    this.spherical.radius += (this.targetSpherical.radius - this.spherical.radius) * damp;
    this.spherical.phi += (this.targetSpherical.phi - this.spherical.phi) * damp;

    let dTheta = this.targetSpherical.theta - this.spherical.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    this.spherical.theta += dTheta * damp;

    this.updateCameraFromSpherical();

    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      if (anim.type === 'move') {
        anim.mesh.position.lerpVectors(anim.startPos, anim.endPos, ease);
        anim.mesh.position.y = Math.sin(t * Math.PI) * anim.arcHeight;
      } else if (anim.type === 'capture') {
        const s = Math.max(0.001, 1 - ease);
        anim.mesh.scale.set(s, s, s);
        anim.mesh.position.y = ease * 0.6;
      }

      if (t >= 1) {
        if (anim.type === 'capture') {
          this.piecesGroup.remove(anim.mesh);
        } else if (anim.type === 'move') {
          anim.mesh.position.copy(anim.endPos);
        }
        if (anim.onComplete) anim.onComplete();
        this.activeAnimations.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.BOARD_THEMES = BOARD_THEMES;
window.Board3D = Board3D;
