// ---- Audio Synthesis Setup ----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playClickSound() {
    playTone(600, 'sine', 0.1, 0.2);
}

function playWinSound() {
    playTone(400, 'square', 0.1, 0.1);
    setTimeout(() => playTone(600, 'square', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'square', 0.3, 0.1), 200);
}

function playDrawSound() {
    playTone(300, 'sawtooth', 0.2, 0.1);
    setTimeout(() => playTone(250, 'sawtooth', 0.3, 0.1), 200);
}

function playRestartSound() {
    playTone(800, 'sine', 0.05, 0.1);
    setTimeout(() => playTone(1200, 'sine', 0.1, 0.1), 50);
}

// ---- Game State & Elements ----
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = 'PVP'; // PVP or PVC
let aiDifficulty = 'medium'; // easy, medium, unbeatable
let scores = { X: 0, O: 0, Draw: 0 };

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diags
];

// DOM Elements
const cells = document.querySelectorAll('.cell');
const turnIndicatorText = document.querySelector('.turn-text');
const btnPvP = document.getElementById('btn-pvp');
const btnPvC = document.getElementById('btn-pvc');
const btnRestart = document.getElementById('btn-restart');
const btnResetScores = document.getElementById('btn-reset-scores');
const scoreXElement = document.getElementById('score-x');
const scoreOElement = document.getElementById('score-o');
const scoreDrawElement = document.getElementById('score-draw');
const labelO = document.getElementById('label-o');

const difficultySelector = document.getElementById('difficulty-selector');
const diffBtns = document.querySelectorAll('.diff-btn');

const modal = document.getElementById('result-modal');
const resultMessage = document.getElementById('result-message');
const btnPlayAgain = document.getElementById('btn-play-again');
const modalContent = document.querySelector('.modal-content');

// ---- Initialization ----
function init() {
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    btnRestart.addEventListener('click', restartGame);
    btnResetScores.addEventListener('click', resetScores);
    btnPlayAgain.addEventListener('click', closeAndRestart);
    
    btnPvP.addEventListener('click', () => setGameMode('PVP'));
    btnPvC.addEventListener('click', () => setGameMode('PVC'));
    
    diffBtns.forEach(btn => btn.addEventListener('click', (e) => setDifficulty(e.target.dataset.level)));

    updateTurnIndicator();
}

// ---- Game Logic ----
function handleCellClick(e) {
    const cell = e.target;
    const index = parseInt(cell.getAttribute('data-index'));

    if (board[index] !== '' || !gameActive) return;

    playClickSound();
    makeMove(index, currentPlayer);
    
    if (gameActive && gameMode === 'PVC' && currentPlayer === 'O') {
        setTimeout(makeComputerMove, 400); // slight delay for realism
    }
}

function makeMove(index, player) {
    board[index] = player;
    
    const cell = document.querySelector(`.cell[data-index="${index}"]`);
    cell.innerText = player;
    cell.classList.add(player.toLowerCase());
    cell.classList.add('occupied');

    checkWinCondition();
    
    if (gameActive) {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        updateTurnIndicator();
    }
}

function updateTurnIndicator() {
    turnIndicatorText.innerText = gameMode === 'PVC' && currentPlayer === 'O' ? "COMPUTER'S TURN" : `PLAYER ${currentPlayer} TURN`;
    turnIndicatorText.className = `turn-text turn-${currentPlayer.toLowerCase()}`;
}

function checkWinCondition() {
    let roundWon = false;
    let winningCells = [];

    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            roundWon = true;
            winningCells = [a, b, c];
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        highlightWinningCells(winningCells);
        handleWin(currentPlayer);
        return;
    }

    if (!board.includes('')) {
        gameActive = false;
        handleDraw();
        return;
    }
}

function highlightWinningCells(winningCells) {
    winningCells.forEach(index => {
        document.querySelector(`.cell[data-index="${index}"]`).classList.add('winning-cell');
    });
}

function handleWin(winner) {
    scores[winner]++;
    updateScoreboard();
    playWinSound();
    
    setTimeout(() => {
        showModal(gameMode === 'PVC' && winner === 'O' ? "COMPUTER WINS!" : `PLAYER ${winner} WINS!`, winner);
    }, 600);
}

