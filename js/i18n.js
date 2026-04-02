/**
 * Internationalisation / language switching module.
 */
const I18n = (() => {
    let currentLang = 'english';
    let locData = {};
    let fallbackData = {};

    async function setLanguage(lang) {
        currentLang = lang;
        if (!fallbackData || Object.keys(fallbackData).length === 0) {
            fallbackData = await DataManager.loadLocalisation('english');
        }
        if (lang === 'english') {
            locData = fallbackData;
        } else {
            locData = await DataManager.loadLocalisation(lang);
        }
        return locData;
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

    return { setLanguage, t, ui, getLang, getData };
})();
