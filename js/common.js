/**
 * Common UI initialisation shared across all wiki pages.
 * Font size control, language select, navigation highlighting, faction theme.
 */
const Common = (() => {
    const THEMES = {
        cardassian: { label: 'Cardassian', accent: '#d1ce04', hover: '#b57d04', bright: '#fcf800' },
        federation: { label: 'Federation', accent: '#4a9eff', hover: '#2a7edf', bright: '#6ab4ff' },
        klingon:    { label: 'Klingon',    accent: '#cc2222', hover: '#aa1111', bright: '#ff4444' },
        romulan:    { label: 'Romulan',    accent: '#22aa44', hover: '#118833', bright: '#44cc66' },
        borg:       { label: 'Borg',       accent: '#00cc66', hover: '#009944', bright: '#33ff88' },
        dominion:   { label: 'Dominion',   accent: '#9944cc', hover: '#7733aa', bright: '#bb66ee' },
        ferengi:    { label: 'Ferengi',    accent: '#dd8822', hover: '#bb6611', bright: '#ffaa44' },
        bajoran:    { label: 'Bajoran',    accent: '#cc8844', hover: '#aa6622', bright: '#eebb77' },
        lcars:      { label: 'LCARS',      accent: '#ff9900', hover: '#dd7700', bright: '#ffbb33' },
    };

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function applyTheme(key) {
        const t = THEMES[key] || THEMES.cardassian;
        const s = document.documentElement.style;
        s.setProperty('--accent-gold', hexToRgba(t.accent, 0.69));
        s.setProperty('--accent-gold-solid', t.accent);
        s.setProperty('--accent-hover', t.hover);
        s.setProperty('--accent-bright', t.bright);
    }

    function initTheme() {
        const saved = localStorage.getItem('stnh_wiki_theme') || 'cardassian';
        applyTheme(saved);
    }

    function injectThemePicker() {
        const controls = document.querySelector('.header-controls');
        if (!controls) return;

        const current = localStorage.getItem('stnh_wiki_theme') || 'cardassian';
        const picker = document.createElement('div');
        picker.className = 'theme-picker';
        picker.title = 'Faction Theme';

        for (const [key, t] of Object.entries(THEMES)) {
            const dot = document.createElement('button');
            dot.className = 'theme-dot' + (key === current ? ' active' : '');
            dot.style.background = t.accent;
            dot.title = t.label;
            dot.setAttribute('aria-label', t.label + ' theme');
            dot.addEventListener('click', () => {
                localStorage.setItem('stnh_wiki_theme', key);
                applyTheme(key);
                picker.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            });
            picker.appendChild(dot);
        }

        controls.insertBefore(picker, controls.firstChild);
    }

    function initFontSize() {
        let fontSize = parseInt(localStorage.getItem('stnh_wiki_fontsize')) || 118;
        document.documentElement.style.setProperty('--base-font-size', fontSize + '%');

        function adjust(delta) {
            fontSize = Math.min(160, Math.max(90, fontSize + delta));
            document.documentElement.style.setProperty('--base-font-size', fontSize + '%');
            localStorage.setItem('stnh_wiki_fontsize', fontSize);
        }

        const btnDown = document.getElementById('font-size-down');
        const btnUp = document.getElementById('font-size-up');
        if (btnDown) btnDown.addEventListener('click', () => adjust(-10));
        if (btnUp) btnUp.addEventListener('click', () => adjust(10));
    }

    function initLangSelect() {
        const sel = document.getElementById('lang-select');
        if (!sel) return;
        sel.value = AppState.get('lang');
        sel.addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            applyUiStrings();
            document.dispatchEvent(new CustomEvent('wiki-lang-changed'));
        });
    }

    function initNavHighlight() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('#wiki-nav .nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
                link.classList.add('active');
            }
        });
    }

    function initHamburger() {
        const nav = document.getElementById('wiki-nav');
        if (!nav) return;
        const navInner = nav.querySelector('.nav-inner');
        if (!navInner) return;

        const btn = document.createElement('button');
        btn.className = 'hamburger-btn';
        btn.setAttribute('aria-label', 'Toggle navigation');
        btn.innerHTML = '<span class="hamburger-bar"></span><span class="hamburger-bar"></span><span class="hamburger-bar"></span>';
        nav.insertBefore(btn, navInner);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = navInner.classList.toggle('nav-open');
            btn.classList.toggle('active', open);
        });

        navInner.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-link')) {
                navInner.classList.remove('nav-open');
                btn.classList.remove('active');
            }
        });

        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target)) {
                navInner.classList.remove('nav-open');
                btn.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                navInner.classList.remove('nav-open');
                btn.classList.remove('active');
            }
        });
    }

    function initStickyNav() {
        const header = document.getElementById('masthead');
        const nav = document.getElementById('wiki-nav');
        const filterBar = document.getElementById('filter-bar');
        if (!header) return;
        const update = () => {
            const hh = header.offsetHeight;
            const nh = nav ? nav.offsetHeight : 0;
            document.documentElement.style.setProperty('--header-height', hh + 'px');
            if (nav) document.documentElement.style.setProperty('--nav-height', nh + 'px');
            if (filterBar) document.documentElement.style.setProperty('--filter-bar-top', (hh + nh) + 'px');
        };
        update();
        window.addEventListener('resize', update);
        // Re-measure after custom fonts load — they can change header/nav height
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(update);
        }
    }

    function applyUiStrings() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = I18n.ui(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = I18n.ui(el.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = I18n.ui(el.dataset.i18nTitle);
        });
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function initGlobalSearch() {
        if (typeof GlobalSearch === 'undefined') return;
        // Hub page handles GlobalSearch via hub.js — skip to avoid duplicate listeners
        if (document.getElementById('hub-content')) return;

        const input = document.getElementById('search-input');
        if (!input) return;

        let container = document.getElementById('global-search-results');
        if (!container) return;

        let ready = false;
        GlobalSearch.init().then(ok => {
            ready = ok;
            if (ok && typeof GlobalSearch.setLocReady === 'function') {
                GlobalSearch.setLocReady(true);
            }
        });

        let timer;

        input.addEventListener('input', () => {
            if (!ready) return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                const q = input.value.trim();
                if (q.length < 2) { hideGlobalPreview(); return; }
                renderGlobalPreview(q);
            }, 150);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideGlobalPreview();
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !container.contains(e.target)) {
                hideGlobalPreview();
            }
        });

        function hideGlobalPreview() {
            container.classList.add('hidden');
            container.innerHTML = '';
        }

        function renderGlobalPreview(query) {
            const results = GlobalSearch.searchPreview(query, 3);
            if (!results.length) {
                container.innerHTML = '<div class="search-results-inner"><div class="search-no-results">' + (typeof I18n !== 'undefined' ? I18n.ui('ui.empty.no_results') : 'No results found') + '</div></div>';
                container.classList.remove('hidden');
                return;
            }

            const grouped = {};
            for (const r of results) {
                const key = r.label;
                if (!grouped[key]) grouped[key] = { items: [], total: 0 };
                grouped[key].items.push(r);
                grouped[key].total = r._totalForType || grouped[key].items.length;
            }

            const uiStr = (k) => typeof I18n !== 'undefined' && I18n.ui ? I18n.ui(k) : k;
            const totalMatches = Object.values(grouped).reduce((s, g) => s + g.total, 0);

            let html = '<div class="search-results-inner">';
            html += '<div class="search-results-header">' + uiStr('ui.search.global_results') + ' &mdash; ' + totalMatches + ' ' + (totalMatches !== 1 ? uiStr('ui.search.matches_plural') : uiStr('ui.search.matches')) + '</div>';

            for (const [typeName, group] of Object.entries(grouped)) {
                html += '<div class="search-group">';
                html += '<div class="search-group-title">' + esc(typeName) + ' (' + group.total + ')</div>';
                for (const item of group.items) {
                    const url = GlobalSearch.getItemUrl(item);
                    const name = item.name || item.id;
                    html += '<a href="' + esc(url) + '" class="search-result-item">';
                    html += '<span class="search-result-name">' + esc(name) + '</span>';
                    html += '<span class="search-result-id">' + esc(item.id) + '</span>';
                    html += '</a>';
                }
                html += '</div>';
            }

            html += '</div>';
            container.innerHTML = html;
            container.classList.remove('hidden');
        }
    }

    function init() {
        initTheme();
        injectThemePicker();
        initFontSize();
        initLangSelect();
        initNavHighlight();
        initHamburger();
        initStickyNav();
        applyUiStrings();
        initGlobalSearch();
    }

    return { init, applyUiStrings };
})();
