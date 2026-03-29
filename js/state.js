/**
 * State management via URL parameters and localStorage.
 */
const AppState = (() => {
    const defaults = {
        search: '',
        page: 1,
        lang: 'english',
        type: '',
        faction: '',
        category: '',
        namespace: '',
        showHidden: false,
        triggeredOnly: false,
        selectedEvent: '',
        sort: '',
    };

    let state = { ...defaults };
    let listeners = [];

    function init() {
        // Read from URL params
        const params = new URLSearchParams(window.location.search);
        for (const [key, val] of params) {
            if (key in defaults) {
                if (typeof defaults[key] === 'boolean') {
                    state[key] = val === 'true' || val === '1';
                } else if (typeof defaults[key] === 'number') {
                    state[key] = parseInt(val, 10) || defaults[key];
                } else {
                    state[key] = val;
                }
            }
        }

        // Read lang from localStorage
        const savedLang = localStorage.getItem('stnh_wiki_lang');
        if (savedLang && !params.has('lang')) {
            state.lang = savedLang;
        }
    }

    function get(key) { return state[key]; }

    function set(key, value) {
        if (state[key] === value) return;
        state[key] = value;
        if (key === 'lang') {
            localStorage.setItem('stnh_wiki_lang', value);
        }
        updateUrl();
        notify();
    }

    function setMultiple(updates) {
        let changed = false;
        for (const [key, value] of Object.entries(updates)) {
            if (state[key] !== value) {
                state[key] = value;
                changed = true;
                if (key === 'lang') {
                    localStorage.setItem('stnh_wiki_lang', value);
                }
            }
        }
        if (changed) {
            updateUrl();
            notify();
        }
    }

    function updateUrl() {
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(state)) {
            if (val !== defaults[key] && val !== '' && val !== false && val !== 0) {
                params.set(key, val);
            }
        }
        const qs = params.toString();
        const url = window.location.pathname + (qs ? `?${qs}` : '');
        window.history.replaceState(null, '', url);
    }

    function onChange(fn) { listeners.push(fn); }
    function notify() { listeners.forEach(fn => fn(state)); }
    function getState() { return { ...state }; }

    return { init, get, set, setMultiple, onChange, getState };
})();
