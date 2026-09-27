// DebutFlow mobile controls
// Adds reliable tap-to-move controls on touch devices without changing desktop drag-and-drop.

$(document).ready(function () {
    const trainer = window.chessTrainer;
    if (!trainer) {
        console.warn('DebutFlow mobile controls: chessTrainer is not available.');
        return;
    }

    const isTouchDevice =
        ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    if (!isTouchDevice) return;

    trainer.mobileSelectedSquare = null;
    trainer.mobileTapHintShown = false;

    // Add touch-friendly styles without requiring changes to style.css.
    const style = document.createElement('style');
    style.id = 'debutflow-mobile-controls-style';
    style.textContent = `
        #board {
            touch-action: manipulation;
            -webkit-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
        }

        #board .square-55d63 {
            cursor: pointer;
        }

        #board .square-mobile-selected {
            box-shadow: inset 0 0 0 4px rgba(59, 130, 246, 0.95);
        }
    `;
    document.head.appendChild(style);

    trainer.clearMobileSelection = function () {
        $('#board .square-55d63').removeClass('square-mobile-selected');
        this.mobileSelectedSquare = null;
    };

    trainer.getSquareFromElement = function (element) {
        const squareElement = $(element).closest('.square-55d63');
        if (!squareElement.length) return null;

        const classes = String(squareElement.attr('class') || '').split(/\s+/);
        const squareClass = classes.find(className => /^square-[a-h][1-8]$/.test(className));
        return squareClass ? squareClass.replace('square-', '') : null;
    };

    trainer.selectMobileSquare = function (square) {
        this.clearMobileSelection();
        this.mobileSelectedSquare = square;
        $(`#board .square-${square}`).addClass('square-mobile-selected');
    };

    trainer.handleMobileSquareTap = function (square) {
        if (this.mode !== 'practice' || this.isTrainingComplete || !square) return;

        const moves = this.getCurrentMoves();
        const expectedMove = moves[this.currentMoveIndex];

        // Ignore taps while DebutFlow is making the opponent move.
        if (!expectedMove || expectedMove.color !== this.playerSide) {
            this.clearMobileSelection();
            return;
        }

        const piece = this.game.get(square);

        // First tap: select one of the player's pieces.
        if (!this.mobileSelectedSquare) {
            if (!piece || piece.color !== this.playerSide) return;
            this.selectMobileSquare(square);
            return;
        }

        // Tapping the selected square again cancels selection.
        if (square === this.mobileSelectedSquare) {
            this.clearMobileSelection();
            return;
        }

        // Tapping another own piece switches the selection.
        if (piece && piece.color === this.playerSide) {
            this.selectMobileSquare(square);
            return;
        }

        const source = this.mobileSelectedSquare;
        this.clearMobileSelection();

        // Reuse DebutFlow's existing move validation and training logic.
        this.handleUserMove(source, square);

        // With drag disabled on touch devices, chessboard.js does not move
        // the piece visually by itself, so sync the board from chess.js.
        this.forceUpdateBoard();
    };

    trainer.bindMobileBoardTap = function () {
        $('#board')
            .off('click.debutflowMobile')
            .on('click.debutflowMobile', '.square-55d63, .piece-417db', event => {
                event.preventDefault();
                const square = this.getSquareFromElement(event.target);
                this.handleMobileSquareTap(square);
            });
    };

    // Keep desktop drag-and-drop unchanged.
    // On touch devices, disable chessboard.js dragging and use tap-to-move.
    const originalRecreateBoard = trainer.recreateBoard.bind(trainer);
    trainer.recreateBoard = function (draggable) {
        this.clearMobileSelection();
        originalRecreateBoard(false);
        this.bindMobileBoardTap();
    };

    // Add one short instruction the first time Practice mode starts.
    const originalStartPracticeMode = trainer.startPracticeMode.bind(trainer);
    trainer.startPracticeMode = function (announce = true) {
        originalStartPracticeMode(announce);
        this.bindMobileBoardTap();

        if (!this.mobileTapHintShown) {
            this.addChatMessage(
                '📱 На телефоне: нажмите на свою фигуру, затем на клетку, куда хотите сделать ход.',
                false,
                true
            );
            this.mobileTapHintShown = true;
        }
    };

    // The initial board was created before this patch was installed.
    trainer.bindMobileBoardTap();
});