// Singleton Web Worker manager for force simulation pre-computation.
// Abstracts worker lifecycle including cancellation of stale in-flight requests.

let _worker        = null;
let _currentResolve = null;

function getWorker() {
    if (_worker) return _worker;
    try {
        _worker = new Worker(
            new URL('../../force-worker.js', import.meta.url),
            { type: 'module' }
        );
        _worker.onerror = () => {
            if (_currentResolve) { _currentResolve(null); _currentResolve = null; }
            _worker = null; // allow recreation on next call
        };
    } catch (e) {
        _worker = null;
    }
    return _worker;
}

/**
 * Run force simulation in a Web Worker.
 * Resolves with an array of {id, x, y} at convergence,
 * or null when the worker is unavailable (caller falls back to sync ticks).
 *
 * Only one request is active at a time — superseded requests resolve null.
 *
 * @param {Array<{id,x,y}>}          nodes  - Plain node snapshots
 * @param {Array<{source,target}>}   links  - Plain link snapshots (IDs as strings)
 * @param {number}                   width
 * @param {number}                   height
 * @param {object}                   config - Simulation parameters + numTicks
 */
export function runForceInWorker(nodes, links, width, height, config) {
    return new Promise(resolve => {
        const worker = getWorker();
        if (!worker) { resolve(null); return; }

        // Cancel any superseded in-flight request
        if (_currentResolve) { _currentResolve(null); _currentResolve = null; }
        _currentResolve = resolve;

        const onMsg = ({ data }) => {
            if (_currentResolve !== resolve) return; // superseded
            _currentResolve = null;
            worker.removeEventListener('message', onMsg);
            resolve(data.positions ?? null);
        };
        worker.addEventListener('message', onMsg);

        worker.postMessage({ nodes, links, width, height, config });
    });
}

/**
 * Create a "Computing layout…" overlay on the given container element.
 * Returns the element so the caller can remove it when layout is ready.
 */
export function createLayoutOverlay(container) {
    const el = document.createElement('div');
    el.className = 'layout-computing-overlay';
    el.style.cssText = [
        'position:absolute',
        'inset:0',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(0,0,0,0.45)',
        'z-index:50',
        'color:var(--text-muted,#aaa)',
        'font-size:0.85rem',
        'border-radius:inherit',
        'pointer-events:none',
        'letter-spacing:0.5px',
    ].join(';');
    el.textContent = 'Computing layout\u2026';
    container.style.position = container.style.position || 'relative';
    container.appendChild(el);
    return el;
}
