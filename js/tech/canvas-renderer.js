/**
 * Canvas renderer for the tier-based tech tree layout.
 *
 * Responsibilities:
 *  - Draws ALL prerequisite links as canvas paths, eliminating thousands of SVG
 *    <line> elements (the biggest SVG-at-scale bottleneck).
 *  - Draws compact colored overview glyphs for ALL nodes when zoom drops below
 *    MIN_SVG_ZOOM (0.20), where the viewport virtualizer removes SVG nodes to
 *    keep the DOM small.
 *  - Debounces redraws with requestAnimationFrame so every zoom/pan frame is
 *    handled without re-entrancy.
 *
 * The canvas is inserted *before* the SVG in the container so it renders
 * behind it. CSS z-index ensures correct stacking.
 */
export class CanvasTechRenderer {
    /**
     * @param {HTMLElement} container  The #tech-tree container element
     * @param {Array}       nodes      All positioned nodes with {x, y, area, id}
     * @param {Array}       links      All hydrated links with {source:{x,y}, target:{x,y}}
     * @param {number}      width      Container client width in CSS pixels
     * @param {number}      height     Container client height in CSS pixels
     */
    constructor(container, nodes, links, width, height) {
        this._nodes  = nodes;
        this._links  = links;
        this._width  = width;
        this._height = height;
        this._rafId  = null;
        this._lastT  = null;

        // Ensure container provides a positioning context for z-index to work
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        this._canvas = document.createElement('canvas');
        this._canvas.classList.add('tech-canvas-layer');
        this._canvas.width  = width;
        this._canvas.height = height;
        Object.assign(this._canvas.style, {
            position:      'absolute',
            top:           '0',
            left:          '0',
            width:         width  + 'px',
            height:        height + 'px',
            zIndex:        '0',
            pointerEvents: 'none',
        });

        // Insert canvas before the SVG so it sits below in the paint order
        container.insertBefore(this._canvas, container.firstChild);

        // Lift the SVG above canvas in the stacking order
        const svgEl = container.querySelector('svg');
        if (svgEl) {
            if (getComputedStyle(svgEl).position === 'static') svgEl.style.position = 'relative';
            svgEl.style.zIndex = '1';
        }

        this._ctx = this._canvas.getContext('2d');
    }

    /** Replace node/link data (call after re-filter + re-layout). */
    setData(nodes, links) {
        this._nodes = nodes;
        this._links = links;
    }

    /**
     * Schedule a canvas redraw for the given D3 zoom transform.
     * Multiple calls within the same frame are coalesced into one draw.
     * @param {{k:number, x:number, y:number}} transform  D3 zoom transform
     */
    scheduleRender(transform) {
        this._lastT = transform;
        if (this._rafId != null) return;  // already scheduled this frame
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this._draw();
        });
    }

    _draw() {
        const ctx = this._ctx;
        const t   = this._lastT;
        if (!t) return;

        ctx.clearRect(0, 0, this._width, this._height);

        const { k, x, y } = t;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);

        // --- Draw links (k >= 0.30 matches the SVG LOD threshold in render.js) ---
        if (k >= 0.30 && this._links.length) {
            ctx.beginPath();
            ctx.strokeStyle = '#555';
            ctx.lineWidth   = 1.5 / k;   // constant screen-space stroke weight
            ctx.globalAlpha = 0.75;
            for (const link of this._links) {
                const sx = link.source?.x, sy = link.source?.y;
                const tx = link.target?.x, ty = link.target?.y;
                if (typeof sx !== 'number' || typeof tx !== 'number') continue;
                ctx.moveTo(sx, sy);
                ctx.lineTo(tx, ty);
            }
            ctx.stroke();
        }

        // --- Draw overview glyphs when SVG nodes are absent (k < MIN_SVG_ZOOM) ---
        // The viewport virtualizer removes all SVG <g> nodes below this threshold.
        // Small colored circles give a map-like overview of the full tree.
        if (k < 0.20 && this._nodes.length) {
            const r = 5 / k;   // ~5 px screen-space radius in world units
            ctx.globalAlpha = 0.85;
            for (const node of this._nodes) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
                ctx.fillStyle = _areaColor(node.area);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    /** Update canvas dimensions after a container resize. */
    resize(w, h) {
        this._width  = w;
        this._height = h;
        this._canvas.width  = w;
        this._canvas.height = h;
        this._canvas.style.width  = w + 'px';
        this._canvas.style.height = h + 'px';
        if (this._lastT) this._draw();
    }

    /** Remove canvas from DOM and cancel any pending animation frame. */
    destroy() {
        if (this._rafId != null) cancelAnimationFrame(this._rafId);
        this._canvas.remove();
    }
}

/** Area color mirror of getAreaColor() in render.js (keeps this module self-contained). */
function _areaColor(area) {
    switch (area) {
        case 'physics':     return '#2a7fff';
        case 'society':     return '#36d673';
        case 'engineering': return '#ffb400';
        default:            return '#666666';
    }
}
