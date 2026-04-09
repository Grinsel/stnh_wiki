/**
 * CategoryChips — reusable chip-bar filter component.
 *
 * Usage:
 *   const chips = CategoryChips.create({
 *       container: document.getElementById('my-chip-bar'),
 *       categories: [
 *           { value: 'shipclass_military', label: 'Military', count: 180 },
 *           { value: 'shipclass_science_ship', label: 'Science', count: 28, icon: 'icons/unlock_types/unlock_ship.webp' },
 *       ],
 *       onChange: (value) => { /* value is '' for "All" *\/ }
 *   });
 *
 *   chips.setActive('shipclass_military');  // programmatic selection
 *   chips.getActive();                      // returns current value
 *   chips.updateCounts({ shipclass_military: 150 }); // refresh counts
 *   chips.rebuild(newCategories);           // replace chips entirely, resets to 'All'
 */
var CategoryChips = (function () {

    /**
     * Create a chip bar inside `container`.
     * @param {object} opts
     * @param {HTMLElement} opts.container
     * @param {Array<{value:string, label:string, count?:number, icon?:string}>} opts.categories
     * @param {function(string):void} opts.onChange  called with value ('') = All
     * @param {string} [opts.allLabel]  label for the "All" chip, default 'All'
     * @param {boolean} [opts.showCounts]  default true
     * @returns {{ setActive, getActive, updateCounts }}
     */
    function create(opts) {
        const container = opts.container;
        const onChange = opts.onChange || function () {};
        let _allLabel = opts.allLabel || 'All';
        const showCounts = opts.showCounts !== false;
        let activeValue = '';

        function buildChips(categories) {
            container.innerHTML = '';
            container.classList.add('cat-chip-bar');

            // "All" chip always first
            const allChip = _makeChip('', _allLabel, null, null, showCounts);
            allChip.classList.add('active');
            allChip.addEventListener('click', () => _select('', categories));
            container.appendChild(allChip);

            for (const cat of categories) {
                const chip = _makeChip(cat.value, cat.label, cat.count, cat.icon, showCounts);
                chip.addEventListener('click', () => _select(cat.value, categories));
                container.appendChild(chip);
            }
        }

        function _makeChip(value, label, count, icon, showCounts) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cat-chip';
            chip.dataset.value = value;

            if (icon) {
                const img = document.createElement('img');
                img.src = icon;
                img.alt = '';
                img.className = 'cat-chip-icon';
                chip.appendChild(img);
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = label;
            chip.appendChild(labelSpan);

            if (showCounts && count != null) {
                const countSpan = document.createElement('span');
                countSpan.className = 'cat-chip-count';
                countSpan.dataset.chipCount = value;
                countSpan.textContent = count;
                chip.appendChild(countSpan);
            }

            return chip;
        }

        function _select(value, categories) {
            if (value === activeValue) return; // no-op if already active
            activeValue = value;
            container.querySelectorAll('.cat-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.value === value);
            });
            onChange(value);
        }

        /**
         * Replace all chips with new categories and reset selection to 'All'.
         * Does NOT fire onChange.
         * @param {Array<{value:string, label:string, count?:number, icon?:string}>} categories
         */
        function rebuild(categories) {
            activeValue = '';
            buildChips(categories);
        }

        /**
         * Replace all chips with new categories and a new "All" label.
         * Does NOT fire onChange.
         * @param {Array<{value:string, label:string, count?:number, icon?:string}>} categories
         * @param {string} newAllLabel
         */
        function rebuildAll(newCategories, newAllLabel) {
            _allLabel = newAllLabel;
            activeValue = '';
            buildChips(newCategories);
        }

        function setActive(value) {
            const prev = activeValue;
            activeValue = value;
            container.querySelectorAll('.cat-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.value === value);
            });
        }

        function getActive() {
            return activeValue;
        }

        /**
         * Update displayed counts without rebuilding chips.
         * @param {Object.<string, number>} countsMap  { value: count }
         */
        function updateCounts(countsMap) {
            container.querySelectorAll('[data-chip-count]').forEach(span => {
                const v = span.dataset.chipCount;
                if (v in countsMap) span.textContent = countsMap[v];
            });
        }

        buildChips(opts.categories || []);

        return { setActive, getActive, updateCounts, rebuild, rebuildAll };
    }

    return { create };
})();
