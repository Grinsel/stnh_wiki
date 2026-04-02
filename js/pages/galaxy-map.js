/**
 * Galaxy Map module – interactive SVG map for the Empires page.
 * Flags NOT shown on map (colored dots + initials only).
 * Quadrants: Alpha=bottom-left, Beta=bottom-right, Gamma=top-left, Delta=top-right.
 * Background: milky way spiral via canvas.
 */
window.GalaxyMap = (function () {
    const NS     = 'http://www.w3.org/2000/svg';
    const SVG_W  = 900;
    const SVG_H  = 700;
    const PAD    = 72;
    const ICON_R = 7;

    const QUADRANT_COLORS = {
        'Alpha Quadrant':     '#5599ff',
        'Beta Quadrant':      '#44cc88',
        'Gamma Quadrant':     '#ff9933',
        'Delta Quadrant':     '#cc66ff',
        'Major Powers':       '#f0c040',
        'Alternate Timeline': '#ff5555',
    };
    const DEFAULT_COLOR = '#aaaaaa';

    let _container, _svg, _defs, _bgLayer, _quadLayer, _starLayer, _empireLayer, _uiLayer;
    let _tooltip, _selectedId;
    let _bounds, _scaleX, _scaleY;
    let _transform = { x: 0, y: 0, k: 1 };
    let _drag = null;
    let _mapData = [];
    let _onEmpireClick;
    let _resizeHandler = null;

    function _seededRng(seed) {
        let s = seed >>> 0;
        return function () {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 0x100000000;
        };
    }

    // Coordinate transform:
    //   X mirrored:   sx = PAD + (x_max - gx) * scaleX  → high gx = left
    //   Y not flipped: sy = PAD + (gy - y_min) * scaleY  → high gy = bottom
    // Result: Alpha(+x,+y)=bottom-left, Beta(-x,+y)=bottom-right,
    //         Gamma(+x,-y)=top-left,    Delta(-x,-y)=top-right
    function _toSVG(gx, gy) {
        return [
            PAD + (_bounds.x_max - gx) * _scaleX,
            PAD + (gy - _bounds.y_min) * _scaleY,
        ];
    }

    function _el(tag, attrs) {
        const e = document.createElementNS(NS, tag);
        if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        return e;
    }

    // ── Milky Way spiral ─────────────────────────────────────────────────────
    function _renderMilkyWayBackground() {
        const [cx, cy] = _toSVG(0, 0);
        // Canvas must be large enough that its boundary is ALWAYS outside the SVG viewport,
        // regardless of where the galactic origin falls. Half-size = max corner distance + margin.
        const halfSize = Math.ceil(Math.max(
            Math.hypot(cx,        cy),
            Math.hypot(SVG_W-cx,  cy),
            Math.hypot(cx,        SVG_H-cy),
            Math.hypot(SVG_W-cx,  SVG_H-cy),
        )) + 80;
        const CW = halfSize * 2, CH = halfSize * 2;
        // In canvas space the galactic origin is at the exact centre
        const ocx = halfSize, ocy = halfSize;

        const canvas = document.createElement('canvas');
        canvas.width = CW; canvas.height = CH;
        const ctx = canvas.getContext('2d');

        const maxR = halfSize * 0.9;  // spiral / haze radius — stays well within canvas
        const rng = _seededRng(99991);

        // Deep-space radial gradient — fades to fully transparent before canvas boundary
        const bg = ctx.createRadialGradient(ocx, ocy, 0, ocx, ocy, maxR * 1.1);
        bg.addColorStop(0,   'rgba(20,30,60,0.9)');
        bg.addColorStop(0.5, 'rgba(8,15,35,0.6)');
        bg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CW, CH);

        // Background haze
        for (let i = 0; i < 800; i++) {
            const a = rng() * Math.PI * 2;
            const d = Math.pow(rng(), 1.3) * maxR;
            ctx.beginPath();
            ctx.arc(ocx + Math.cos(a)*d, ocy + Math.sin(a)*d, 0.4 + rng()*0.8, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(200,210,255,' + (0.06 + rng()*0.14).toFixed(2) + ')';
            ctx.fill();
        }

        // 4 spiral arms
        for (let arm = 0; arm < 4; arm++) {
            const base = (arm / 4) * Math.PI * 2;
            for (let i = 0; i < 650; i++) {
                const t = rng();
                const r = 0.04*maxR + t*maxR*0.96;
                const theta = base + t*2.9 + (rng()-0.5)*0.26*(1+t*2);
                const alpha = Math.max(0, (0.5 - t*0.32) + (rng()-0.5)*0.22);
                const g2 = Math.floor(210 + rng()*45);
                ctx.beginPath();
                ctx.arc(ocx + Math.cos(theta)*r, ocy + Math.sin(theta)*r, 0.3 + rng()*(1.1-t*0.5), 0, Math.PI*2);
                ctx.fillStyle = 'rgba(200,' + g2 + ',255,' + alpha.toFixed(2) + ')';
                ctx.fill();
            }
        }

        // Bright core glow — back in the canvas, fades to 0 long before canvas boundary
        const core = ctx.createRadialGradient(ocx, ocy, 0, ocx, ocy, maxR * 0.22);
        core.addColorStop(0,    'rgba(255,240,180,0.55)');
        core.addColorStop(0.35, 'rgba(180,160,255,0.22)');
        core.addColorStop(0.7,  'rgba(80,100,200,0.07)');
        core.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = core;
        ctx.fillRect(0, 0, CW, CH);

        // Place canvas centred on the galactic origin in SVG space
        _bgLayer.appendChild(_el('image', {
            href: canvas.toDataURL('image/png'),
            x: cx - halfSize, y: cy - halfSize, width: CW, height: CH,
            'pointer-events': 'none',
        }));
    }

    // ── Sparse foreground stars ───────────────────────────────────────────────
    function _renderStars() {
        // Centre on the galactic origin and spread to maxR — same as the spiral canvas
        const [cx, cy] = _toSVG(0, 0);
        const maxR = Math.max(
            Math.hypot(cx - PAD,         cy - PAD),
            Math.hypot(SVG_W - PAD - cx, cy - PAD),
            Math.hypot(cx - PAD,         SVG_H - PAD - cy),
            Math.hypot(SVG_W - PAD - cx, SVG_H - PAD - cy),
        ) * 1.1;

        const rng = _seededRng(12345);
        const g = _el('g', { 'pointer-events': 'none' });
        for (let i = 0; i < 260; i++) {
            // Radially distributed — slightly concentrated toward core
            const a = rng() * Math.PI * 2;
            const d = Math.pow(rng(), 0.7) * maxR;   // bias toward edges like real sky
            const x = cx + Math.cos(a) * d;
            const y = cy + Math.sin(a) * d;
            // Brighter near center
            const proximity = 1 - d / maxR;
            const op = 0.15 + rng() * 0.5 + proximity * 0.2;
            g.appendChild(_el('circle', {
                cx: x, cy: y,
                r: 0.4 + rng() * 1.4, fill: 'white', opacity: Math.min(op, 0.85),
            }));
        }
        _starLayer.appendChild(g);
    }

    // ── Quadrant zones ────────────────────────────────────────────────────────
    function _renderQuadrants() {
        const [ox, oy] = _toSVG(0, 0);
        const x0 = PAD, y0 = PAD, x1 = SVG_W - PAD, y1 = SVG_H - PAD;
        // R must reach every corner of the SVG from the galactic origin
        const R = Math.max(
            Math.hypot(ox - 0,     oy - 0),
            Math.hypot(SVG_W - ox, oy - 0),
            Math.hypot(ox - 0,     SVG_H - oy),
            Math.hypot(SVG_W - ox, SVG_H - oy),
        ) * 1.05;
        const DEG = Math.PI / 180;

        // Radial gradient per quadrant color so the arc fades out and never shows a hard edge
        function _makeGradient(id, color) {
            const grad = _el('radialGradient', { id, cx: ox, cy: oy, r: R, gradientUnits: 'userSpaceOnUse' });
            const s0 = _el('stop', { offset: '0%' });   s0.style.stopColor = color; s0.style.stopOpacity = '0.18';
            const s1 = _el('stop', { offset: '70%' });  s1.style.stopColor = color; s1.style.stopOpacity = '0.06';
            const s2 = _el('stop', { offset: '100%' }); s2.style.stopColor = color; s2.style.stopOpacity = '0';
            grad.appendChild(s0); grad.appendChild(s1); grad.appendChild(s2);
            _defs.appendChild(grad);
        }

        // Helper: SVG arc path for a pie sector from the galactic origin
        function _sectorPath(startDeg, endDeg) {
            const s = startDeg * DEG, e = endDeg * DEG;
            const x1s = ox + R * Math.cos(s), y1s = oy + R * Math.sin(s);
            const x2e = ox + R * Math.cos(e), y2e = oy + R * Math.sin(e);
            return `M ${ox} ${oy} L ${x1s} ${y1s} A ${R} ${R} 0 0 1 ${x2e} ${y2e} Z`;
        }

        // [label, startDeg, endDeg, labelAngleDeg, color]
        const quads = [
            ['Alpha',  90, 180, 135, '#5599ff'],
            ['Beta',    0,  90,  45, '#44cc88'],
            ['Gamma', 180, 270, 225, '#ff9933'],
            ['Delta', 270, 360, 315, '#cc66ff'],
        ];

        // Dividing lines through galactic origin
        const ls = { stroke: '#fff', 'stroke-width': 0.5, opacity: 0.09, 'pointer-events': 'none' };
        _quadLayer.appendChild(_el('line', { x1: ox, y1: y0, x2: ox, y2: y1, ...ls }));
        _quadLayer.appendChild(_el('line', { x1: x0, y1: oy, x2: x1, y2: oy, ...ls }));

        quads.forEach(([label, startDeg, endDeg, midDeg, color], i) => {
            const gradId = 'qgrad-' + i;
            _makeGradient(gradId, color);
            // Quarter-circle sector with radial fade — no hard outer edge visible
            const sector = _el('path', { d: _sectorPath(startDeg, endDeg), fill: 'url(#' + gradId + ')', 'pointer-events': 'none' });
            _quadLayer.appendChild(sector);

            // Label at 55% of R along the midpoint angle
            const labelR = R * 0.35;
            const ma = midDeg * DEG;
            const lx = ox + labelR * Math.cos(ma);
            const ly = oy + labelR * Math.sin(ma);
            const bigSz = 28;

            const big = _el('text', {
                x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
                fill: color, 'font-size': bigSz, 'font-family': 'inherit', 'font-weight': 'bold',
                opacity: 0.14, 'pointer-events': 'none', 'user-select': 'none',
            });
            big.textContent = label;
            _quadLayer.appendChild(big);

            const small = _el('text', {
                x: lx, y: ly + bigSz * 0.75, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
                fill: color, 'font-size': 11, 'font-family': 'inherit',
                opacity: 0.45, 'pointer-events': 'none', 'user-select': 'none',
            });
            small.textContent = label + ' Quadrant';
            _quadLayer.appendChild(small);
        });
    }

    // ── Legend ────────────────────────────────────────────────────────────────
    function _renderLegend() {
        let xOff = 12;
        const y0 = SVG_H - 14;
        Object.entries(QUADRANT_COLORS).forEach(([label, color]) => {
            const g = _el('g', { 'pointer-events': 'none' });
            g.appendChild(_el('circle', { cx: xOff+5, cy: y0-5, r: 4, fill: color }));
            const t = _el('text', { x: xOff+13, y: y0, fill: '#bbb', 'font-size': 9, 'font-family': 'inherit' });
            t.textContent = label;
            g.appendChild(t);
            _uiLayer.appendChild(g);
            xOff += label.length * 5.2 + 22;
        });
    }

    // ── Empire dots (no flags on map) ─────────────────────────────────────────
    function _renderEmpires(empires) {
        _empireLayer.innerHTML = '';
        empires.forEach(emp => {
            const [sx, sy] = _toSVG(emp.x, emp.y);
            const color = QUADRANT_COLORS[emp.quadrant] || DEFAULT_COLOR;
            const g = _el('g', { class: 'empire-node', 'data-id': emp.id, tabindex: 0, role: 'button', 'aria-label': emp.id });

            // Halo
            g.appendChild(_el('circle', { cx: sx, cy: sy, r: ICON_R+3, fill: color, opacity: 0.12, 'pointer-events': 'none' }));
            // Filled dot
            g.appendChild(_el('circle', { cx: sx, cy: sy, r: ICON_R, fill: color, opacity: 0.5, class: 'empire-ring' }));
            // Stroke ring
            g.appendChild(_el('circle', { cx: sx, cy: sy, r: ICON_R, fill: 'none', stroke: color, 'stroke-width': 1.5, class: 'empire-ring' }));
            // 2-letter initials
            const init2 = emp.id.replace(/[^A-Z]/g,'').slice(0,2) || emp.id.slice(0,2).toUpperCase();
            const t = _el('text', { x: sx, y: sy+3, 'text-anchor': 'middle', fill: '#fff', 'font-size': 6, 'font-weight': 'bold', 'font-family': 'inherit', 'pointer-events': 'none' });
            t.textContent = init2;
            g.appendChild(t);
            // System label
            if (emp.system_name) {
                const lbl = _el('text', { x: sx, y: sy+ICON_R+9, 'text-anchor': 'middle', fill: '#99aacc', 'font-size': 7, 'font-family': 'inherit', 'pointer-events': 'none' });
                lbl.textContent = emp.system_name;
                g.appendChild(lbl);
            }

            g.addEventListener('mouseenter', () => {
                const rect = _container.getBoundingClientRect();
                _showTooltip(_transform.x + sx*_transform.k - rect.left, _transform.y + sy*_transform.k - rect.top, emp);
            });
            g.addEventListener('mouseleave', _hideTooltip);
            g.addEventListener('click', () => _selectEmpire(emp.id));
            g.addEventListener('keydown', (e) => { if (e.key==='Enter'||e.key===' ') _selectEmpire(emp.id); });
            _empireLayer.appendChild(g);
        });
    }

    function _selectEmpire(id) {
        _selectedId = id;
        _updateSelection();
        if (_onEmpireClick) _onEmpireClick(id);
    }

    function _updateSelection() {
        _empireLayer.querySelectorAll('.empire-node').forEach(g => {
            const sel = g.dataset.id === _selectedId;
            g.querySelectorAll('.empire-ring').forEach(r => {
                if (r.getAttribute('fill') === 'none') r.setAttribute('stroke-width', sel ? 3 : 1.5);
                else r.setAttribute('opacity', sel ? 0.9 : 0.5);
            });
        });
    }

    function _showTooltip(cx, cy, emp) {
        const color = QUADRANT_COLORS[emp.quadrant] || DEFAULT_COLOR;
        _tooltip.innerHTML = '<div style="font-weight:bold;color:' + color + '">' + _esc(emp.id) + '</div>' +
            (emp.system_name ? '<div style="color:#aaa;font-size:0.85em">' + _esc(emp.system_name) + '</div>' : '') +
            '<div style="color:#888;font-size:0.8em;margin-top:2px">' + _esc(emp.quadrant) + '</div>';
        _tooltip.classList.remove('hidden');
        const tw = _tooltip.offsetWidth||140, th = _tooltip.offsetHeight||60;
        const cW = _container.clientWidth, cH = _container.clientHeight;
        let tx = cx+18, ty = cy-th/2;
        if (tx+tw > cW) tx = cx-tw-14;
        if (ty < 4) ty = 4;
        if (ty+th > cH) ty = cH-th-4;
        _tooltip.style.left = tx + 'px';
        _tooltip.style.top  = ty + 'px';
    }
    function _hideTooltip() { _tooltip.classList.add('hidden'); }

    // ── Zoom / Pan ────────────────────────────────────────────────────────────
    function _setupZoomPan() {
        _svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = _svg.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const newK = Math.max(0.4, Math.min(8, _transform.k * (e.deltaY < 0 ? 1.15 : 1/1.15)));
            _transform.x = mx - (mx - _transform.x) * (newK / _transform.k);
            _transform.y = my - (my - _transform.y) * (newK / _transform.k);
            _transform.k = newK;
            _applyTransform();
        }, { passive: false });

        _svg.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            _drag = { startX: e.clientX, startY: e.clientY, tx0: _transform.x, ty0: _transform.y };
            _svg.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!_drag) return;
            _transform.x = _drag.tx0 + (e.clientX - _drag.startX);
            _transform.y = _drag.ty0 + (e.clientY - _drag.startY);
            _applyTransform();
        });
        window.addEventListener('mouseup', () => { _drag = null; if (_svg) _svg.style.cursor = 'grab'; });

        let lt = null;
        _svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) { const t = e.touches[0]; _drag = { startX: t.clientX, startY: t.clientY, tx0: _transform.x, ty0: _transform.y }; }
            if (e.touches.length === 2) lt = [e.touches[0], e.touches[1]];
        }, { passive: true });
        _svg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && _drag) {
                const t = e.touches[0];
                _transform.x = _drag.tx0 + (t.clientX - _drag.startX);
                _transform.y = _drag.ty0 + (t.clientY - _drag.startY);
                _applyTransform();
            }
            if (e.touches.length === 2 && lt) {
                const d0 = Math.hypot(lt[0].clientX-lt[1].clientX, lt[0].clientY-lt[1].clientY);
                const d1 = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
                if (d0 > 0) { _transform.k = Math.max(0.4, Math.min(8, _transform.k*d1/d0)); _applyTransform(); }
                lt = [e.touches[0], e.touches[1]];
            }
        }, { passive: true });
        _svg.addEventListener('touchend', () => { _drag = null; lt = null; }, { passive: true });
    }

    function _applyTransform() {
        const root = _svg && _svg.querySelector('#gmap-content');
        if (root) root.setAttribute('transform', 'translate(' + _transform.x + ',' + _transform.y + ') scale(' + _transform.k + ')');
    }

    // ── Public API ────────────────────────────────────────────────────────────
    function init(container, mapData, onEmpireClick) {
        _container     = container;
        _mapData       = mapData.empires || [];
        _bounds        = mapData.bounds;
        _onEmpireClick = onEmpireClick;
        _selectedId    = null;
        _transform     = { x: 0, y: 0, k: 1 };
        _drag          = null;

        _scaleX = (SVG_W - PAD*2) / (_bounds.x_max - _bounds.x_min);
        _scaleY = (SVG_H - PAD*2) / (_bounds.y_max - _bounds.y_min);

        container.innerHTML = '';
        container.style.position = 'relative';

        _svg = _el('svg', { viewBox: '0 0 ' + SVG_W + ' ' + SVG_H, preserveAspectRatio: 'xMidYMid meet', overflow: 'hidden' });
        _svg.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;background:#060c18';
        _svg.appendChild(_el('rect', { width: SVG_W, height: SVG_H, fill: '#060c18' }));
        _defs = _el('defs');
        _svg.appendChild(_defs);

        const content = _el('g', { id: 'gmap-content' });
        _svg.appendChild(content);
        _bgLayer     = _el('g', { id: 'gmap-bg',     'pointer-events': 'none' });
        _quadLayer   = _el('g', { id: 'gmap-quads',  'pointer-events': 'none' });
        _starLayer   = _el('g', { id: 'gmap-stars',  'pointer-events': 'none' });
        _empireLayer = _el('g', { id: 'gmap-empires' });
        content.appendChild(_bgLayer);
        content.appendChild(_quadLayer);
        content.appendChild(_starLayer);
        content.appendChild(_empireLayer);

        _uiLayer = _el('g', { id: 'gmap-ui', 'pointer-events': 'none' });
        _svg.appendChild(_uiLayer);
        container.appendChild(_svg);

        _tooltip = document.createElement('div');
        _tooltip.className = 'galaxy-tooltip hidden';
        _tooltip.style.cssText = 'position:absolute;background:rgba(6,14,30,0.95);border:1px solid #334;border-radius:6px;padding:8px 12px;pointer-events:none;z-index:10;min-width:130px;font-size:0.85rem;line-height:1.4;box-shadow:0 2px 12px rgba(0,0,0,0.7)';
        container.appendChild(_tooltip);

        const ctrlBar = document.createElement('div');
        ctrlBar.style.cssText = 'position:absolute;top:8px;right:10px;z-index:5';
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '⌖ Reset View';
        resetBtn.className   = 'tab-btn';
        resetBtn.style.cssText = 'font-size:0.75rem;padding:3px 8px';
        resetBtn.addEventListener('click', resetView);
        ctrlBar.appendChild(resetBtn);
        container.appendChild(ctrlBar);

        // Fit container height to remaining viewport (no scroll needed)
        function _fitHeight() {
            const top = container.getBoundingClientRect().top + window.scrollY;
            container.style.height = Math.max(300, window.innerHeight - top - 16) + 'px';
        }
        _fitHeight();
        _resizeHandler = _fitHeight;
        window.addEventListener('resize', _resizeHandler);

        _renderMilkyWayBackground();
        _renderQuadrants();
        _renderStars();
        _renderEmpires(_mapData);
        _renderLegend();
        _setupZoomPan();
        resetView();
    }

    function highlight(id) {
        _selectedId = id;
        _updateSelection();
        const emp = _mapData.find(e => e.id === id);
        if (!emp) return;
        const [sx, sy] = _toSVG(emp.x, emp.y);
        _transform.x = SVG_W/2 - sx*_transform.k;
        _transform.y = SVG_H/2 - sy*_transform.k;
        _applyTransform();
    }

    function resetView() {
        _transform = { x: 0, y: 0, k: 1 };
        _applyTransform();
    }

    function destroy() {
        if (_resizeHandler) { window.removeEventListener('resize', _resizeHandler); _resizeHandler = null; }
        if (_container) _container.innerHTML = '';
        _svg = _defs = _bgLayer = _quadLayer = _starLayer = _empireLayer = _uiLayer = null;
        _tooltip = null; _container = null; _mapData = []; _drag = null;
    }

    function _esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    return { init, highlight, resetView, destroy };
})();