function handleDraw() {
    scores.Draw++;
    updateScoreboard();
    playDrawSound();
    
    setTimeout(() => {
        showModal("IT'S A DRAW!", "draw");
    }, 600);
}

function updateScoreboard() {
    scoreXElement.innerText = scores.X;
    scoreOElement.innerText = scores.O;
    scoreDrawElement.innerText = scores.Draw;
}

// ---- Computer AI ----
function makeComputerMove() {
    if (!gameActive) return;

    let moveIndex;

    if (aiDifficulty === 'easy') {
        let emptyCells = board.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
        moveIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    } else if (aiDifficulty === 'medium') {
        moveIndex = findBestMove('O'); // try to win
        if (moveIndex === -1) moveIndex = findBestMove('X'); // try to block
        if (moveIndex === -1) {
            if (board[4] === '') moveIndex = 4;
            else {
                let emptyCells = board.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
                moveIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            }
        }
    } else if (aiDifficulty === 'unbeatable') {
        moveIndex = getBestMinimaxMove();
    }
    
    if (moveIndex !== -1 && moveIndex !== undefined) {
        playClickSound();
        makeMove(moveIndex, 'O');
    }
}

function findBestMove(player) {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        const combo = [board[a], board[b], board[c]];
        const playerCount = combo.filter(val => val === player).length;
        const emptyCount = combo.filter(val => val === '').length;
        
        if (playerCount === 2 && emptyCount === 1) {
            if (board[a] === '') return a;
            if (board[b] === '') return b;
            if (board[c] === '') return c;
        }
    }
    return -1;
}

// -- Minimax Logic --
function getBestMinimaxMove() {
    let bestScore = -Infinity;
    let move = -1;
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    return move;
}

function checkWinnerForMinimax(tempBoard) {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (tempBoard[a] && tempBoard[a] === tempBoard[b] && tempBoard[a] === tempBoard[c]) {
            return tempBoard[a];
        }
    }
    if (!tempBoard.includes('')) return 'tie';
    return null;
}

function minimax(tempBoard, depth, isMaximizing) {
    let result = checkWinnerForMinimax(tempBoard);
    if (result !== null) {
        if (result === 'O') return 10 - depth;
        if (result === 'X') return depth - 10;
        return 0;
    }
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (tempBoard[i] === '') {
                tempBoard[i] = 'O';
                let score = minimax(tempBoard, depth + 1, false);
                tempBoard[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (tempBoard[i] === '') {
                tempBoard[i] = 'X';
                let score = minimax(tempBoard, depth + 1, true);
                tempBoard[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

// ---- Mode selection ----
function setGameMode(mode) {
    if (gameMode === mode) return;
    gameMode = mode;
    btnPvP.classList.toggle('active', mode === 'PVP');
    btnPvC.classList.toggle('active', mode === 'PVC');
    labelO.innerText = mode === 'PVC' ? 'Computer' : 'Player O';
    
    if (mode === 'PVC') {
        difficultySelector.classList.remove('hidden');
        difficultySelector.style.position = 'relative'; // remove absolute to flow normally
        difficultySelector.style.visibility = 'visible';
    } else {
        difficultySelector.classList.add('hidden');
        // allow timeout for transition
        setTimeout(() => {
            if(gameMode !== 'PVC') {
                difficultySelector.style.position = 'absolute';
                difficultySelector.style.visibility = 'hidden';
            }
        }, 300);
    }
    
    restartGame();
}

function setDifficulty(level) {
    aiDifficulty = level;
    diffBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.level === level));
    restartGame();
}

// ---- Modals and Resets ----
function showModal(msg, type) {
    resultMessage.innerText = msg;
    modalContent.className = 'modal-content glass-panel'; // reset classes
    if (type === 'X') modalContent.classList.add('win-x');
    else if (type === 'O') modalContent.classList.add('win-o');
    
    modal.classList.remove('hidden');
}

function closeAndRestart() {
    modal.classList.add('hidden');
    restartGame();
}

function restartGame() {
    playRestartSound();
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    
    cells.forEach(cell => {
        cell.innerText = '';
        cell.className = 'cell'; // reset classes
    });
    
    updateTurnIndicator();
}

function resetScores() {
    scores = { X: 0, O: 0, Draw: 0 };
    updateScoreboard();
    restartGame();
}

// Boot up
window.addEventListener('DOMContentLoaded', init);
