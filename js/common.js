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
            // tech.html should highlight the tech-list.html nav link
            if (currentPage === 'tech.html' && href === 'tech-list.html') {
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
        initScrollFades();
        initMobileOverlay();
    }

    return { init, applyUiStrings };
})();
