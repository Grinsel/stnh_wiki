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
        return locData[key] || fallbackData[key] || key;
    }

    function getLang() { return currentLang; }
    function getData() { return locData; }

    return { setLanguage, t, getLang, getData };
})();
