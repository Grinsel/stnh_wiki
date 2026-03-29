/**
 * Common UI initialisation shared across all wiki pages.
 * Font size control, language select, navigation highlighting.
 */
const Common = (() => {
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
        sel.addEventListener('change', (e) => {
            AppState.set('lang', e.target.value);
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

    function init() {
        initFontSize();
        initLangSelect();
        initNavHighlight();
    }

    return { init };
})();
