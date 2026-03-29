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

    function initStickyNav() {
        const header = document.getElementById('masthead');
        if (!header) return;
        const update = () => {
            document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
        };
        update();
        window.addEventListener('resize', update);
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

    function init() {
        initTheme();
        injectThemePicker();
        initFontSize();
        initLangSelect();
        initNavHighlight();
        initStickyNav();
        applyUiStrings();
    }

    return { init, applyUiStrings };
})();
