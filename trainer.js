
// ============================================
// DebutFlow — тренажёр по полной базе дебютов
// ============================================

class ChessTrainer {
    constructor(database) {
        this.database = database;
        this.openings = [...(database.openings || [])].sort(
            (a, b) => (a.ordering_number ?? 0) - (b.ordering_number ?? 0)
        );

        this.game = null;
        this.board = null;
        this.boardElement = null;
        this.currentMoveIndex = 0;
        this.isBoardReady = false;
        this.isTrainingComplete = false;
        this.isCompletionAnnounced = false;
        this.mode = null;

        // Timer and generation token prevent moves from an old training session.
        this.opponentTimer = null;
        this.trainingGeneration = 0;

        // Mobile control mode: on touch screens a move is made with two light taps:
        // first tap selects the piece, second tap selects the destination square.
        this.useTapControls =
            (navigator.maxTouchPoints || 0) > 0 ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        this.tapSelectedSquare = null;
        this.tapInputBound = false;

        this.currentOpeningIndex = 0;
        this.currentVariationIndex = -1;
        this.currentOpening = this.openings[0] || null;
        this.currentVariation = null;
        this.currentMoves = [];
        this.moveCache = new Map();
        this.randomLineBags = new Map();

        // Stage 2: resume the exact line/ply on this browser and remember practice stats.
        this.progressManager = new ProgressManager();
        this.restoringProgress = false;

        this.init();
    }

    get playerSide() {
        return this.currentOpening?.player_side === 'b' ? 'b' : 'w';
    }

    get opponentSide() {
        return this.playerSide === 'w' ? 'b' : 'w';
    }

    get sideLabel() {
        return this.playerSide === 'w' ? 'белых' : 'чёрных';
    }

