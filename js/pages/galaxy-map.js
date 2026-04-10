/**
 * Galaxy Map module – interactive SVG map for the Empires page.
 * Rendered with D3 v7. Single SVG approach (no canvas).
 * Quadrants: Alpha=bottom-left, Beta=bottom-right, Gamma=top-left, Delta=top-right.
 * Quadrant overlay: only rendered for full_galaxy and mirror_galaxy types.
 */
window.GalaxyMap = (function () {

    // ── Constants ─────────────────────────────────────────────────────────────
    const SVG_W  = 900;
    const SVG_H  = 700;
    const PAD    = 72;
    const ICON_R = 7;

    const QUADRANT_COLORS = {
        'Alpha Quadrant':     '#5599ff',
        'Beta Quadrant':      '#ff4455',
        'Gamma Quadrant':     '#cc66ff',
        'Delta Quadrant':     '#44cc88',
        'Major Powers':       '#f0c040',
        'Alternate Timeline': '#ff9933',
    };
    const DEFAULT_COLOR = '#aaaaaa';

    const QUADRANT_LEGEND_KEYS = {
        'Alpha Quadrant':     'ui.galaxy.legend.alpha',
        'Beta Quadrant':      'ui.galaxy.legend.beta',
        'Gamma Quadrant':     'ui.galaxy.legend.gamma',
        'Delta Quadrant':     'ui.galaxy.legend.delta',
        'Major Powers':       'ui.galaxy.legend.major',
        'Alternate Timeline': 'ui.galaxy.legend.alt',
    };

    // Home-quadrant overrides for major empires.
    // Empires listed here are filtered by these quadrants on partial maps
    // instead of the generic 'Major Powers' tag they carry in the data.
    const MAJOR_EMPIRE_QUADRANT = {
        'UnitedEarth':                    'Alpha Quadrant',
        'CardassianUnion':                'Alpha Quadrant',
        'FerengiAlliance':                'Alpha Quadrant',
        'FerengiAlliance_B':              'Alpha Quadrant',
        'ConfederationEarth':             'Alpha Quadrant',
        'tngUnitedFederationofPlanets':   'Alpha Quadrant',
        'tngTerranEmpire':                'Alpha Quadrant',
        'KlingonEmpire':                  'Beta Quadrant',
        'RomulanStarEmpire':              'Beta Quadrant',
        'tngKlingonCardassianAlliance':   'Beta Quadrant',
        'tngCoalitionHope':               'Beta Quadrant',
        'TheDominion':                    'Gamma Quadrant',
        'BorgCollective':                 'Delta Quadrant',
        'UndineVanguard':                 'Delta Quadrant',
    };

    // Stored maps metadata for refreshOverlay (set during _renderOverlay)
    let _mapsMeta = null;
    let _resetBtn = null;

    // Strip Stellaris color codes (§X...§!) and take only the first line.
    function _locMapLabel(m) {
        if (!m.loc_key) return m.label;
        const raw = I18n.getData()[m.loc_key];
        if (!raw) return m.label;
        return raw.split('\n')[0].replace(/£/g, '').replace(/§.\s*/g, '').replace(/§!/g, '').trim() || m.label;
    }

    // Whether this map type receives the quadrant sector overlay
    function _hasQuadrantOverlay(mapType) {
        return mapType === 'full_galaxy' || mapType === 'mirror_galaxy';
    }

    // Returns the set of quadrant labels allowed on a given map type.
    // null means no restriction (all quadrants permitted).
    function _allowedQuadrantsFor(mapType) {
        const MAJOR = 'Major Powers';
        const ALT   = 'Alternate Timeline';
        if (mapType === 'alpha_beta' || mapType === 'mirror_alpha_beta')
            return new Set(['Alpha Quadrant', 'Beta Quadrant', MAJOR, ALT]);
        if (mapType === 'gamma')
            return new Set(['Gamma Quadrant', MAJOR, ALT]);
        if (mapType === 'delta')
            return new Set(['Delta Quadrant', MAJOR, ALT]);
        return null;  // full_galaxy, mirror_galaxy, botf — show all
    }

    // ── Module state ──────────────────────────────────────────────────────────
    let _container, _svg, _xScale, _yScale, _zoom;
    let _gridLayer, _quadLayer, _empireLayer;
    let _tooltip, _overlayEl, _legendEl, _selectorEl;
    let _selectedId;
    let _bounds, _mapData, _mapType, _xPreMirrored;
    let _onEmpireClick;

    // ── Coordinate transform ──────────────────────────────────────────────────
    // X scale uses inverted domain [x_max → x_min] → [PAD → SVG_W-PAD]: high gx = left.
    // Mirror map data is pre-mirrored in the mod's scenario files, so no extra negation.
    // Y: domain [y_min → y_max] → [PAD → SVG_H-PAD]: high gy = bottom.
    // Standard result: Alpha(+x,+y)=bottom-left, Beta(-x,+y)=bottom-right,
    //                  Gamma(+x,-y)=top-left,    Delta(-x,-y)=top-right
    function _toSVG(gx, gy) {
        return [_xScale(gx), _yScale(gy)];
    }

    // ── Seeded LCG RNG (deterministic star positions) ─────────────────────────
    function _seededRng(seed) {
        let s = seed >>> 0;
        return function () {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 0x100000000;
        };
    }

    // ── Static star layer ─────────────────────────────────────────────────────
    // Rendered outside the zoom group so stars stay fixed while the map pans.
    function _renderStars(svgSel) {
        const isMirror = _mapType.includes('mirror');
        const fill = isMirror ? '#ffccbb' : '#c8d8ff';
        const rng  = _seededRng(12345);
        const g = svgSel.append('g')
            .attr('id', 'gmap-stars')
            .attr('pointer-events', 'none');
        for (let i = 0; i < 100; i++) {
            const x  = PAD * 0.3 + rng() * (SVG_W - PAD * 0.3);
            const y  = PAD * 0.3 + rng() * (SVG_H - PAD * 0.3);
            const r  = 0.4 + rng() * 1.2;
            const op = Math.min(0.12 + rng() * 0.45, 0.7);
            g.append('circle')
                .attr('cx', x).attr('cy', y).attr('r', r)
                .attr('fill', fill).attr('opacity', op);
        }
    }

    // ── Coordinate grid ───────────────────────────────────────────────────────
    // Rendered in game-coordinate space; lines at round-number intervals.
    function _renderGrid() {
        const rangeX = _bounds.x_max - _bounds.x_min;
        const rangeY = _bounds.y_max - _bounds.y_min;
        const range  = Math.max(rangeX, rangeY);

        // Nice round interval (~8 divisions along the longer axis)
        const rawInterval = range / 8;
        const mag         = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        const interval    = Math.round(rawInterval / mag) * mag || 50;

        const xStart = Math.ceil(_bounds.x_min  / interval) * interval;
        const xEnd   = Math.floor(_bounds.x_max / interval) * interval;
        const yStart = Math.ceil(_bounds.y_min  / interval) * interval;
        const yEnd   = Math.floor(_bounds.y_max / interval) * interval;

        const stroke  = '#2a3a5a';
        const opacity = 0.55;
        const sw      = 0.4;

        // Vertical lines (constant game-x)
        for (let gx = xStart; gx <= xEnd; gx += interval) {
            const sx = _xScale(gx);
            _gridLayer.append('line')
                .attr('x1', sx).attr('y1', PAD)
                .attr('x2', sx).attr('y2', SVG_H - PAD)
                .attr('stroke', stroke).attr('stroke-width', sw).attr('opacity', opacity);
        }

        // Horizontal lines (constant game-y)
        for (let gy = yStart; gy <= yEnd; gy += interval) {
            const sy = _yScale(gy);
            _gridLayer.append('line')
                .attr('x1', PAD).attr('y1', sy)
                .attr('x2', SVG_W - PAD).attr('y2', sy)
                .attr('stroke', stroke).attr('stroke-width', sw).attr('opacity', opacity);
        }
    }

    // ── Quadrant zones ────────────────────────────────────────────────────────
    // Only rendered for full_galaxy and mirror_galaxy. Requires the galactic
    // origin (0,0) to be meaningful — all other map types skip it entirely.
    function _renderQuadrants(defs) {
        if (!_hasQuadrantOverlay(_mapType)) return;

        const [ox, oy] = _toSVG(0, 0);
        const x0 = PAD, y0 = PAD, x1 = SVG_W - PAD, y1 = SVG_H - PAD;
        const R = Math.max(
            Math.hypot(ox,         oy),
            Math.hypot(SVG_W - ox, oy),
            Math.hypot(ox,         SVG_H - oy),
            Math.hypot(SVG_W - ox, SVG_H - oy),
        ) * 1.05;
        const DEG = Math.PI / 180;

        function makeGradient(id, color) {
            const grad = defs.append('radialGradient')
                .attr('id', id)
                .attr('cx', ox).attr('cy', oy).attr('r', R)
                .attr('gradientUnits', 'userSpaceOnUse');
            grad.append('stop').attr('offset', '0%')
                .style('stop-color', color).style('stop-opacity', 0.18);
            grad.append('stop').attr('offset', '70%')
                .style('stop-color', color).style('stop-opacity', 0.06);
            grad.append('stop').attr('offset', '100%')
                .style('stop-color', color).style('stop-opacity', 0);
        }

        function sectorPath(startDeg, endDeg) {
            const s = startDeg * DEG, e = endDeg * DEG;
            const x1s = ox + R * Math.cos(s), y1s = oy + R * Math.sin(s);
            const x2e = ox + R * Math.cos(e), y2e = oy + R * Math.sin(e);
            return `M ${ox} ${oy} L ${x1s} ${y1s} A ${R} ${R} 0 0 1 ${x2e} ${y2e} Z`;
        }

        // [label, startDeg, endDeg, midDeg, color, greek]
        // Mirror maps flip the X axis, so Alpha↔Beta and Gamma↔Delta swap sectors.
        const isMirrorMap = _xPreMirrored;
        const quads = isMirrorMap ? [
            ['Alpha',   0,  90,  45, '#5599ff', 'α'],
            ['Beta',   90, 180, 135, '#ff4455', 'β'],
            ['Gamma', 270, 360, 315, '#cc66ff', 'γ'],
            ['Delta', 180, 270, 225, '#44cc88', 'δ'],
        ] : [
            ['Alpha',  90, 180, 135, '#5599ff', 'α'],
            ['Beta',    0,  90,  45, '#ff4455', 'β'],
            ['Gamma', 180, 270, 225, '#cc66ff', 'γ'],
            ['Delta', 270, 360, 315, '#44cc88', 'δ'],
        ];

        // Dividing lines through the galactic origin
        _quadLayer.append('line')
            .attr('x1', ox).attr('y1', y0).attr('x2', ox).attr('y2', y1)
            .attr('stroke', '#fff').attr('stroke-width', 0.5).attr('opacity', 0.09)
            .attr('pointer-events', 'none');
        _quadLayer.append('line')
            .attr('x1', x0).attr('y1', oy).attr('x2', x1).attr('y2', oy)
            .attr('stroke', '#fff').attr('stroke-width', 0.5).attr('opacity', 0.09)
            .attr('pointer-events', 'none');

        quads.forEach(([label, startDeg, endDeg, midDeg, color, greek], i) => {
            const gradId = 'qgrad-' + i;
            makeGradient(gradId, color);
            _quadLayer.append('path')
                .attr('d', sectorPath(startDeg, endDeg))
                .attr('fill', 'url(#' + gradId + ')')
                .attr('pointer-events', 'none');
            const ma = midDeg * DEG;
            _quadLayer.append('text')
                .attr('x', ox + 40 * Math.cos(ma))
                .attr('y', oy + 40 * Math.sin(ma))
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('fill', color)
                .attr('font-size', 48)
                .attr('font-family', 'inherit')
                .attr('font-weight', 'bold')
                .attr('opacity', 0.18)
                .attr('pointer-events', 'none')
                .attr('user-select', 'none')
                .text(greek);
        });
    }

    // ── Legend ────────────────────────────────────────────────────────────────
    function _getLegendEntries() {
        const allowed = _allowedQuadrantsFor(_mapType);
        const presentQuadrants = new Set(
            _mapData
                .filter(e => {
                    if (e.x == null || e.y == null || !e.system_name) return false;
                    if (!allowed) return true;
                    const baseQ = MAJOR_EMPIRE_QUADRANT[e.id] || e.quadrant;
                    return allowed.has(baseQ);
                })
                .map(e => e.quadrant)
        );
        return Object.entries(QUADRANT_COLORS).filter(([k]) => presentQuadrants.has(k));
    }

    function _renderOverlay(maps, mapId, onMapChange) {
        _mapsMeta = maps || null;
        _overlayEl = document.createElement('div');
        _overlayEl.style.cssText = 'position:absolute;left:10px;top:10px;z-index:6;display:flex;flex-direction:column;align-items:flex-start;gap:8px';

        // Map selector dropdown (only when multiple maps are available)
        if (maps && maps.length > 1 && onMapChange) {
            _selectorEl = document.createElement('select');
            _selectorEl.style.cssText = 'background:rgba(6,14,30,0.90);border:1px solid #556;border-radius:6px;padding:5px 28px 5px 10px;color:#ccd6f0;font-size:0.78rem;cursor:pointer;pointer-events:auto;max-width:220px;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%2388aacc\' stroke-width=\'1.8\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 9px center';
            const eras = [...new Set(maps.map(m => m.era))];
            eras.forEach(era => {
                const eraMaps = maps.filter(m => m.era === era);
                if (!eraMaps.length) return;
                const group = document.createElement('optgroup');
                group.label = I18n.ui(era === 'tng' ? 'ui.galaxy.era.tng' : 'ui.galaxy.era.classic');
                eraMaps.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = _locMapLabel(m);
                    if (m.id === mapId) opt.selected = true;
                    group.appendChild(opt);
                });
                _selectorEl.appendChild(group);
            });
            _selectorEl.addEventListener('change', () => onMapChange(_selectorEl.value));
            _overlayEl.appendChild(_selectorEl);
        }

        // Quadrant legend
        _legendEl = document.createElement('div');
        _legendEl.style.cssText = 'background:rgba(6,14,30,0.85);border:1px solid #334;border-radius:6px;padding:10px 14px;pointer-events:none;font-size:0.8rem;line-height:1.9';
        _getLegendEntries().forEach(([label, color]) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;white-space:nowrap';
            const dot = document.createElement('span');
            dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';flex-shrink:0';
            const txt = document.createElement('span');
            txt.style.color = '#bbb';
            txt.textContent = I18n.ui(QUADRANT_LEGEND_KEYS[label] || label);
            row.appendChild(dot);
            row.appendChild(txt);
            _legendEl.appendChild(row);
        });
        _overlayEl.appendChild(_legendEl);

        _container.appendChild(_overlayEl);
    }

    function setLegendVisible(visible) {
        if (_overlayEl) _overlayEl.style.display = visible ? '' : 'none';
    }

    // Re-translate the overlay after a language change (without full re-init).
    function refreshOverlay() {
        // Dropdown: update optgroup labels and option text
        if (_selectorEl && _mapsMeta) {
            Array.from(_selectorEl.children).forEach(group => {
                const firstOpt = group.querySelector('option');
                if (!firstOpt) return;
                Array.from(group.children).forEach(opt => {
                    const m = _mapsMeta.find(x => x.id === opt.value);
                    if (m) opt.textContent = _locMapLabel(m);
                });
                const firstMap = _mapsMeta.find(x => x.id === firstOpt.value);
                if (firstMap) group.label = I18n.ui(firstMap.era === 'tng' ? 'ui.galaxy.era.tng' : 'ui.galaxy.era.classic');
            });
        }
        // Legend: update text spans in-place
        if (_legendEl) {
            const entries = _getLegendEntries();
            const rows = _legendEl.querySelectorAll('div');
            entries.forEach(([label], i) => {
                const row = rows[i];
                if (!row) return;
                const txt = row.querySelector('span:last-child');
                if (txt) txt.textContent = I18n.ui(QUADRANT_LEGEND_KEYS[label] || label);
            });
        }
        // Reset view button
        if (_resetBtn) _resetBtn.textContent = I18n.ui('ui.galaxy.reset');
    }

    // ── Empire nodes ──────────────────────────────────────────────────────────
    function _visibleEmpires() {
        const allowed = _allowedQuadrantsFor(_mapType);
        return _mapData.filter(emp => {
            if (emp.x == null || emp.y == null || !emp.system_name) return false;
            if (!allowed) return true;
            const baseQ = MAJOR_EMPIRE_QUADRANT[emp.id] || emp.quadrant;
            return allowed.has(baseQ);
        });
    }

    function _renderEmpires() {
        const empires = _visibleEmpires();

        // D3 data-join: enter selection builds node structure; update sets attributes.
        const nodes = _empireLayer.selectAll('.empire-node')
            .data(empires, d => d.id)
            .join(enter => {
                const g = enter.append('g')
                    .attr('class', 'empire-node')
                    .attr('role', 'button')
                    .attr('tabindex', 0)
                    .style('cursor', 'pointer');

                // Invisible hitbox (larger than visual dot for easy clicking)
                g.append('circle').attr('r', ICON_R + 10).attr('fill', 'transparent');

                // Color halo
                g.append('circle').attr('class', 'empire-halo')
                    .attr('r', ICON_R + 2).attr('opacity', 0.12).attr('pointer-events', 'none');

                // Pulse ring (SVG animate — begin/end triggered on selection)
                g.append('circle').attr('class', 'empire-pulse')
                    .attr('r', ICON_R).attr('fill', 'none').attr('stroke-width', 2)
                    .attr('opacity', 0).attr('pointer-events', 'none')
                    .each(function () {
                        const animR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
                        animR.setAttribute('attributeName', 'r');
                        animR.setAttribute('values', ICON_R + ';' + (ICON_R + 8) + ';' + ICON_R);
                        animR.setAttribute('dur', '1.6s');
                        animR.setAttribute('begin', 'indefinite');
                        animR.setAttribute('repeatCount', 'indefinite');
                        const animO = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
                        animO.setAttribute('attributeName', 'opacity');
                        animO.setAttribute('values', '0.8;0;0.8');
                        animO.setAttribute('dur', '1.6s');
                        animO.setAttribute('begin', 'indefinite');
                        animO.setAttribute('repeatCount', 'indefinite');
                        this.appendChild(animR);
                        this.appendChild(animO);
                        this._animR = animR;
                        this._animO = animO;
                    });

                // Filled dot
                g.append('circle').attr('class', 'empire-ring empire-dot')
                    .attr('r', ICON_R).attr('opacity', 0.5).attr('pointer-events', 'none');

                // Stroke ring
                g.append('circle').attr('class', 'empire-ring empire-stroke')
                    .attr('r', ICON_R).attr('fill', 'none').attr('stroke-width', 1.5)
                    .attr('pointer-events', 'none');

                // System name label
                g.append('text').attr('class', 'empire-label')
                    .attr('y', ICON_R + 8)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#99aacc')
                    .attr('font-size', 9)
                    .attr('font-family', 'inherit')
                    .attr('pointer-events', 'none');

                return g;
            });

        // Set per-empire color and label
        nodes.each(function (d) {
            const color = QUADRANT_COLORS[d.quadrant] || DEFAULT_COLOR;
            const g = d3.select(this);
            g.attr('aria-label', d.id);
            g.select('.empire-halo').attr('fill', color);
            g.select('.empire-pulse').attr('stroke', color);
            g.select('.empire-dot').attr('fill', color);
            g.select('.empire-stroke').attr('stroke', color);
            g.select('.empire-label').text(d.system_name || '');
        });

        // Position all nodes (counter-scale applied in zoom handler at current k=1)
        const inv = Math.pow(1, -0.65);
        nodes.each(function (d) {
            const [sx, sy] = _toSVG(d.x, d.y);
            d._sx = sx;
            d._sy = sy;
            d3.select(this).attr('transform',
                'translate(' + sx + ',' + sy + ') scale(' + inv + ')');
        });

        // Wire up interaction
        nodes
            .on('mouseenter', function (event, d) {
                const rect = _container.getBoundingClientRect();
                _showTooltip(event.clientX - rect.left, event.clientY - rect.top, d);
            })
            .on('mouseleave', _hideTooltip)
            .on('click', (event, d) => _selectEmpire(d.id))
            .on('keydown', (event, d) => {
                if (event.key === 'Enter' || event.key === ' ') _selectEmpire(d.id);
            });
    }

    // ── Tooltip ───────────────────────────────────────────────────────────────
    function _showTooltip(cx, cy, emp) {
        const color = QUADRANT_COLORS[emp.quadrant] || DEFAULT_COLOR;
        const displayName = emp.name || emp.id;
        _tooltip.innerHTML =
            '<div style="font-weight:bold;color:' + color + '">' + _esc(displayName) + '</div>' +
            (emp.system_name ? '<div style="color:#aaa;font-size:0.85em">' + _esc(emp.system_name) + '</div>' : '') +
            '<div style="color:#888;font-size:0.8em;margin-top:2px">' + _esc(emp.quadrant) + '</div>';
        _tooltip.classList.remove('hidden', 'visible');
        const tw = _tooltip.offsetWidth || 140, th = _tooltip.offsetHeight || 60;
        const cW = _container.clientWidth, cH = _container.clientHeight;
        let tx = cx + 18, ty = cy - th / 2;
        if (tx + tw > cW) tx = cx - tw - 14;
        if (ty < 4) ty = 4;
        if (ty + th > cH) ty = cH - th - 4;
        _tooltip.style.left = tx + 'px';
        _tooltip.style.top  = ty + 'px';
        void _tooltip.offsetWidth;
        _tooltip.classList.add('visible');
    }

    function _hideTooltip() {
        _tooltip.classList.add('hidden');
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    function _selectEmpire(id) {
        _selectedId = id;
        _updateSelection();
        const emp = _mapData.find(e => e.id === id);
        if (_onEmpireClick) _onEmpireClick(id);
        if (emp) _zoomTo(emp);
    }

    function _updateSelection() {
        _empireLayer.selectAll('.empire-node').each(function (d) {
            const sel = d.id === _selectedId;
            const g = d3.select(this);
            g.select('.empire-dot').attr('opacity', sel ? 0.9 : 0.5);
            g.select('.empire-stroke').attr('stroke-width', sel ? 3 : 1.5);
            const pulseNode = this.querySelector('.empire-pulse');
            if (pulseNode) {
                if (sel) {
                    pulseNode._animR && pulseNode._animR.beginElement();
                    pulseNode._animO && pulseNode._animO.beginElement();
                } else {
                    pulseNode._animR && pulseNode._animR.endElement();
                    pulseNode._animO && pulseNode._animO.endElement();
                    pulseNode.setAttribute('r', ICON_R);
                    pulseNode.setAttribute('opacity', 0);
                }
            }
        });
    }

    // ── Zoom / Pan (D3) ───────────────────────────────────────────────────────
    function _setupZoom() {
        _zoom = d3.zoom()
            .scaleExtent([0.4, 8])
            .on('zoom', function (event) {
                const t = event.transform;
                d3.select(_svg).select('#gmap-content')
                    .attr('transform', 'translate(' + t.x + ',' + t.y + ') scale(' + t.k + ')');
                // Counter-scale each node: net visual size = k^0.35 (gentle growth)
                const inv = Math.pow(t.k, -0.65);
                _empireLayer.selectAll('.empire-node').attr('transform', function (d) {
                    return 'translate(' + d._sx + ',' + d._sy + ') scale(' + inv + ')';
                });
            });

        d3.select(_svg).call(_zoom);
    }

    function _zoomTo(emp) {
        const [sx, sy] = _toSVG(emp.x, emp.y);
        const currentK = d3.zoomTransform(_svg).k;
        const targetK  = Math.max(currentK, 3);
        const tx = SVG_W / 2 - sx * targetK;
        const ty = SVG_H / 2 - sy * targetK;
        d3.select(_svg)
            .transition().duration(500).ease(d3.easeCubicOut)
            .call(_zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(targetK));
    }

    // ── Edge fade ─────────────────────────────────────────────────────────────
    // Full/mirror galaxy maps: strong spiral-galaxy vignette.
    // All other types (botf, alpha_beta, gamma, delta, …): no edge vignette —
    // these scenarios use structured grid placement and have many empires at
    // the coordinate bounds; the spiral fade would clip them into invisibility.
    function _applyEdgeFade() {
        if (!_hasQuadrantOverlay(_mapType)) return;
        const mask = 'radial-gradient(ellipse 90% 86% at 50% 50%, black 52%, transparent 86%)';
        _svg.style.maskImage        = mask;
        _svg.style.webkitMaskImage  = mask;
    }

    // ── Public: init ──────────────────────────────────────────────────────────
    function init(container, mapData, onEmpireClick, options) {
        _container     = container;
        _mapData       = (mapData.empires || []).filter(e => !e.id.endsWith('_B'));
        _bounds        = mapData.bounds;
        _onEmpireClick = onEmpireClick;
        _mapType       = (options && options.type) || 'full_galaxy';
        _selectedId    = null;

        // Detect whether the scenario file already negated x (pre-mirrored data).
        // Canonical Beta empire (KlingonEmpire / TNG equivalent) has x > 0 in pre-mirrored maps.
        const _klingon = _mapData.find(e => e.id === 'KlingonEmpire' || e.id === 'tngKlingonCardassianAlliance');
        _xPreMirrored  = _mapType.includes('mirror')
            ? (_klingon ? _klingon.x > 0 : true)
            : false;

        // D3 linear scales
        // X inverted: game +x (Alpha/Gamma) → SVG left. Mirror maps negate gx in _toSVG.
        _xScale = d3.scaleLinear()
            .domain([_bounds.x_max, _bounds.x_min])
            .range([PAD, SVG_W - PAD]);
        // Y natural: game +y (Alpha/Beta) maps to SVG bottom
        _yScale = d3.scaleLinear()
            .domain([_bounds.y_min, _bounds.y_max])
            .range([PAD, SVG_H - PAD]);

        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.background = _mapType.includes('mirror') ? '#0d0408' : '#060c18';

        const svgSel = d3.select(container).append('svg')
            .attr('viewBox', '0 0 ' + SVG_W + ' ' + SVG_H)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('overflow', 'hidden')
            .style('position', 'relative')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'block')
            .style('cursor', 'grab')
            .style('background', 'transparent')
            .style('z-index', 1);
        _svg = svgSel.node();

        // Transparent rect so D3 zoom captures wheel/drag on SVG background
        svgSel.append('rect').attr('width', SVG_W).attr('height', SVG_H).attr('fill', 'transparent');

        const defs = svgSel.append('defs');

        // Static star layer — sits outside the zoom group so stars don't pan
        _renderStars(svgSel);

        // Zoomable content group
        const content = svgSel.append('g').attr('id', 'gmap-content');
        _gridLayer   = content.append('g').attr('id', 'gmap-grid').attr('pointer-events', 'none');
        _quadLayer   = content.append('g').attr('id', 'gmap-quads').attr('pointer-events', 'none');
        _empireLayer = content.append('g').attr('id', 'gmap-empires');

        _renderGrid();
        _renderQuadrants(defs);
        _renderEmpires();

        // Tooltip
        _tooltip = document.createElement('div');
        _tooltip.className = 'galaxy-tooltip hidden';
        _tooltip.style.cssText = 'position:absolute;background:rgba(6,14,30,0.95);border:1px solid #334;border-radius:6px;padding:8px 12px;pointer-events:none;z-index:10;min-width:130px;font-size:0.85rem;line-height:1.4;box-shadow:0 2px 12px rgba(0,0,0,0.7)';
        container.appendChild(_tooltip);

        // Reset view button
        const ctrlBar = document.createElement('div');
        ctrlBar.style.cssText = 'position:absolute;top:8px;right:10px;z-index:5';
        _resetBtn = document.createElement('button');
        _resetBtn.textContent = I18n.ui('ui.galaxy.reset');
        _resetBtn.className   = 'tab-btn';
        _resetBtn.style.cssText = 'font-size:0.75rem;padding:3px 8px';
        _resetBtn.addEventListener('click', () => resetView(true));
        ctrlBar.appendChild(_resetBtn);
        container.appendChild(ctrlBar);

        _setupZoom();
        _applyEdgeFade();
        _renderOverlay(
            options && options.maps,
            options && options.mapId,
            options && options.onMapChange
        );
        resetView(false);
    }

    // ── Public: zoom controls ─────────────────────────────────────────────────
    function resetView(animated) {
        const sel = d3.select(_svg);
        if (animated) {
            sel.transition().duration(700).ease(d3.easeCubicOut)
                .call(_zoom.transform, d3.zoomIdentity);
        } else {
            sel.call(_zoom.transform, d3.zoomIdentity);
        }
    }

    function highlight(id) {
        const baseId = id.replace(/_B$/, '');
        _selectedId = baseId;
        _updateSelection();
        const emp = _mapData.find(e => e.id === baseId);
        if (emp) _zoomTo(emp);
    }

    function deselect() {
        _selectedId = null;
        _updateSelection();
    }

    function destroy() {
        if (_svg) d3.select(_svg).on('.zoom', null);
        if (_container) _container.innerHTML = '';
        _svg = _gridLayer = _quadLayer = _empireLayer = null;
        _tooltip = null; _overlayEl = _legendEl = _selectorEl = null;
        _container = null; _mapData = [];
        _zoom = null; _xScale = null; _yScale = null;
    }

    function _esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { init, highlight, deselect, setLegendVisible, refreshOverlay, resetView, destroy };
})();
