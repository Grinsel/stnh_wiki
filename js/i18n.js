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
        // Strip Stellaris in-game icon placeholders (£) and collapse extra whitespace
        return raw.replace(/£/g, '').replace(/\s+/g, ' ').trim();
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

    return {
        setLanguage, setLanguageForModule, loadFullLocalisation,
        t, ui, getLang, getData, isFullLoaded, getCurrentModule
    };
})();