    addChatMessage(text, isError = false, isSystem = false) {
        const chatMessages = $('#chatMessages');
        let avatar = '🤖';
        if (isError) avatar = '⚠️';
        if (isSystem) avatar = '📌';

        const time = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit', minute: '2-digit'
        });

        const safeText = $('<div>').text(String(text)).html();
        const messageHtml = `
            <div class="chat-message system">
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-text" style="${isError ? 'color:#f87171;' : ''}">${safeText}</div>
                    <div class="message-time">${time}</div>
                </div>
            </div>`;

        chatMessages.append(messageHtml);
        chatMessages.scrollTop(chatMessages[0].scrollHeight);

        const maxMessages = 70;
        if (chatMessages.children().length > maxMessages) {
            chatMessages.children().slice(0, chatMessages.children().length - maxMessages).remove();
        }
    }

    clearChat() {
        $('#chatMessages').empty();
    }

    clearHighlights() {
        $('.square-55d63').removeClass('square-highlight square-error');
    }

    clearTapSelection() {
        $('#board .square-55d63').removeClass('square-tap-selected');
        this.tapSelectedSquare = null;
    }

    getSquareNameFromElement(element) {
        const squareElement = element?.closest?.('.square-55d63');
        if (!squareElement) return null;

        // chessboard.js normally stores the coordinate in data-square.
        if (squareElement.dataset?.square) return squareElement.dataset.square;

        // Fallback for builds where only the square-e2 style class is present.
        const squareClass = [...squareElement.classList]
            .find(className => /^square-[a-h][1-8]$/.test(className));
        return squareClass ? squareClass.slice(7) : null;
    }

    selectTapSquare(square) {
        this.clearTapSelection();
        this.tapSelectedSquare = square;
        const squareElement = document.querySelector(`#board .square-${square}`);
        squareElement?.classList.add('square-tap-selected');
    }

    handleTapSquare(square) {
        if (this.mode !== 'practice' || this.isTrainingComplete || !square) return;

        const expectedMove = this.getCurrentMoves()[this.currentMoveIndex];
        if (!expectedMove || expectedMove.color !== this.playerSide) {
            this.clearTapSelection();
            return;
        }

        const piece = this.game?.get(square);

        // First tap: select one of the player's pieces.
        if (!this.tapSelectedSquare) {
            if (!piece || piece.color !== this.playerSide) return;
            this.selectTapSquare(square);
            return;
        }

        // Tapping the selected piece again cancels the selection.
        if (square === this.tapSelectedSquare) {
            this.clearTapSelection();
            return;
        }

        // Tapping another own piece switches the selection to that piece.
        if (piece && piece.color === this.playerSide) {
            this.selectTapSquare(square);
            return;
        }

        const source = this.tapSelectedSquare;
        this.clearTapSelection();

        // Use exactly the same validation as desktop drag-and-drop.
        this.handleUserMove(source, square);

        // In tap mode chessboard.js is not draggable, so sync it manually.
        this.forceUpdateBoard();
    }

    bindTapInput() {
        if (!this.useTapControls || this.tapInputBound) return;

        const boardElement = document.getElementById('board');
        if (!boardElement) return;

        // Let the browser own swipes (vertical scrolling). Only a completed
        // stationary tap becomes a chess move. Do not preventDefault on touch start.
        const TAP_MAX_MOVEMENT = 12;
        const handleElement = (target, event) => {
            if (this.mode !== 'practice' || this.isTrainingComplete) return;
            const square = this.getSquareNameFromElement(target);
            if (!square) return;
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            this.handleTapSquare(square);
        };

        if (window.PointerEvent) {
            let pointerStart = null;
            boardElement.addEventListener('pointerdown', event => {
                if (event.pointerType === 'mouse') return;
                pointerStart = {
                    id: event.pointerId,
                    x: event.clientX,
                    y: event.clientY
                };
            }, { capture: true, passive: true });

            boardElement.addEventListener('pointerup', event => {
                const start = pointerStart;
                if (!start || event.pointerId !== start.id) return;
                pointerStart = null;
                if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MAX_MOVEMENT) return;
                const target = document.elementFromPoint(event.clientX, event.clientY) || event.target;
                handleElement(target, event);
            }, { capture: true, passive: false });

            boardElement.addEventListener('pointercancel', () => {
                pointerStart = null;
            }, { capture: true });
        } else {
            // Touch Events fallback for browsers without Pointer Events.
            let touchStart = null;
            boardElement.addEventListener('touchstart', event => {
                if (event.touches.length !== 1) {
                    touchStart = null;
                    return;
                }
                const touch = event.touches[0];
                touchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
            }, { capture: true, passive: true });

            boardElement.addEventListener('touchmove', event => {
                if (!touchStart) return;
                const touch = Array.from(event.touches).find(item => item.identifier === touchStart.id);
                if (!touch || Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > TAP_MAX_MOVEMENT) {
                    touchStart = null;
                }
            }, { capture: true, passive: true });

            boardElement.addEventListener('touchend', event => {
                const start = touchStart;
                touchStart = null;
                if (!start) return;
                const touch = Array.from(event.changedTouches).find(item => item.identifier === start.id);
                if (!touch || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > TAP_MAX_MOVEMENT) return;
                const target = document.elementFromPoint(touch.clientX, touch.clientY) || event.target;
                handleElement(target, event);
            }, { capture: true, passive: false });

            boardElement.addEventListener('touchcancel', () => {
                touchStart = null;
            }, { capture: true });
        }

        this.tapInputBound = true;
    }

    highlightSquare(square, type = 'highlight') {
        if (!square) return;
        const element = $(`.square-${square}`);
        const className = `square-${type === 'error' ? 'error' : 'highlight'}`;
        element.removeClass('square-highlight square-error').addClass(className);
        setTimeout(() => element.removeClass(className), 900);
    }

    tokenizePgn(pgn) {
        if (!pgn) return [];

        return pgn
            .replace(/\r?\n/g, ' ')
            .replace(/\{[^}]*\}/g, ' ')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\$\d+/g, ' ')
            .split(/\s+/)
            .map(token => token.trim())
            .filter(Boolean)
            .map(token => token.replace(/^\d+\.(?:\.\.)?/, ''))
            .filter(token => token && !/^\d+\.{1,3}$/.test(token))
            .filter(token => !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
    }

    getPieceName(piece) {
        return ({
            p: 'пешку',
            n: 'коня',
            b: 'слона',
            r: 'ладью',
            q: 'ферзя',
            k: 'короля'
        })[piece] || 'фигуру';
    }

    generateMoveComment(move, plyIndex = 0) {
        if (!move) return 'Продолжает развитие позиции по выбранной дебютной линии.';

        const san = String(move.san || '');
        const from = move.from || '';
        const to = move.to || '';
        const piece = move.piece;
        const captured = move.captured;
        const flags = String(move.flags || '');
        const isCheckmate = san.includes('#');
        const isCheck = !isCheckmate && san.includes('+');
        const isCastleKing = flags.includes('k');
        const isCastleQueen = flags.includes('q');
        const isPromotion = flags.includes('p') || san.includes('=');
        const centralSquares = new Set(['d4', 'e4', 'd5', 'e5']);
        const extendedCenter = new Set(['c3', 'c4', 'c5', 'c6', 'd3', 'd4', 'd5', 'd6', 'e3', 'e4', 'e5', 'e6', 'f3', 'f4', 'f5', 'f6']);
        const openingPhase = plyIndex < 16;

        const parts = [];

        if (isCastleKing) {
            parts.push('Короткая рокировка: король уходит в более безопасное место, а ладья подключается к игре');
        } else if (isCastleQueen) {
            parts.push('Длинная рокировка: король прячется, а ладья сразу выходит ближе к центру');
        } else if (isPromotion) {
            const promoted = san.match(/=([QRBN])/i)?.[1]?.toUpperCase();
            const promotedName = ({ Q: 'ферзя', R: 'ладью', B: 'слона', N: 'коня' })[promoted] || 'новую фигуру';
            parts.push(`Пешка доходит до последней горизонтали и превращается в ${promotedName}`);
        } else if (captured) {
            parts.push(`Забирает ${this.getPieceName(captured)} на ${to}`);
        }

        if (!parts.length) {
            if (piece === 'p') {
                if (centralSquares.has(to)) {
                    parts.push('Пешка занимает центр и помогает контролировать ключевые центральные поля');
                } else if (['c4', 'c5'].includes(to)) {
                    parts.push('Фланговая пешка сразу давит на центр и оспаривает важные центральные поля');
                } else if (['f4', 'f5'].includes(to)) {
                    parts.push('Агрессивный пешечный выпад захватывает пространство и начинает игру на королевском фланге');
                } else if (['g4', 'g5', 'h4', 'h5'].includes(to)) {
                    parts.push('Пешка продвигается на фланге, захватывая пространство и создавая атакующие возможности');
                } else if (openingPhase) {
                    parts.push('Пешечный ход формирует дебютную структуру и подготавливает развитие фигур');
                } else {
                    parts.push('Пешка улучшает структуру и отнимает у фигур соперника важные поля');
                }
            } else if (piece === 'n') {
                const startsOnBackRank = ['b1', 'g1', 'b8', 'g8'].includes(from);
                if (startsOnBackRank && openingPhase) {
                    parts.push('Конь развивается с начальной позиции и сразу подключается к борьбе за центр');
                } else if (extendedCenter.has(to)) {
                    parts.push('Конь занимает активное поле ближе к центру и усиливает давление на позицию соперника');
                } else {
                    parts.push('Конь перестраивается на более полезное поле и готовит дальнейший манёвр');
                }
            } else if (piece === 'b') {
                const startsOnBackRank = ['c1', 'f1', 'c8', 'f8'].includes(from);
                if (startsOnBackRank && openingPhase) {
                    parts.push('Слон развивается и открывает активную диагональ');
                } else {
                    parts.push('Слон занимает активную диагональ и усиливает давление на важные поля');
                }
            } else if (piece === 'q') {
                parts.push('Ферзь занимает активную позицию и усиливает давление сразу по нескольким направлениям');
            } else if (piece === 'r') {
                parts.push('Ладья подключается к игре и усиливает давление по линии или горизонтали');
            } else if (piece === 'k') {
                parts.push('Король меняет позицию, уходя от угрозы или поддерживая фигуры');
            } else {
                parts.push('Ход улучшает расположение фигуры и продолжает план выбранного варианта');
            }
        } else {
            if (piece === 'n' && extendedCenter.has(to)) {
                parts.push('Конь при этом оказывается на активном центральном поле');
            } else if (piece === 'b') {
                parts.push('Слон после размена или взятия сохраняет давление по диагонали');
            } else if (piece === 'q') {
                parts.push('Ферзь одновременно усиливает тактическое давление');
            } else if (piece === 'p' && centralSquares.has(to)) {
                parts.push('Пешка после взятия укрепляется в центре');
            }
        }

        if (isCheckmate) {
            parts.push('Это мат: у короля соперника нет защиты');
        } else if (isCheck) {
            parts.push('Ход сделан с шахом и вынуждает соперника немедленно реагировать');
        }

        let comment = parts.join('. ');
        if (!/[.!?]$/.test(comment)) comment += '.';
        return comment.charAt(0).toUpperCase() + comment.slice(1);
    }

    getOpeningComment(opening, san, plyIndex) {
        // Only curated explanations. SAN alone may mean different things at
        // different moments, so the opening ID and ply index are also part of the key.
        if (!opening?.id || !Number.isInteger(plyIndex) || plyIndex < 0 || plyIndex > 7) return '';
        const catalog = typeof window !== 'undefined' ? window.DEBUTFLOW_OPENING_COMMENTS : null;
        const comment = catalog?.[opening.id]?.[plyIndex]?.[san];
        return typeof comment === 'string' && comment.length >= 20 && comment.length <= 200
            ? comment : '';
    }

    prepareMoves(opening, variation) {
        if (!opening || !variation) return [];
        if (this.moveCache.has(variation.id)) return this.moveCache.get(variation.id);

        const tokens = this.tokenizePgn(variation.pgn);
        const tempGame = new Chess();
        const moves = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const result = tempGame.move(token, { sloppy: true });
            if (!result) {
                throw new Error(`Не удалось разобрать PGN: ${opening.name}, вариант ${variation.ordering_number + 1}, ход ${token}`);
            }

            const generatedDescription = this.generateMoveComment(result, i);
            const curatedDescription = this.getOpeningComment(opening, result.san, i);
            moves.push({
                color: result.color,
                from: result.from,
                to: result.to,
                san: result.san,
                type: result.color === opening.player_side ? 'player' : 'bot',
                desc: variation.training_descriptions?.[i] || curatedDescription || generatedDescription
            });
        }

        this.moveCache.set(variation.id, moves);
        return moves;
    }

    getCurrentMoves() {
        return this.currentMoves || [];
    }

    validateAllLines() {
        // Reuse the same parser as the UI, but report invalid data early.
        // Failed lines are reported and are not cached; other lines still work.
        const errors = [];
        for (const opening of this.openings) {
            for (const variation of opening.lines || []) {
                try {
                    const moves = this.prepareMoves(opening, variation);
                    if (!moves.length) throw new Error('Пустая последовательность ходов');
                } catch (error) {
                    const issue = {
                        opening: opening.name,
                        variationId: variation.id,
                        error: error.message
                    };
                    errors.push(issue);
                    console.warn('DebutFlow: некорректная линия PGN', issue);
                }
            }
        }
        if (errors.length) console.warn(`DebutFlow: проблемных линий: ${errors.length}`);
        return errors;
    }

    cancelOpponentMove() {
        // Bump the generation even when the timer has fired already:
        // a stale callback from a previous board is never allowed to act.
        this.trainingGeneration++;
        if (this.opponentTimer !== null) {
            clearTimeout(this.opponentTimer);
            this.opponentTimer = null;
        }
    }

    scheduleOpponentMove() {
        if (this.opponentTimer !== null) clearTimeout(this.opponentTimer);
        const generation = this.trainingGeneration;
        const timerId = setTimeout(() => {
            // Ignore a callback that was queued just before being replaced.
            if (this.opponentTimer !== timerId) return;
            this.opponentTimer = null;
            if (generation !== this.trainingGeneration) return;
            this.executeOpponentMove();
        }, 80);
        this.opponentTimer = timerId;
    }

    persistSession() {
        if (this.restoringProgress || !this.progressManager ||
            !this.currentOpening || !this.currentVariation) return;
        this.progressManager.setSession({
            openingId: this.currentOpening.id,
            lineId: this.currentVariation.id,
            mode: this.mode,
            moveIndex: this.currentMoveIndex
        });
    }

    renderTrainingStatistics() {
        if (!this.progressManager) return;
        const stats = this.progressManager.getStatistics();
        $('#completedLinesValue').text(stats.completedLines);
        $('#wrongMovesValue').text(stats.errors);
    }

    findSavedVariation(session) {
        if (!session) return null;
        const openingIndex = this.openings.findIndex(opening => opening.id === session.openingId);
        if (openingIndex < 0) return null;
        const opening = this.openings[openingIndex];
        const variationIndex = (opening.lines || []).findIndex(line => line.id === session.lineId);
        if (variationIndex < 0) return null;
        return { openingIndex, variationIndex };
    }

    restoreSavedSession(session) {
        if (!session || !['study', 'practice'].includes(session.mode)) return false;
        const moves = this.getCurrentMoves();
        const moveIndex = Math.min(Math.max(session.moveIndex, 0), moves.length);
        this.restoringProgress = true;
        try {
            this.mode = session.mode;
            this.updateButtonsVisibility();
            $('#modeStudyBtn').toggleClass('active', this.mode === 'study');
            $('#modePracticeBtn').toggleClass('active', this.mode === 'practice');

            if (this.mode === 'study') this.startStudyMode(false);
            else this.startPracticeMode(false);

            // A second cancellation is intentional and idempotent: startPracticeMode
            // schedules the first-board reply, but it must never run after restore.
            // The generation token also invalidates a callback already queued.
            this.cancelOpponentMove();
            this.currentMoveIndex = moveIndex;
            if (!this.syncGameWithIndex()) {
                this.currentMoveIndex = 0;
                this.game = new Chess();
                this.forceUpdateBoard();
            }
            const finished = moves.length > 0 && this.currentMoveIndex === moves.length;
            this.isTrainingComplete = finished && this.mode === 'practice';
            this.isCompletionAnnounced = finished;
            if (finished) this.showNextVariationButton();
            this.updateProgress();

            // When the page was closed while a bot reply was pending, resume it
            // exactly once. User moves never execute automatically on reload.
            if (this.mode === 'practice' && !finished &&
                moves[this.currentMoveIndex]?.color !== this.playerSide) {
                this.scheduleOpponentMove();
            }
        } finally {
            this.restoringProgress = false;
        }
        this.persistSession();
        this.addChatMessage(`↩️ Продолжена тренировка: ход ${this.currentMoveIndex} из ${moves.length}.`, false, true);
        return true;
    }

    populateOpeningSelect() {
        const select = $('#openingSelect').empty();
        this.openings.forEach((opening, index) => {
            $('<option>')
                .val(index)
                .text(opening.name)
                .appendTo(select);
        });
        select.val(this.currentOpeningIndex);
    }

    shuffleArray(array) {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    getRandomVariationIndex(openingIndex, avoidCurrent = true) {
        const opening = this.openings[openingIndex];
        const lines = opening?.lines || [];
        if (!lines.length) return -1;
        if (lines.length === 1) return 0;

        const key = opening.id || String(openingIndex);
        let bag = this.randomLineBags.get(key) || [];

        if (!bag.length) {
            bag = this.shuffleArray(lines.map((_, index) => index));
        }

        if (avoidCurrent && openingIndex === this.currentOpeningIndex && bag[0] === this.currentVariationIndex) {
            const replacementIndex = bag.findIndex(index => index !== this.currentVariationIndex);
            if (replacementIndex > 0) {
                [bag[0], bag[replacementIndex]] = [bag[replacementIndex], bag[0]];
            }
        }

        const variationIndex = bag.shift();
        this.randomLineBags.set(key, bag);
        return variationIndex;
    }

    selectRandomVariation(openingIndex = this.currentOpeningIndex, announce = true) {
        const variationIndex = this.getRandomVariationIndex(openingIndex, true);
        if (variationIndex < 0) return;
        this.selectVariation(openingIndex, variationIndex, announce);
    }

    updateSelectionInfo() {
        const opening = this.currentOpening;
        const variation = this.currentVariation;
        if (!opening || !variation) return;

        $('#headerSubtitle').text('Тренажёр шахматных дебютов');
        $('#currentOpeningName').text(opening.name);
        $('#currentVariationName').text('Линия выбрана случайно');
        $('#lineCounter').text('🎲 Случайная линия');
        $('#sideBadge')
            .text(this.playerSide === 'w' ? '⚪ За белых' : '⚫ За чёрных')
            .toggleClass('black-side', this.playerSide === 'b');

        document.title = `DebutFlow — ${opening.name}`;
    }

    selectVariation(openingIndex, variationIndex, announce = true) {
        this.cancelOpponentMove();
        const opening = this.openings[openingIndex];
        if (!opening) return;

        const lines = opening.lines || [];
        if (!lines.length) return;

        const safeVariationIndex = Math.max(0, Math.min(variationIndex, lines.length - 1));

        this.currentOpeningIndex = openingIndex;
        this.currentOpening = opening;
        this.currentVariationIndex = safeVariationIndex;
        this.currentVariation = lines[safeVariationIndex];

        try {
            this.currentMoves = this.prepareMoves(this.currentOpening, this.currentVariation);
        } catch (error) {
            console.error(error);
            this.currentMoves = [];
            this.addChatMessage(`❌ ${error.message}`, true, true);
        }

        $('#openingSelect').val(this.currentOpeningIndex);
        this.updateSelectionInfo();

        if (announce) {
            this.addChatMessage(`Для дебюта «${this.currentOpening.name}» случайно выбрана новая линия. Играем за ${this.sideLabel}.`, false, true);
        }

        this.restartCurrentMode();
    }

    restartCurrentMode() {
        this.cancelOpponentMove();
        if (this.mode === 'study') {
            this.startStudyMode(false);
        } else if (this.mode === 'practice') {
            this.startPracticeMode(false);
        } else {
            this.game = new Chess();
            this.currentMoveIndex = 0;
            this.isTrainingComplete = false;
            this.isCompletionAnnounced = false;
            this.recreateBoard(false);
            this.updateProgress();
            this.clearHighlights();
            this.updateButtonsVisibility();
        }
    }

    randomVariation() {
        this.selectRandomVariation(this.currentOpeningIndex, true);
    }

    updateProgress() {
        $('#progressText').text(`${this.currentMoveIndex}/${this.getCurrentMoves().length}`);
        this.persistSession();
    }

    forceUpdateBoard() {
        if (this.board && this.game) {
            // Без анимации: состояние chess.js сразу становится состоянием доски.
            this.board.position(this.game.fen(), false);
        }
    }

    syncGameWithIndex() {
        const tempGame = new Chess();
        const moves = this.getCurrentMoves();

        for (let i = 0; i < this.currentMoveIndex; i++) {
            const result = tempGame.move(moves[i].san, { sloppy: true });
            if (!result) {
                this.addChatMessage(`Ошибка синхронизации на ходу ${i + 1}: ${moves[i].san}`, true);
                return false;
            }
        }

        this.game = tempGame;
        this.forceUpdateBoard();
        return true;
    }

    recreateBoard(draggable) {
        this.clearTapSelection();
        if (this.board) this.board.destroy();

        const config = {
            draggable: draggable && !this.useTapControls,
            position: 'start',
            orientation: this.playerSide === 'b' ? 'black' : 'white',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
            appearSpeed: 0,
            moveSpeed: 0,
            snapSpeed: 0,
            snapbackSpeed: 0,
            trashSpeed: 0,
            onDragStart: (source, piece) => {
                if (this.mode !== 'practice' || this.isTrainingComplete) return false;

                const expectedMove = this.getCurrentMoves()[this.currentMoveIndex];
                if (!expectedMove) return false;
                if (expectedMove.color !== this.playerSide) return false;
                if (piece[0] !== this.playerSide) return false;
                return true;
            },
            onDrop: (source, target) => this.handleUserMove(source, target),
            onSnapEnd: () => this.forceUpdateBoard()
        };

        this.board = Chessboard('board', config);
        this.boardElement = document.getElementById('board');
        this.boardElement?.classList.add('loaded');
        $('#loadingOverlay').hide();
        this.forceUpdateBoard();
        this.bindTapInput();
    }

    updateButtonsVisibility() {
        if (this.mode === 'study') {
            $('#nextBtn').show();
            $('#prevBtn').show();
            $('#hintBtn').hide();
        } else if (this.mode === 'practice') {
            $('#nextBtn').hide();
            $('#prevBtn').hide();
            $('#hintBtn').show();
        } else {
            $('#nextBtn').hide();
            $('#prevBtn').hide();
            $('#hintBtn').hide();
        }
    }

    showWelcomeMessage() {
        this.addChatMessage('Добро пожаловать в DebutFlow.', false, true);
        this.addChatMessage('Выберите дебют — линия внутри него определяется случайно. Затем выберите режим «Изучение ходов» или «Практика».', false, true);
        this.addChatMessage(`Текущий дебют: ${this.currentOpening.name}. Играем за ${this.sideLabel}.`, false, true);
        if (this.currentVariation?.training_welcome) {
            this.addChatMessage(this.currentVariation.training_welcome, false, true);
        }
    }

    nextMove() {
        if (this.mode !== 'study') return;
        const moves = this.getCurrentMoves();

        if (this.currentMoveIndex >= moves.length) {
            this.announceStudyComplete();
            return;
        }

        this.syncGameWithIndex();
        const move = moves[this.currentMoveIndex];
        const result = this.game.move(move.san, { sloppy: true });

        if (!result) {
            this.addChatMessage(`Не удалось выполнить ход: ${move.san}`, true);
            return;
        }

        this.forceUpdateBoard();
        this.highlightSquare(move.to);

        const player = move.color === 'w' ? '♙ Белые' : '♟ Чёрные';
        const role = move.color === this.playerSide ? 'ваш ход' : 'ход соперника';
        const explanation = move.desc ? ` ${move.desc}` : '';
        this.addChatMessage(`${player}: ${move.san} — ${role}.${explanation}`);

        this.currentMoveIndex++;
        this.updateProgress();

        if (this.currentMoveIndex >= moves.length) this.announceStudyComplete();
    }

    prevMove() {
        if (this.mode !== 'study') return;
        if (this.currentMoveIndex <= 0) {
            this.addChatMessage('Это начало варианта.', true);
            return;
        }

        this.currentMoveIndex--;
        this.syncGameWithIndex();
        this.updateProgress();
        const move = this.getCurrentMoves()[this.currentMoveIndex];
        if (move?.from) this.highlightSquare(move.from);
        this.addChatMessage(`Возврат к ходу ${this.currentMoveIndex + 1}.`, false, true);
        this.isCompletionAnnounced = false;
    }

    announceStudyComplete() {
        if (this.isCompletionAnnounced) return;
        this.isCompletionAnnounced = true;
        this.addChatMessage('✅ Изучение варианта завершено.', false, true);
        this.addChatMessage('Теперь можно перейти в «Практику» и повторить линию самостоятельно.', false, true);
        this.showNextVariationButton();
    }

    startStudyMode(announce = true) {
        this.cancelOpponentMove();
        this.game = new Chess();
        this.currentMoveIndex = 0;
        this.isTrainingComplete = false;
        this.isCompletionAnnounced = false;

        this.recreateBoard(false);
        this.updateProgress();
        this.clearHighlights();
        $('#nextVariationBtn').hide();

        if (announce) {
            this.addChatMessage(`📚 Режим изучения. DebutFlow покажет все ходы варианта. Вы играете за ${this.sideLabel}.`, false, true);
        }

        if (!this.getCurrentMoves().length) {
            this.addChatMessage('В этом варианте нет доступных ходов.', true);
        }
    }

    startPracticeMode(announce = true) {
        this.cancelOpponentMove();
        this.game = new Chess();
        this.currentMoveIndex = 0;
        this.isTrainingComplete = false;
        this.isCompletionAnnounced = false;

        this.recreateBoard(true);
        this.updateProgress();
        this.clearHighlights();
        $('#nextVariationBtn').hide();

        if (announce) {
            this.addChatMessage(`🎯 Практика. Вы играете за ${this.sideLabel}; ходы соперника делает DebutFlow.`, false, true);
            if (this.useTapControls) {
                this.addChatMessage('📱 Телефон: коснитесь фигуры один раз, затем коснитесь нужной клетки.', false, true);
            }
        }

        this.scheduleOpponentMove();
    }

    resetTraining() {
        if (!this.mode) {
            this.addChatMessage('Сначала выберите режим тренировки.', true);
            return;
        }
        this.restartCurrentMode();
        this.addChatMessage('Вариант начат заново.', false, true);
    }

    switchMode(mode) {
        if (!['study', 'practice'].includes(mode)) return;
        this.mode = mode;
        this.updateButtonsVisibility();

        if (mode === 'study') this.startStudyMode();
        if (mode === 'practice') this.startPracticeMode();

        $('#modeStudyBtn').toggleClass('active', mode === 'study');
        $('#modePracticeBtn').toggleClass('active', mode === 'practice');
    }

    showHint() {
        if (this.mode !== 'practice') return;
        const expectedMove = this.getCurrentMoves()[this.currentMoveIndex];

        if (!expectedMove) {
            this.addChatMessage('Вариант уже завершён.', false, true);
            return;
        }

        if (expectedMove.color !== this.playerSide) {
            this.addChatMessage('Сейчас ход соперника.', false, true);
            return;
        }

        this.highlightSquare(expectedMove.from, 'highlight');
        this.highlightSquare(expectedMove.to, 'highlight');
        this.addChatMessage(`💡 Подсказка: ${expectedMove.from} → ${expectedMove.to}`);
    }

    executeOpponentMove() {
        if (this.mode !== 'practice' || this.isTrainingComplete) return;

        const moves = this.getCurrentMoves();
        if (this.currentMoveIndex >= moves.length) {
            this.completeTraining();
            return;
        }

        const expectedMove = moves[this.currentMoveIndex];
        if (expectedMove.color === this.playerSide) return;

        const result = this.game.move(expectedMove.san, { sloppy: true });
        if (!result) {
            this.addChatMessage(`Не удалось выполнить ход соперника: ${expectedMove.san}`, true);
            return;
        }

        this.currentMoveIndex++;
        this.forceUpdateBoard();
        this.updateProgress();
        this.highlightSquare(expectedMove.to);
        const explanation = expectedMove.desc ? ` — ${expectedMove.desc}` : '';
        this.addChatMessage(`Соперник: ${expectedMove.san}${explanation}`);

        if (this.currentMoveIndex >= moves.length) {
            this.completeTraining();
            return;
        }

        if (moves[this.currentMoveIndex].color !== this.playerSide) {
            this.scheduleOpponentMove();
        }
    }

    normalizeSan(san) {
        return String(san || '')
            .replace(/0/g, 'O')
            .replace(/[+#]/g, '')
            .replace(/[!?]/g, '')
            .trim();
    }

    getPromotionPiece(expectedSan) {
        const match = String(expectedSan || '').match(/=([QRBN])/i);
        return match ? match[1].toLowerCase() : 'q';
    }

    isMoveEqual(actualSan, expectedSan) {
        return this.normalizeSan(actualSan) === this.normalizeSan(expectedSan);
    }

    handleUserMove(source, target) {
        if (this.mode !== 'practice' || this.isTrainingComplete) return 'snapback';

        const moves = this.getCurrentMoves();
        const expectedMove = moves[this.currentMoveIndex];

        if (!expectedMove || expectedMove.color !== this.playerSide) return 'snapback';

        const promotion = this.getPromotionPiece(expectedMove.san);
        const move = this.game.move({ from: source, to: target, promotion });
        if (!move) return 'snapback';

        if (this.isMoveEqual(move.san, expectedMove.san)) {
            this.currentMoveIndex++;
            this.updateProgress();
            this.highlightSquare(target);
            const explanation = expectedMove.desc ? ` — ${expectedMove.desc}` : '';
            this.addChatMessage(`✅ Верно: ${move.san}${explanation}`);

            if (this.currentMoveIndex >= moves.length) {
                this.completeTraining();
                return;
            }

            this.scheduleOpponentMove();
            return;
        }

        this.game.undo();
        this.progressManager?.recordWrongMove();
        this.renderTrainingStatistics();
        this.addChatMessage(`❌ Неверный ход. Ожидается другой ход по варианту.`, true);
        this.highlightSquare(source, 'error');
        this.highlightSquare(expectedMove.to, 'highlight');
        return 'snapback';
    }

    showNextVariationButton() {
        const total = this.currentOpening?.lines?.length || 0;
        $('#nextVariationBtn').toggle(total > 0);
    }

    completeTraining() {
        if (this.isCompletionAnnounced) return;
        this.isTrainingComplete = true;
        this.isCompletionAnnounced = true;
        this.progressManager?.markPracticeLineCompleted(this.currentOpening.id, this.currentVariation.id);
        this.renderTrainingStatistics();
        this.persistSession();

        this.addChatMessage('🎉 Линия успешно пройдена.', false, true);
        this.addChatMessage('Можно запустить следующую случайную линию этого дебюта.', false, true);
        this.showNextVariationButton();
    }

    nextVariation() {
        this.selectRandomVariation(this.currentOpeningIndex, true);
    }

    bindEvents() {
        $('#openingSelect').on('change', event => {
            const openingIndex = Number(event.target.value);
            this.currentOpeningIndex = openingIndex;
            this.currentOpening = this.openings[openingIndex];
            this.currentVariationIndex = -1;
            this.currentVariation = null;
            this.selectRandomVariation(openingIndex, true);
        });

        $('#randomVariationBtn').on('click', () => this.randomVariation());
        $('#modeStudyBtn').on('click', () => this.switchMode('study'));
        $('#modePracticeBtn').on('click', () => this.switchMode('practice'));
        $('#nextBtn').on('click', () => this.nextMove());
        $('#prevBtn').on('click', () => this.prevMove());
        $('#resetBtn').on('click', () => this.resetTraining());
        $('#hintBtn').on('click', () => this.showHint());
        $('#clearChatBtn').on('click', () => this.clearChat());
        $('#nextVariationBtn').on('click', () => this.nextVariation());
    }

    init() {
        if (!this.currentOpening) {
            alert('DebutFlow: база дебютов пуста.');
            return;
        }

        this.validationErrors = this.validateAllLines();
        const savedSession = this.progressManager.getSession();
        const savedLocation = this.findSavedVariation(savedSession);
        if (savedLocation) {
            this.currentOpeningIndex = savedLocation.openingIndex;
            this.currentOpening = this.openings[this.currentOpeningIndex];
        }
        this.populateOpeningSelect();
        const initialVariationIndex = savedLocation
            ? savedLocation.variationIndex
            : this.getRandomVariationIndex(this.currentOpeningIndex, false);
        if (initialVariationIndex < 0) {
            alert('DebutFlow: выбранный дебют не содержит линий.');
            return;
        }

        this.currentVariationIndex = initialVariationIndex;
        this.currentVariation = this.currentOpening.lines[initialVariationIndex];

        try {
            this.currentMoves = this.prepareMoves(this.currentOpening, this.currentVariation);
        } catch (error) {
            console.error(error);
            this.currentMoves = [];
        }

        // Do not overwrite saved state with the initial blank board.
        this.restoringProgress = true;
        this.updateSelectionInfo();
        this.game = new Chess();
        this.recreateBoard(false);
        this.updateProgress();
        this.updateButtonsVisibility();
        this.bindEvents();
        this.renderTrainingStatistics();
        this.showWelcomeMessage();
        this.restoringProgress = false;
        if (!savedLocation || !this.restoreSavedSession(savedSession)) {
            this.persistSession();
        }
    }

    destroy() {
        this.cancelOpponentMove();
        if (this.board) this.board.destroy();
    }
}

$(document).ready(function() {
    if (!window.OPENINGS_DB || !Array.isArray(window.OPENINGS_DB.openings)) {
        alert('DebutFlow: не удалось загрузить полную базу openings.js');
        return;
    }

    window.chessTrainer = new ChessTrainer(window.OPENINGS_DB);
});
