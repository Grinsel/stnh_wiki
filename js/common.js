/**
 * Common UI initialisation shared across all wiki pages.
 * Font size control, language select, navigation highlighting, faction theme.
 */
const Common = (() => {
    const THEMES = {
        lcars:      { label: 'ST:NH',        dot: '#1a1a30' },
        romulan:    { label: 'Romulan',      dot: '#2ea55a' },
        borg:       { label: 'Borg',         dot: '#00cc44' },
        cardassian: { label: 'Cardassian',   dot: '#c4956a' },
        klingon:    { label: 'Klingon',      dot: '#cc2233' },
        ferengi:    { label: 'Ferengi',      dot: '#d4a017' },
        light:      { label: 'Light',        dot: '#f4f6fa' },
    };

    function applyTheme(key) {
        document.documentElement.setAttribute('data-theme', key);
    }

    function initTheme() {
        const saved = localStorage.getItem('stnh-theme') || 'lcars';
        applyTheme(saved);
    }

    function injectThemePicker() {
        const controls = document.querySelector('.header-controls');
        if (!controls) return;

        const current = localStorage.getItem('stnh-theme') || 'lcars';
        const picker = document.createElement('div');
        picker.className = 'theme-picker';
        picker.title = 'Theme';

        for (const [key, t] of Object.entries(THEMES)) {
            const dot = document.createElement('button');
            dot.className = 'theme-dot' + (key === current ? ' active' : '');
            dot.style.background = t.dot;
            if (key === 'light') dot.style.border = '2px solid #aaa';
            if (key === 'lcars') dot.style.border = '2px solid #c9a227';
            dot.title = t.label;
            dot.setAttribute('aria-label', t.label + ' theme');
            dot.addEventListener('click', () => {
                localStorage.setItem('stnh-theme', key);
                applyTheme(key);
                picker.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            });
            picker.appendChild(dot);
        }

        controls.insertBefore(picker, controls.firstChild);
    }

    function initLangSelect() {
        const sel = document.getElementById('lang-select');
        if (!sel) return;
        sel.value = AppState.get('lang');
        sel.addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            const mod = I18n.getCurrentModule();
            if (mod) {
                await I18n.setLanguageForModule(e.target.value, mod);
                I18n.loadFullLocalisation();
            } else {
                await I18n.setLanguage(e.target.value);
            }
            applyUiStrings();
            document.dispatchEvent(new CustomEvent('wiki-lang-changed'));
        });
    }

    function initNav() {
        const navInner = document.querySelector('#wiki-nav .nav-inner');
        if (!navInner) return;
        navInner.innerHTML =
            '<a href="index.html" class="nav-link" data-i18n="ui.nav.hub">Hub</a>' +
            '<a href="events.html" class="nav-link" data-i18n="ui.nav.events">Events</a>' +
            '<a href="exploration.html" class="nav-link" data-i18n="ui.nav.exploration">Exploration</a>' +
            '<a href="tech-list.html" class="nav-link" data-i18n="ui.nav.tech">Technology</a>' +
            '<a href="empires.html" class="nav-link" data-i18n="ui.nav.empire">Empire</a>' +
            '<a href="governments.html" class="nav-link" data-i18n="ui.nav.governments">Governance</a>' +
            '<a href="economy.html" class="nav-link" data-i18n="ui.nav.economy">Economy</a>' +
            '<a href="ships.html" class="nav-link" data-i18n="ui.nav.military">Military</a>';
    }

    function initNavHighlight() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        // Pages that should highlight their hub nav link
        const HUB_MAP = {
            'anomalies.html': 'exploration.html',
            'tech-list.html': 'tech-list.html',
            'tech.html':      'tech-list.html',
            'empires.html':   'empires.html',
            'buildings.html': 'economy.html',
            'megastructures.html': 'economy.html',
            'traits.html':    'governments.html',
        };

        let hubTarget;
        if (currentPage === 'exploration.html') {
            hubTarget = 'exploration.html';
        } else {
            hubTarget = HUB_MAP[currentPage] || currentPage;
        }

        document.querySelectorAll('#wiki-nav .nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href === hubTarget) {
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
            const footer = document.getElementById('site-footer');
            document.documentElement.style.setProperty('--header-height', hh + 'px');
            if (nav) document.documentElement.style.setProperty('--nav-height', nh + 'px');
            if (footer) document.documentElement.style.setProperty('--footer-height', footer.offsetHeight + 'px');
            if (filterBar) {
                document.documentElement.style.setProperty('--filter-bar-top', (hh + nh) + 'px');
                document.documentElement.style.setProperty('--detail-top', (hh + nh + filterBar.offsetHeight) + 'px');
            }
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

        // Inject global-search toggle (pill switch + label) next to the input
        let globalMode = false;
        const uiStr = (k) => typeof I18n !== 'undefined' && I18n.ui ? I18n.ui(k) : k;

        const toggleWrap = document.createElement('div');
        toggleWrap.id = 'search-mode-toggle';
        toggleWrap.className = 'search-mode-toggle-wrap';
        toggleWrap.setAttribute('role', 'button');
        toggleWrap.setAttribute('tabindex', '0');
        toggleWrap.innerHTML =
            '<span class="toggle-track"></span>' +
            '<span class="toggle-label" data-i18n="ui.search.global_label">Global Search</span>';
        input.parentElement.appendChild(toggleWrap);

        // Remember the original local placeholder to restore it
        const localPlaceholderKey = input.getAttribute('data-i18n-placeholder');
        const localPlaceholder = input.placeholder;

        function updateToggle() {
            toggleWrap.classList.toggle('active', globalMode);
            toggleWrap.title = globalMode
                ? uiStr('ui.search.global_on')
                : uiStr('ui.search.global_off');
            toggleWrap.setAttribute('aria-pressed', globalMode ? 'true' : 'false');
            const lbl = toggleWrap.querySelector('.toggle-label');
            if (lbl) lbl.textContent = uiStr('ui.search.global_label') || 'Global Search';
            // Swap placeholder
            if (globalMode) {
                input.placeholder = uiStr('ui.search.global') || 'Search all wiki...';
            } else {
                input.placeholder = (localPlaceholderKey ? uiStr(localPlaceholderKey) : null) || localPlaceholder;
            }
        }
        updateToggle();

        function doToggle() {
            globalMode = !globalMode;
            updateToggle();
            if (!globalMode) {
                hideGlobalPreview();
            } else {
                const q = input.value.trim();
                if (q.length >= 2 && ready) renderGlobalPreview(q);
            }
        }

        toggleWrap.addEventListener('click', doToggle);
        toggleWrap.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doToggle(); }
        });

        let timer;

        input.addEventListener('input', (e) => {
            if (!globalMode) {
                hideGlobalPreview();
                return;
            }
            // Global mode: prevent page-level local filtering
            e.stopImmediatePropagation();
            if (!ready) return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                const q = input.value.trim();
                if (q.length < 2) { hideGlobalPreview(); return; }
                renderGlobalPreview(q);
            }, 150);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                hideGlobalPreview();
                // Clear namespace filter so local search covers all events
                if (typeof AppState !== 'undefined' && AppState.get('namespace')) {
                    AppState.setMultiple({ namespace: '', page: 1 });
                }
            } else if (e.key === 'Escape') {
                hideGlobalPreview();
            }
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !container.contains(e.target) && !toggleWrap.contains(e.target)) {
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

    function initScrollFades() {
        const SELECTORS = [
            '#namespace-sidebar',
            '#event-list-panel',
            '#item-list-panel',
        ];
        SELECTORS.forEach(sel => {
            const el = document.querySelector(sel);
            if (!el) return;
            el.classList.add('scroll-fade');
            function update() {
                el.classList.toggle('scroll-at-top',    el.scrollTop <= 1);
                el.classList.toggle('scroll-at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
            }
            el.addEventListener('scroll', update, { passive: true });
            if (window.ResizeObserver) new ResizeObserver(update).observe(el);
            update();
        });
    }

    function initMobileOverlay() {
        const MQ = window.matchMedia('(max-width: 921px)');
        const detailPanel = document.getElementById('event-detail-panel')
                         || document.getElementById('detail-panel');
        if (!detailPanel) return;

        let savedScrollY = 0;

        function lockScroll() {
            savedScrollY = window.scrollY;
            document.body.classList.add('overlay-open');
            document.body.style.top = `-${savedScrollY}px`;
        }

        function unlockScroll() {
            document.body.classList.remove('overlay-open');
            document.body.style.top = '';
            window.scrollTo(0, savedScrollY);
        }

        // MutationObserver: fängt jede .hidden-Änderung automatisch ab
        const observer = new MutationObserver(() => {
            if (detailPanel.classList.contains('hidden')) {
                if (document.body.classList.contains('overlay-open')) unlockScroll();
            } else if (MQ.matches) {
                lockScroll();
                detailPanel.scrollTop = 0;
                history.pushState({ overlayOpen: true }, '');
            }
        });
        observer.observe(detailPanel, { attributes: true, attributeFilter: ['class'] });

        // Back-Button schließt Overlay (klickt Close-Button für page-spezifisches Cleanup)
        window.addEventListener('popstate', () => {
            if (MQ.matches && !detailPanel.classList.contains('hidden')) {
                const closeBtn = detailPanel.querySelector('#detail-close');
                if (closeBtn) closeBtn.click();
            }
        });

        // Window-Resize: Scroll-Lock aufräumen falls von Mobile zu Desktop gewechselt
        MQ.addEventListener('change', (e) => {
            if (!e.matches && document.body.classList.contains('overlay-open')) {
                unlockScroll();
            }
        });
    }

    function initMobileFilterToggle() {
        const MQ = window.matchMedia('(max-width: 921px)');
        const filterInner = document.querySelector('#filter-bar .filter-inner');
        if (!filterInner) return;

        // Mark all children that are NOT tabs/stats as collapsible
        for (const child of filterInner.children) {
            if (!child.classList.contains('tab-buttons') &&
                !child.classList.contains('filter-stats')) {
                child.classList.add('filter-collapsible');
            }
        }

        // Create toggle button, insert after tab-buttons or at the start
        const btn = document.createElement('button');
        btn.className = 'filter-toggle-btn';
        btn.innerHTML = '<span class="toggle-arrow">▼</span> Filter';
        const tabs = filterInner.querySelector('.tab-buttons');
        if (tabs) {
            tabs.after(btn);
        } else {
            filterInner.prepend(btn);
        }

        btn.addEventListener('click', () => {
            filterInner.classList.toggle('filters-open');
            btn.classList.toggle('open');
        });

        // Desktop: clean up state
        MQ.addEventListener('change', (e) => {
            if (!e.matches) {
                filterInner.classList.remove('filters-open');
                btn.classList.remove('open');
            }
        });
    }

    function init() {
        initTheme();
        injectThemePicker();
        initLangSelect();
        initNav();
        initNavHighlight();
        initHamburger();
        initStickyNav();
        I18n.setLangSync(AppState.get('lang'));
        applyUiStrings();
        initGlobalSearch();
        initScrollFades();
        initMobileOverlay();
        initMobileFilterToggle();
    }

    return { init, applyUiStrings };
})();
