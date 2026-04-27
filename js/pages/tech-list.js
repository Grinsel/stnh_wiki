/**
 * Tech List page controller.
 * Browsable, searchable list view for technologies (IIFE pattern like buildings.js).
 */
(async function initTechList() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading technologies...</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search') || '';

    // --- Area colors ---
    const AREA_COLORS = { physics: '#2a7fff', society: '#36d673', engineering: '#ffb400' };

    // --- graphicalCultureToFaction mapping (replicated from js/tech/factions.js) ---
    const graphicalCultureToFaction = {
        'federation': 'federation', 'fed_01': 'federation', 'fed_02': 'federation',
        'klingon': 'klingon', 'kdf_01': 'klingon',
        'romulan': 'romulan', 'rom_01': 'romulan',
        'cardassian': 'cardassian', 'cardassian_01': 'cardassian',
        'dominion': 'dominion', 'dom_01': 'dominion',
        'borg': 'borg', 'borg_01': 'borg',
        'ferengi': 'ferengi', 'ferengi_01': 'ferengi',
        'breen': 'breen', 'breen_01': 'breen',
        'undine': 'undine', 'undine_01': 'undine',
        'xindi': 'xindi', 'xindi_01': 'xindi',
        'voth': 'voth', 'voth_01': 'voth',
        'hirogen': 'hirogen', 'hirogen_01': 'hirogen',
        'kazon': 'kazon', 'kazon_01': 'kazon',
        'krenim': 'krenim', 'krenim_01': 'krenim',
        'vidiian': 'vidiian', 'vidiian_01': 'vidiian',
        'suliban': 'suliban', 'suliban_01': 'suliban',
        'sona': 'sona', 'sona_01': 'sona',
        'talshiar': 'romulan',
        'tholian': 'tholian', 'tholian_01': 'tholian',
        'terran': 'terran', 'terran_01': 'terran',
    };

    // --- Unlock type icon mapping (replicated from js/tech/render.js) ---
    const UNLOCK_ICON_MAP = {
        'Building': 'unlock_building', 'Ship Type': 'unlock_ship',
        'Ship Section': 'unlock_ship_section', 'Tradition': 'unlock_tradition',
        'Trait': 'unlock_trait', 'Ascension Perk': 'unlock_ascension_perk',
        'Special Project': 'unlock_special_project', 'Megastructure': 'unlock_megastructure',
        'District': 'unlock_district', 'Edict': 'unlock_edict',
        'Decision': 'unlock_decision', 'Policy': 'unlock_policy',
        'Strategic Resource': 'unlock_strategic_resource', 'Job': 'unlock_job',
        'Army Type': 'unlock_army', 'Technology': 'unlock_technology',
        'Component': 'unlock_component', 'Starbase Building': 'unlock_starbase',
        'Starbase Module': 'unlock_starbase_module', 'Anomaly': 'unlock_anomaly',
        'Bypass': 'unlock_bypass', 'Faction Type': 'unlock_faction',
        'Country Limit': 'unlock_country_limit', 'Deposit': 'unlock_deposit', 'Other': 'unlock_other',
    };
    const UNLOCK_TYPE_TO_MODULE = {
        'Building': 'buildings', 'Ship Type': 'ships', 'Component': 'components',
        'Megastructure': 'megastructures', 'District': 'districts', 'Trait': 'traits', 'Edict': 'edicts',
    };

    try {
        const [physics, engineering, society, categories, empires, factions, techItemMapRaw] = await Promise.all([
            DataManager.loadJSON('assets/tech/technology_physics.json'),
            DataManager.loadJSON('assets/tech/technology_engineering.json'),
            DataManager.loadJSON('assets/tech/technology_society.json'),
            DataManager.loadJSON('assets/tech/categories.json'),
            DataManager.loadJSON('assets/tech/empires.json'),
            DataManager.loadJSON('assets/tech/factions.json'),
            DataManager.loadJSON('assets/tech_item_map.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'tech');

        const allTechs = [].concat(physics, engineering, society);
        const techIndex = new Map(allTechs.map(t => [t.id, t]));
        const techItemMap = techItemMapRaw && techItemMapRaw.by_tech ? techItemMapRaw.by_tech : {};

        // Build reverse prerequisite map: techId -> array of techs that require it
        const requiredByMap = new Map();
        for (const t of allTechs) {
            if (t.prerequisites) {
                for (const pid of t.prerequisites) {
                    if (!requiredByMap.has(pid)) requiredByMap.set(pid, []);
                    requiredByMap.get(pid).push(t);
                }
            }
        }

        // Resolve localised names
        for (const t of allTechs) {
            t._name = I18n.t(t.id) || t.name || t.id;
        }

        // --- Area Chips ---
        const areaCategories = [
            { value: 'physics', label: I18n.ui('ui.filter.physics'), count: physics.length },
            { value: 'engineering', label: I18n.ui('ui.filter.engineering'), count: engineering.length },
            { value: 'society', label: I18n.ui('ui.filter.society'), count: society.length },
        ];
        const areaChips = CategoryChips.create({
            container: document.getElementById('filter-area-chips'),
            categories: areaCategories,
            allLabel: I18n.ui('ui.filter.all_areas'),
            onChange: () => { currentPage = 1; renderAll(); },
        });

        // --- Category dropdown ---
        const catSelect = document.getElementById('filter-category');
        categories.sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            catSelect.appendChild(opt);
        });
        catSelect.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // --- Tier selects ---
        const tierStart = document.getElementById('filter-tier-start');
        const tierEnd = document.getElementById('filter-tier-end');

        function syncTierFilter() {
            let s = parseInt(tierStart.value, 10);
            let e = parseInt(tierEnd.value, 10);
            if (s > e) {
                if (document.activeElement === tierStart) { tierStart.value = e; s = e; }
                else { tierEnd.value = s; e = s; }
            }
            const display = document.getElementById('tier-filter-display');
            if (display) display.textContent = `${s}\u2013${e}`;
            const fill = document.getElementById('tier-filter-fill');
            if (fill) {
                const pct = v => (v / 11) * 100;
                fill.style.marginLeft = pct(s) + '%';
                fill.style.width = (pct(e) - pct(s)) + '%';
            }
            currentPage = 1;
            renderAll();
        }
        tierStart.addEventListener('input', syncTierFilter);
        tierEnd.addEventListener('input', syncTierFilter);
        // Init fill
        (() => {
            const fill = document.getElementById('tier-filter-fill');
            if (fill) { fill.style.marginLeft = '0%'; fill.style.width = '100%'; }
        })();

        // --- Empire Autocomplete (combobox) ---
        let selectedEmpire = null;
        let selectedFaction = null;
        let highlightedIndex = -1;
        const empireInput = document.getElementById('empire-search');
        const empireDropdown = document.getElementById('empire-dropdown');

        function getEmpireMatches(q) {
            if (!q) return empires;
            const lq = q.toLowerCase();
            return empires.filter(e => e.name.toLowerCase().includes(lq) || e.id.toLowerCase().includes(lq));
        }

        function renderEmpireDropdown(matches) {
            highlightedIndex = -1;
            if (!matches.length) {
                empireDropdown.innerHTML = `<div class="autocomplete-item" style="font-style:italic;opacity:0.6">No matches</div>`;
            } else {
                empireDropdown.innerHTML = matches.map((e, i) =>
                    `<div class="autocomplete-item${selectedEmpire && selectedEmpire.id === e.id ? ' autocomplete-selected' : ''}" data-id="${esc(e.id)}" role="option"><span class="empire-name">${esc(e.name)}</span>${e.has_unique_ships ? '<span class="ships-icon" title="Unique ships">&#9733;</span>' : ''}</div>`
                ).join('');
                empireDropdown.querySelectorAll('.autocomplete-item[data-id]').forEach(el => {
                    el.addEventListener('mousedown', (ev) => {
                        ev.preventDefault();
                        const emp = empires.find(e => e.id === el.dataset.id);
                        if (emp) selectEmpire(emp);
                    });
                });
            }
            empireDropdown.classList.remove('hidden');
            empireInput.setAttribute('aria-expanded', 'true');
        }

        function closeEmpireDropdown() {
            empireDropdown.classList.add('hidden');
            empireInput.setAttribute('aria-expanded', 'false');
            highlightedIndex = -1;
            // If text doesn't match current selection, clear
            if (selectedEmpire && empireInput.value.trim() !== selectedEmpire.name) {
                clearEmpire();
            } else if (!empireInput.value.trim() && selectedEmpire) {
                clearEmpire();
            }
        }

        function clearEmpire() {
            selectedEmpire = null;
            selectedFaction = null;
            empireInput.value = '';
            currentPage = 1;
            renderAll();
        }

        function selectEmpire(emp) {
            selectedEmpire = emp;
            const gc = emp.graphical_culture || '';
            selectedFaction = graphicalCultureToFaction[gc] || gc || null;
            empireInput.value = emp.name;
            empireDropdown.classList.add('hidden');
            empireInput.setAttribute('aria-expanded', 'false');
            highlightedIndex = -1;
            currentPage = 1;
            renderAll();
        }

        empireInput.addEventListener('focus', () => {
            renderEmpireDropdown(getEmpireMatches(empireInput.value.trim()));
        });

        empireInput.addEventListener('input', () => {
            renderEmpireDropdown(getEmpireMatches(empireInput.value.trim()));
            // If user clears input, clear selection live
            if (!empireInput.value.trim() && selectedEmpire) {
                selectedEmpire = null;
                selectedFaction = null;
                currentPage = 1;
                renderAll();
            }
        });

        empireInput.addEventListener('keydown', (e) => {
            const items = empireDropdown.querySelectorAll('.autocomplete-item[data-id]');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
                items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
                items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = highlightedIndex >= 0 ? items[highlightedIndex] : items[0];
                if (target) {
                    const emp = empires.find(em => em.id === target.dataset.id);
                    if (emp) selectEmpire(emp);
                }
            } else if (e.key === 'Escape') {
                empireInput.blur();
            }
        });

        empireInput.addEventListener('blur', () => {
            // Small delay so mousedown on item fires first
            setTimeout(closeEmpireDropdown, 150);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.empire-autocomplete')) {
                empireDropdown.classList.add('hidden');
                empireInput.setAttribute('aria-expanded', 'false');
            }
        });

        // --- State ---
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        let currentDetailItem = null;
        document.getElementById('detail-close').addEventListener('click', () => {
            currentDetailItem = null;
            detailPanel.classList.add('hidden');
        });

        // --- Search ---
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                currentPage = 1;
                renderAll();
            }, 200);
        });

        // --- Language change ---
        document.addEventListener('wiki-lang-changed', () => {
            for (const t of allTechs) t._name = I18n.t(t.id) || t.name || t.id;
            areaChips.rebuildAll([
                { value: 'physics', label: I18n.ui('ui.filter.physics'), count: physics.length },
                { value: 'engineering', label: I18n.ui('ui.filter.engineering'), count: engineering.length },
                { value: 'society', label: I18n.ui('ui.filter.society'), count: society.length },
            ], I18n.ui('ui.filter.all_areas'));
            renderAll();
            if (currentDetailItem) showDetail(currentDetailItem);
        });

        // --- Faction filter (replicated from js/tech/data.js) ---
        function filterTechsByFaction(techs, factionId) {
            if (!factionId || factionId === 'all') return techs;
            return techs.filter(tech => {
                const av = tech.faction_availability;
                if (!av || Object.keys(av).length === 0) {
                    const rs = tech.required_species || [];
                    if (rs.length === 0) return true;
                    const speciesMap = {
                        'Federation':'federation','Klingon':'klingon','Romulan':'romulan',
                        'Cardassian':'cardassian','Dominion':'dominion','Borg':'borg',
                        'Undine':'undine','Breen':'breen','Ferengi':'ferengi',
                        "Son'a":'sona','Hirogen':'hirogen','Voth':'voth',
                        'Krenim':'krenim','Vidiian':'vidiian','Suliban':'suliban',
                    };
                    return rs.some(species => {
                        const mapped = speciesMap[species];
                        return mapped && mapped.toLowerCase() === factionId.toLowerCase();
                    });
                }
                const factionKey = Object.keys(av).find(k => k.toLowerCase() === factionId.toLowerCase());
                if (!factionKey) return false;
                return av[factionKey]?.available === true;
            });
        }

        // --- Effect categorization (replicated from js/tech/render.js) ---
        function determineEffectCategory(key) {
            const k = key.toLowerCase();
            if (k.includes('weapon') || k.includes('damage') || k.includes('armor') || k.includes('hull') ||
                k.includes('shield') || k.includes('fire') || k.includes('evasion') || k.includes('accuracy')) return 'Combat';
            if (k.includes('resource') || k.includes('mineral') || k.includes('energy') || k.includes('alloy') ||
                k.includes('cost') || k.includes('upkeep') || k.includes('trade')) return 'Economy';
            if (k.includes('research') || k.includes('physics') || k.includes('society') || k.includes('engineering') ||
                k.includes('tech') || k.includes('science')) return 'Science';
            if (k.includes('ship') || k.includes('fleet') || k.includes('naval') || k.includes('starbase') ||
                k.includes('speed') || k.includes('emergency_ftl')) return 'Ships';
            if (k.includes('pop') || k.includes('growth') || k.includes('happiness') || k.includes('amenities') ||
                k.includes('stability')) return 'Population';
            return 'Other';
        }

        const EFFECT_ICONS = { 'Combat':'⚔️','Economy':'💰','Science':'🔬','Ships':'🚀','Population':'👥','Other':'⚙️' };

        // --- Tech-tree i18n helpers (mirror of js/tech/data.js) ---
        // Note: I18n is declared as `const` at script scope in js/i18n.js, so
        // it is NOT available on `window` — reference it directly here.
        function _locOr(key, fallback) {
            if (typeof I18n === 'undefined' || typeof I18n.t !== 'function') return fallback;
            const r = I18n.t(key);
            return (r && r !== key) ? r : fallback;
        }
        function getTechDescription(tech) {
            if (typeof I18n !== 'undefined' && typeof I18n.tMultiline === 'function') {
                const r = I18n.tMultiline(tech.id + '_desc');
                if (r) return r;
            }
            return tech.description || '';
        }
        function getCategoryLabel(slug) {
            return slug ? _locOr(slug, slug) : '';
        }
        function getAreaLabel(area) {
            if (!area) return '';
            // ui.filter.<area> already exists from the area-chip code
            const k = 'ui.filter.' + area;
            if (typeof I18n !== 'undefined' && typeof I18n.ui === 'function') {
                const r = I18n.ui(k);
                if (r && r !== k) return r;
            }
            return area.charAt(0).toUpperCase() + area.slice(1);
        }
        function formatEffectDisplay(effect) {
            if (!effect) return '';
            const key = effect.key;
            if (!key) return effect.display || '';
            const val = parseFloat(effect.value);
            if (isNaN(val)) return effect.display || '';
            let formatted;
            if (key.endsWith('_mult'))      formatted = `${val >= 0 ? '+' : ''}${(val * 100).toFixed(0)}%`;
            else if (key.endsWith('_add'))  formatted = `${val >= 0 ? '+' : ''}${val.toFixed(0)}`;
            else                            formatted = `${val >= 0 ? '+' : ''}${val.toFixed(2)}`;
            const name = _locOr('MOD_' + key.toUpperCase(), null);
            if (name) return `${formatted} ${name}`;
            return effect.display || `${formatted} ${key}`;
        }

        function formatEffectsGrouped(effects) {
            if (!effects || !effects.length) return '';
            const grouped = { 'Combat':[],'Economy':[],'Science':[],'Ships':[],'Population':[],'Other':[] };
            effects.forEach(e => grouped[determineEffectCategory(e.key)].push(e));
            let html = '<div class="effects-section"><strong>Effects:</strong>';
            for (const [cat, items] of Object.entries(grouped)) {
                if (!items.length) continue;
                html += `<div class="effect-category"><span class="effect-category-label">${cat}:</span>`;
                items.forEach(e => { html += `<div class="effect-item">${EFFECT_ICONS[cat] || '⚙️'} ${esc(formatEffectDisplay(e))}</div>`; });
                html += '</div>';
            }
            html += '</div>';
            return html;
        }

        // --- Unlocks formatting (replicated from js/tech/render.js) ---
        function formatUnlocksGrouped(unlocksByType, techId) {
            if (!unlocksByType || !Object.keys(unlocksByType).length) return '';
            const techUnlocks = techId ? (techItemMap[techId] || null) : null;
            const moduleItemMap = {};
            if (techUnlocks) {
                for (const [moduleKey, items] of Object.entries(techUnlocks)) {
                    moduleItemMap[moduleKey] = {};
                    for (const item of items) moduleItemMap[moduleKey][item.id] = item;
                }
            }
            let html = '<div class="unlocks-section"><strong>Unlocks:</strong>';
            const sortedTypes = Object.keys(unlocksByType).sort();
            for (const unlockType of sortedTypes) {
                const items = unlocksByType[unlockType];
                if (!items || !items.length) continue;
                const iconFile = UNLOCK_ICON_MAP[unlockType] || 'unlock_other';
                html += `<div class="unlock-category">`;
                html += `<span class="unlock-category-label"><img src="icons/unlock_types/${iconFile}.webp" class="unlock-type-img" alt="${esc(unlockType)}"> ${esc(unlockType)}:</span>`;
                const moduleKey = UNLOCK_TYPE_TO_MODULE[unlockType];
                const moduleItems = moduleKey && moduleItemMap[moduleKey] ? moduleItemMap[moduleKey] : null;
                items.forEach(displayName => {
                    let linked = false;
                    if (moduleItems) {
                        for (const [itemId, itemData] of Object.entries(moduleItems)) {
                            const itemName = itemData.nk || itemId;
                            if (displayName === itemName || displayName === itemId || displayName.toLowerCase() === itemName.toLowerCase()) {
                                const url = itemData.p + '?search=' + encodeURIComponent(itemId) + '&tab=' + encodeURIComponent(itemData.tab);
                                html += `<div class="unlock-item"><a href="${url}" class="wiki-link">${esc(displayName)}</a></div>`;
                                linked = true;
                                break;
                            }
                        }
                    }
                    if (!linked) html += `<div class="unlock-item">${esc(displayName)}</div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            return html;
        }

        // --- Show Detail ---
        function showDetail(tech) {
            currentDetailItem = tech;
            detailTitle.textContent = tech._name;
            const areaColor = AREA_COLORS[tech.area] || '#666';
            const iconHtml = tech.icon
                ? `<img class="detail-icon" src="icons/tech/${esc(tech.icon)}.webp" alt="" onerror="this.style.display='none'">`
                : '';

            // --- Header with icon and key badges ---
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item" style="color:${areaColor};font-weight:bold">${esc(getAreaLabel(tech.area))}</span>`;
            html += `<span class="detail-meta-item">${esc(I18n.ui('ui.tech.tier'))} ${tech.tier}</span>`;
            if (tech.is_rare) html += `<span class="detail-meta-item" style="color:#c792ea;font-weight:bold">${esc(I18n.ui('ui.tech.rare'))}</span>`;
            if (tech.is_dangerous) html += `<span class="detail-meta-item" style="color:#ff5370;font-weight:bold">${esc(I18n.ui('ui.tech.dangerous'))}</span>`;
            if (tech.is_reverse_engineerable) html += `<span class="detail-meta-item" style="color:#80cbc4">${esc(I18n.ui('ui.tech.reverse_engineerable'))}</span>`;
            html += '</div>';

            // --- View in Tree button ---
            html += `<a href="tech.html?focus=${encodeURIComponent(tech.id)}" class="view-in-tree-btn">${esc(I18n.ui('ui.tech.view_in_tree'))}</a>`;

            // --- Description ---
            const desc = getTechDescription(tech);
            if (desc && desc.trim()) {
                html += `<div style="margin:0.75rem 0;padding:8px;background:rgba(0,0,0,0.3);border-left:3px solid var(--accent-bright);font-style:italic;line-height:1.5">${esc(desc)}</div>`;
            }

            // --- Prerequisites ---
            if (tech.prerequisites && tech.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Prerequisites (${tech.prerequisites.length})</div><div class="detail-meta">`;
                tech.prerequisites.forEach(pid => {
                    const prereq = techIndex.get(pid);
                    const name = prereq ? prereq._name : (I18n.t(pid) || pid);
                    const pArea = prereq ? prereq.area : '';
                    const pColor = AREA_COLORS[pArea] || '';
                    const style = pColor ? ` style="border-color:${pColor}"` : '';
                    html += `<span class="tech-link internal-tech-link" data-tech-id="${esc(pid)}"${style}>${esc(name)}</span>`;
                });
                html += '</div></div>';
            } else {
                html += `<div class="detail-section"><div class="detail-section-title">Prerequisites</div>`;
                html += `<div class="detail-meta"><span class="detail-meta-item" style="color:#888">None (starting tech)</span></div></div>`;
            }

            // --- Leads To (reverse prerequisites) ---
            const leadsTo = requiredByMap.get(tech.id);
            if (leadsTo && leadsTo.length) {
                const sorted = leadsTo.slice().sort((a, b) => (a._name || a.id).localeCompare(b._name || b.id));
                html += `<div class="detail-section"><div class="detail-section-title">Leads To (${sorted.length})</div><div class="detail-meta">`;
                sorted.forEach(child => {
                    const cColor = AREA_COLORS[child.area] || '';
                    const style = cColor ? ` style="border-color:${cColor}"` : '';
                    html += `<span class="tech-link internal-tech-link" data-tech-id="${esc(child.id)}"${style}>${esc(child._name)}</span>`;
                });
                html += '</div></div>';
            } else {
                html += `<div class="detail-section"><div class="detail-section-title">Leads To</div>`;
                html += `<div class="detail-meta"><span class="detail-meta-item" style="color:#888">None (terminal tech)</span></div></div>`;
            }

            // --- Effects ---
            if (tech.effects && tech.effects.length) {
                html += formatEffectsGrouped(tech.effects);
            }

            // --- Unlocks ---
            if (tech.unlock_details && tech.unlock_details.unlocks_by_type) {
                html += formatUnlocksGrouped(tech.unlock_details.unlocks_by_type, tech.id);
            }

            // --- Species Access ---
            if (tech.required_species && tech.required_species.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Species Access</div>`;
                html += `<div class="detail-meta">${tech.required_species.map(s => `<span class="detail-meta-item">${esc(s)}</span>`).join('')}</div></div>`;
            } else {
                html += `<div class="detail-section"><div class="detail-section-title">Species Access</div>`;
                html += `<div class="detail-meta"><span class="detail-meta-item" style="color:#80cbc4">All Species</span></div></div>`;
            }

            // --- Faction Availability ---
            if (tech.faction_availability && Object.keys(tech.faction_availability).length) {
                html += `<div class="detail-section"><div class="detail-section-title">Faction Availability</div>`;
                html += `<table class="tech-props-table">`;
                for (const [faction, info] of Object.entries(tech.faction_availability)) {
                    const status = info.available ? '<span style="color:#36d673">Available</span>' : '<span style="color:#ff5370">Unavailable</span>';
                    const cond = info.condition ? ` <span style="color:#888;font-size:0.8rem">(${esc(info.condition)})</span>` : '';
                    html += `<tr><td>${esc(faction)}</td><td>${status}${cond}</td></tr>`;
                }
                html += `</table></div>`;
            }

            // --- Alternate Names (faction-specific names) ---
            if (tech.alternate_names && Object.keys(tech.alternate_names).length) {
                html += `<div class="detail-section"><div class="detail-section-title">Alternate Names</div>`;
                html += `<table class="tech-props-table">`;
                for (const [faction, altName] of Object.entries(tech.alternate_names)) {
                    html += `<tr><td>${esc(faction)}</td><td>${esc(altName)}</td></tr>`;
                }
                html += `</table></div>`;
            }

            // --- Properties table (reference data, at the bottom) ---
            html += `<div class="detail-section"><div class="detail-section-title">Properties</div>`;
            html += `<table class="tech-props-table">`;
            html += `<tr><td>ID</td><td><code>${esc(tech.id)}</code></td></tr>`;
            html += `<tr><td>${esc(I18n.ui('ui.tech.area'))}</td><td style="color:${areaColor}">${esc(getAreaLabel(tech.area))}</td></tr>`;
            html += `<tr><td>${esc(I18n.ui('ui.tech.tier'))}</td><td>${tech.tier}</td></tr>`;
            if (tech.category && tech.category.length) {
                html += `<tr><td>${esc(I18n.ui('ui.tech.category'))}</td><td>${esc(tech.category.map(getCategoryLabel).join(', '))}</td></tr>`;
            }
            html += `<tr><td>Cost</td><td>${tech.cost}</td></tr>`;
            html += `<tr><td>Weight</td><td>${tech.weight}</td></tr>`;
            html += `<tr><td>Rare</td><td>${tech.is_rare ? 'Yes' : 'No'}</td></tr>`;
            html += `<tr><td>Dangerous</td><td>${tech.is_dangerous ? 'Yes' : 'No'}</td></tr>`;
            html += `<tr><td>Reverse-Engineerable</td><td>${tech.is_reverse_engineerable ? 'Yes' : 'No'}</td></tr>`;
            if (tech.icon) {
                html += `<tr><td>Icon</td><td><code>${esc(tech.icon)}</code></td></tr>`;
            }
            html += `</table></div>`;

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            initInternalTechLinks(detailContent);
            detailPanel.classList.remove('hidden');
        }

        // --- Internal tech links ---
        function initInternalTechLinks(container) {
            container.querySelectorAll('.internal-tech-link').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tid = el.dataset.techId;
                    const tech = techIndex.get(tid);
                    if (tech) {
                        showDetail(tech);
                        // Scroll to item in list if visible
                        const card = listEl.querySelector(`.item-card[data-id="${CSS.escape(tid)}"]`);
                        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        // Fallback: navigate to tech.html
                        window.location.href = 'tech.html?focus=' + encodeURIComponent(tid);
                    }
                });
            });
        }

        // --- URL params ---
        const urlParams = new URLSearchParams(window.location.search);
        const focusId = urlParams.get('focus');
        const urlSearch = urlParams.get('search');
        if (urlSearch) {
            searchInput.value = urlSearch;
            AppState.set('search', urlSearch);
        }

        // --- Initial render ---
        renderAll();
        I18n.loadFullLocalisation();

        // Focus on a specific tech if requested via URL
        if (focusId) {
            const focusTech = techIndex.get(focusId);
            if (focusTech) showDetail(focusTech);
        }

        // --- Render ---
        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = allTechs;

            // Area filter
            const activeArea = areaChips.getActive();
            if (activeArea) items = items.filter(t => t.area === activeArea);

            // Category filter
            const catVal = catSelect.value;
            if (catVal) items = items.filter(t => t.category && t.category.includes(catVal));

            // Tier range
            const tStart = parseInt(tierStart.value, 10);
            const tEnd = parseInt(tierEnd.value, 10);
            if (tStart > 0) items = items.filter(t => (parseInt(t.tier) || 0) >= tStart);
            if (tEnd < 11) items = items.filter(t => (parseInt(t.tier) || 0) <= tEnd);

            // Empire / faction filter
            if (selectedFaction) items = filterTechsByFaction(items, selectedFaction);

            // Text search
            if (query) {
                items = items.filter(t =>
                    (t._name || '').toLowerCase().includes(query) ||
                    t.id.toLowerCase().includes(query)
                );
            }

            items.sort((a, b) => (a._name || a.id).localeCompare(b._name || b.id));

            // Stats
            document.getElementById('filter-stats').textContent = `${items.length} / ${allTechs.length} Technologies`;

            // Pagination
            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            // Render cards
            let html = '';
            for (const tech of pageItems) {
                const iconCol = tech.icon
                    ? `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/tech/${esc(tech.icon)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`
                    : '';
                const areaColor = AREA_COLORS[tech.area] || '#666';
                html += `<div class="item-card" data-id="${esc(tech.id)}">
                    ${iconCol}
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(tech._name)}</span>
                            <span class="item-card-id">${esc(tech.id)}</span>
                        </div>
                        <div class="item-card-meta">
                            <span class="detail-meta-item" style="color:${areaColor}">${esc(getAreaLabel(tech.area))}</span>
                            <span class="detail-meta-item">T${tech.tier}</span>`;
                if (tech.category && tech.category.length) {
                    html += `<span class="detail-meta-item">${esc(getCategoryLabel(tech.category[0]))}</span>`;
                }
                if (tech.is_rare) html += `<span class="detail-meta-item" style="color:#c792ea">${esc(I18n.ui('ui.tech.rare'))}</span>`;
                if (tech.is_dangerous) html += `<span class="detail-meta-item" style="color:#ff5370">${esc(I18n.ui('ui.tech.dangerous'))}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">No technologies match the current filters.</div>';

            // Click handlers
            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const tech = techIndex.get(card.dataset.id);
                    if (tech) showDetail(tech);
                });
            });

            renderPagination(totalPages);
        }

        function renderPagination(totalPages) {
            const pagEl = document.getElementById('pagination');
            if (totalPages <= 1) { pagEl.innerHTML = ''; pagEl.classList.remove('pagination-sticky', 'hide-at-top'); return; }
            const firstDis = currentPage <= 1;
            const lastDis = currentPage >= totalPages;
            let html = '';
            html += `<button class="page-btn${firstDis ? ' disabled' : ''}" data-page="1"${firstDis ? ' disabled' : ''}>&laquo;&laquo;</button>`;
            html += `<button class="page-btn${firstDis ? ' disabled' : ''}" data-page="${Math.max(1, currentPage - 1)}"${firstDis ? ' disabled' : ''}>&laquo;</button>`;
            for (let p = Math.max(1, currentPage - 3); p <= Math.min(totalPages, currentPage + 3); p++) {
                html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
            }
            html += `<button class="page-btn${lastDis ? ' disabled' : ''}" data-page="${Math.min(totalPages, currentPage + 1)}"${lastDis ? ' disabled' : ''}>&raquo;</button>`;
            html += `<button class="page-btn${lastDis ? ' disabled' : ''}" data-page="${totalPages}"${lastDis ? ' disabled' : ''}>&raquo;&raquo;</button>`;
            pagEl.innerHTML = html;
            pagEl.classList.add('pagination-sticky');
            pagEl.classList.toggle('hide-at-top', currentPage === 1);
            pagEl.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentPage = parseInt(btn.dataset.page);
                    renderAll();
                    listEl.scrollIntoView({ behavior: 'smooth' });
                });
            });
        }

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">Failed to load tech data: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
