/**
 * Internationalisation / language switching module.
 */
const I18n = (() => {
    let currentLang = 'english';
    let locData = {};
    let fallbackData = {};
    let fullLocLoaded = false;
    let _currentModule = null;

    const LANG_SHORT = {
        english: 'en', german: 'de', french: 'fr', spanish: 'es',
        russian: 'ru', polish: 'pl', braz_por: 'pt'
    };

    async function setLanguage(lang) {
        currentLang = lang;
        fullLocLoaded = false;
        _currentModule = null;
        if (!fallbackData || Object.keys(fallbackData).length === 0) {
            fallbackData = await DataManager.loadLocalisation('english');
        }
        if (lang === 'english') {
            locData = fallbackData;
        } else {
            locData = await DataManager.loadLocalisation(lang);
        }
        fullLocLoaded = true;
        return locData;
    }

    async function setLanguageForModule(lang, module) {
        currentLang = lang;
        fullLocLoaded = false;
        _currentModule = module;
        const ls = LANG_SHORT[lang] || 'en';
        const [common, modLoc] = await Promise.all([
            DataManager.loadJSON(`assets/localisation/${ls}/common.json`),
            DataManager.loadJSON(`assets/localisation/${ls}/${module}.json`),
        ]);
        locData = Object.assign({}, common, modLoc);

        if (lang !== 'english') {
            const [enC, enM] = await Promise.all([
                DataManager.loadJSON('assets/localisation/en/common.json'),
                DataManager.loadJSON(`assets/localisation/en/${module}.json`),
            ]);
            fallbackData = Object.assign({}, enC, enM);
        } else {
            fallbackData = locData;
        }
    }

    /** Merge additional module keys into the current locData without replacing it. */
    async function mergeModule(lang, module) {
        const ls = LANG_SHORT[lang] || 'en';
        const modLoc = await DataManager.loadJSON(`assets/localisation/${ls}/${module}.json`);
        Object.assign(locData, modLoc);
        if (lang !== 'english') {
            const enMod = await DataManager.loadJSON(`assets/localisation/en/${module}.json`);
            Object.assign(fallbackData, enMod);
        }
    }

    async function loadFullLocalisation() {
        if (fullLocLoaded) return;
        const full = await DataManager.loadLocalisation(currentLang);
        Object.assign(locData, full);
        if (currentLang !== 'english') {
            const fullEn = await DataManager.loadLocalisation('english');
            Object.assign(fallbackData, fullEn);
        }
        fullLocLoaded = true;
    }

    function t(key) {
        if (!key) return '';
        const raw = locData[key] || fallbackData[key] || key;
        if (typeof raw !== 'string') return String(raw);
        // Strip Stellaris in-game icon placeholders (£) and collapse extra whitespace
        return raw.replace(/£/g, '').replace(/\s+/g, ' ').trim();
    }

    /** Like t() but preserves line breaks — returns sanitised text with \n intact. */
    function tMultiline(key) {
        if (!key) return '';
        const raw = locData[key] || fallbackData[key] || '';
        if (!raw || raw === key) return '';
        const s = typeof raw !== 'string' ? String(raw) : raw;
        return s.replace(/£/g, '').replace(/[^\S\n]+/g, ' ').trim();
    }

    function ui(key) {
        if (!key) return '';
        const entry = typeof UI_STRINGS !== 'undefined' ? UI_STRINGS[key] : null;
        if (!entry) return key;
        return entry[currentLang] || entry['english'] || key;
    }

    function getLang() { return currentLang; }
    function getData() { return locData; }
    function isFullLoaded() { return fullLocLoaded; }
    function getCurrentModule() { return _currentModule; }
    function setLangSync(lang) { if (lang) currentLang = lang; }

    return {
        setLanguage, setLanguageForModule, mergeModule, loadFullLocalisation,
        t, tMultiline, ui, getLang, getData, isFullLoaded, getCurrentModule, setLangSync
    };
})();
