// DebutFlow local-only progress. No accounts, cookies, requests, or tracking.
// Storage version is intentionally explicit so future upgrades can migrate safely.
class ProgressManager {
    constructor(storage = null) {
        this.storage = storage;
        this.storageKey = 'debutflow.progress.v1';
        this.data = {
            version: 1,
            session: null,
            statistics: { completedLineIds: [], errors: 0 }
        };
        this.load();
    }

    getStorage() {
        try {
            return this.storage || window.localStorage;
        } catch (_) {
            return null;
        }
    }

    load() {
        try {
            const raw = this.getStorage()?.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== 1 || typeof parsed !== 'object') return;

            const session = parsed.session;
            if (session && typeof session.openingId === 'string' &&
                typeof session.lineId === 'string' &&
                ['study', 'practice', null].includes(session.mode) &&
                Number.isSafeInteger(session.moveIndex) && session.moveIndex >= 0) {
                this.data.session = {
                    openingId: session.openingId,
                    lineId: session.lineId,
                    mode: session.mode,
                    moveIndex: session.moveIndex
                };
            }

            const stats = parsed.statistics || {};
            if (Array.isArray(stats.completedLineIds)) {
                this.data.statistics.completedLineIds = [...new Set(stats.completedLineIds
                    .filter(id => typeof id === 'string' && id.length < 250))].slice(0, 1000);
            }
            if (Number.isSafeInteger(stats.errors) && stats.errors >= 0) {
                this.data.statistics.errors = stats.errors;
            }
        } catch (error) {
            // Invalid JSON or unavailable storage must not stop the chess trainer.
            console.warn('DebutFlow: сохранённый прогресс не прочитан; работаем без него.', error);
        }
    }

    save() {
        try {
            const storage = this.getStorage();
            if (!storage) return false;
            storage.setItem(this.storageKey, JSON.stringify(this.data));
            return true;
        } catch (error) {
            // Private browsing, file:// restrictions and quota errors are non-fatal.
            console.warn('DebutFlow: прогресс не удалось сохранить в браузере.', error);
            return false;
        }
    }

    getSession() {
        return this.data.session ? { ...this.data.session } : null;
    }

    setSession(session) {
        if (!session || !session.openingId || !session.lineId) return;
        this.data.session = { ...session };
        this.save();
    }

    getStatistics() {
        return {
            completedLines: this.data.statistics.completedLineIds.length,
            errors: this.data.statistics.errors
        };
    }

    markPracticeLineCompleted(openingId, lineId) {
        const key = `${openingId}:${lineId}`;
        const completed = this.data.statistics.completedLineIds;
        if (completed.includes(key)) return false;
        completed.push(key);
        this.save();
        return true;
    }

    recordWrongMove() {
        this.data.statistics.errors++;
        this.save();
    }
}
