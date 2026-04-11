// Render module: shared rendering helpers
// TODO: migrate renderStraightLinks, renderNodeBase, renderTierIndicator, renderNodeLabels, tooltip helpers, wrapText

import { getTechName, isFactionExclusive, factionHasUniqueShips, getTechUnlocks } from './data.js';

/**
 * Map species ID to faction name for faction_ships lookup
 * Species IDs in species.json are already in the correct format (e.g., 'Federation', 'Klingon')
 * This function handles any edge cases or normalization needed
 */
function mapSpeciesToFactionName(speciesId) {
    if (!speciesId || speciesId === 'all') return null;

    // Direct mapping for common variations
    const mappings = {
        'federation': 'Federation',
        'klingon': 'Klingon',
        'romulan': 'Romulan',
        'cardassian': 'Cardassian',
        'dominion': 'Dominion',
        'borg': 'Borg',
        'ferengi': 'Ferengi',
        'vulcan': 'Vulcan',
        'andorian': 'Andorian',
        'tellarite': 'Tellarite',
        'bajoran': 'Bajoran',
        'terran': 'Terran',
        'xindi': 'Xindi',
        'breen': 'Breen',
        'tholian': 'Tholian',
        'hirogen': 'Hirogen',
        'undine': 'Undine',
        'vidiian': 'Vidiian',
        "son'a": "Son'a",
    };

    // Try lowercase lookup first
    const lower = speciesId.toLowerCase();
    if (mappings[lower]) {
        return mappings[lower];
    }

    // If already in correct format (e.g., 'Federation'), return as-is
    return speciesId;
}

/**
 * Phase 3: Format effects with grouping by category
 */
function formatEffectsGrouped(effects) {
    if (!effects || effects.length === 0) return '';

    // Group effects by category
    const grouped = {
        'Combat': [],
        'Economy': [],
        'Science': [],
        'Ships': [],
        'Population': [],
        'Other': []
    };

    effects.forEach(effect => {
        const category = determineEffectCategory(effect.key);
        grouped[category].push(effect);
    });

    // Build HTML
    let html = '<div class="effects-section"><strong>Effects:</strong>';

    for (const [category, categoryEffects] of Object.entries(grouped)) {
        if (categoryEffects.length === 0) continue;

        html += `<div class="effect-category"><span class="effect-category-label">${category}:</span>`;

        categoryEffects.forEach(effect => {
            const icon = getEffectIcon(category);
            html += `<div class="effect-item">${icon} ${effect.display || effect.key}</div>`;
        });

        html += `</div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Determine effect category based on modifier key
 */
function determineEffectCategory(key) {
    const keyLower = key.toLowerCase();

    // Combat-related
    if (keyLower.includes('weapon') || keyLower.includes('damage') ||
        keyLower.includes('armor') || keyLower.includes('hull') ||
        keyLower.includes('shield') || keyLower.includes('fire') ||
        keyLower.includes('evasion') || keyLower.includes('accuracy')) {
        return 'Combat';
    }

    // Economy-related
    if (keyLower.includes('resource') || keyLower.includes('mineral') ||
        keyLower.includes('energy') || keyLower.includes('alloy') ||
        keyLower.includes('cost') || keyLower.includes('upkeep') ||
        keyLower.includes('trade')) {
        return 'Economy';
    }

    // Science-related
    if (keyLower.includes('research') || keyLower.includes('physics') ||
        keyLower.includes('society') || keyLower.includes('engineering') ||
        keyLower.includes('tech') || keyLower.includes('science')) {
        return 'Science';
    }

    // Ship-related
    if (keyLower.includes('ship') || keyLower.includes('fleet') ||
        keyLower.includes('naval') || keyLower.includes('starbase') ||
        keyLower.includes('speed') || keyLower.includes('emergency_ftl')) {
        return 'Ships';
    }

    // Population-related
    if (keyLower.includes('pop') || keyLower.includes('growth') ||
        keyLower.includes('happiness') || keyLower.includes('amenities') ||
        keyLower.includes('stability')) {
        return 'Population';
    }

    return 'Other';
}

/**
 * Get icon for effect category
 */
function getEffectIcon(category) {
    const icons = {
        'Combat': '⚔️',
        'Economy': '💰',
        'Science': '🔬',
        'Ships': '🚀',
        'Population': '👥',
        'Other': '⚙️'
    };
    return icons[category] || '⚙️';
}

// Mapping: unlock type display name -> cross-ref module key
const UNLOCK_TYPE_TO_MODULE = {
    'Building': 'buildings',
    'Ship Type': 'ships',
    'Component': 'components',
    'Megastructure': 'megastructures',
    'District': 'districts',
    'Trait': 'traits',
    'Edict': 'edicts',
};

/**
 * Format unlocks with grouping by type (similar to effects).
 * If techId is provided, items matching tech_item_map entries become clickable wiki-links.
 */
function formatUnlocksGrouped(unlocksByType, techId) {
    if (!unlocksByType || Object.keys(unlocksByType).length === 0) {
        return '';
    }

    // Build lookup from tech_item_map for this tech
    const techUnlocks = techId ? getTechUnlocks(techId) : null;
    // Build a reverse lookup: module_key -> Set of item IDs for fast matching
    const moduleItemMap = {};
    if (techUnlocks) {
        for (const [moduleKey, items] of Object.entries(techUnlocks)) {
            moduleItemMap[moduleKey] = {};
            for (const item of items) {
                moduleItemMap[moduleKey][item.id] = item;
            }
        }
    }

    // Build HTML
    let html = '<div class="unlocks-section"><strong>Unlocks:</strong>';

    // Sort unlock types alphabetically
    const sortedTypes = Object.keys(unlocksByType).sort();

    for (const unlockType of sortedTypes) {
        const items = unlocksByType[unlockType];
        if (!items || items.length === 0) continue;

        const iconFile = getUnlockIconFile(unlockType);
        html += `<div class="unlock-category">`;
        html += `<span class="unlock-category-label"><img src="icons/unlock_types/${iconFile}.webp" class="unlock-type-img" alt="${unlockType}"> ${unlockType}:</span>`;

        const moduleKey = UNLOCK_TYPE_TO_MODULE[unlockType];
        const moduleItems = moduleKey && moduleItemMap[moduleKey] ? moduleItemMap[moduleKey] : null;

        items.forEach(displayName => {
            // Try to find a matching item in the tech_item_map
            let linked = false;
            if (moduleItems) {
                // Match by display name against item IDs or name_keys
                for (const [itemId, itemData] of Object.entries(moduleItems)) {
                    const itemName = itemData.nk || itemId;
                    if (displayName === itemName || displayName === itemId ||
                        displayName.toLowerCase() === itemName.toLowerCase()) {
                        const url = itemData.p + '?search=' + encodeURIComponent(itemId) + '&tab=' + encodeURIComponent(itemData.tab);
                        html += `<div class="unlock-item"><a href="${url}" class="wiki-link">${displayName}</a></div>`;
                        linked = true;
                        break;
                    }
                }
            }
            if (!linked) {
                html += `<div class="unlock-item">${displayName}</div>`;
            }
        });

        html += `</div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Get icon filename for unlock type (Stellaris game icons)
 * Used in both SVG nodes and HTML tooltips/details
 */
function getUnlockIconFile(type) {
    const icons = {
        'Building': 'unlock_building',
        'Ship Type': 'unlock_ship',
        'Ship Section': 'unlock_ship_section',
        'Tradition': 'unlock_tradition',
        'Trait': 'unlock_trait',
        'Ascension Perk': 'unlock_ascension_perk',
        'Special Project': 'unlock_special_project',
        'Megastructure': 'unlock_megastructure',
        'District': 'unlock_district',
        'Edict': 'unlock_edict',
        'Decision': 'unlock_decision',
        'Policy': 'unlock_policy',
        'Strategic Resource': 'unlock_strategic_resource',
        'Job': 'unlock_job',
        'Army Type': 'unlock_army',
        'Technology': 'unlock_technology',
        'Component': 'unlock_component',
        'Starbase Building': 'unlock_starbase',
        'Starbase Module': 'unlock_starbase_module',
        'Anomaly': 'unlock_anomaly',
        'Bypass': 'unlock_bypass',
        'Faction Type': 'unlock_faction',
        'Country Limit': 'unlock_country_limit',
        'Deposit': 'unlock_deposit',
        'Other': 'unlock_other'
    };
    return icons[type] || 'unlock_other';
}

/**
 * Render unlock type icons in bottom-left corner of node
 * Shows one icon per unlock type, max 2 vertically then wraps horizontally
 * Uses actual Stellaris game icons from icons/unlock_types/
 */
function renderUnlockIcons(selection, nodeWidth, nodeHeight) {
    const iconSize = 12;
    const padding = 10;
    const spacing = 14;
    const maxPerColumn = 2;

    selection.each(function(d) {
        const unlockTypes = d.unlock_details?.unlocks_by_type;
        if (!unlockTypes || Object.keys(unlockTypes).length === 0) return;

        const types = Object.keys(unlockTypes).filter(t => t !== 'Other');
        if (types.length === 0) return;

        const g = d3.select(this);

        types.forEach((type, i) => {
            const col = Math.floor(i / maxPerColumn);
            const row = i % maxPerColumn;

            const x = -nodeWidth / 2 + padding + col * spacing;
            const y = nodeHeight / 2 - padding - iconSize - (maxPerColumn - 1 - row) * spacing;

            const iconFile = getUnlockIconFile(type);
            g.append('image')
                .attr('class', 'node-label unlock-type-icon')
                .attr('x', x)
                .attr('y', y)
                .attr('width', iconSize)
                .attr('height', iconSize)
                .attr('href', `icons/unlock_types/${iconFile}.webp`);
        });
    });
}

export function createSvgFor(container, onZoom) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const g = svg.append("g");
  g.append('g').attr('class','links-layer');
  g.append('g').attr('class','nodes-layer');
  let rafId = null;
  const zoom = d3.zoom().on("zoom", (event) => {
    g.attr("transform", event.transform);
    if (typeof onZoom === 'function') {
      if (rafId == null) {
        rafId = requestAnimationFrame(() => {
          onZoom(event);
          rafId = null;
        });
      }
    }
  });
  svg.call(zoom);
  return { svg, g, zoom, width, height };
}

 

// --- Shared Rendering Utilities ---
export function renderStraightLinks(layer, links) {
  layer.selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#e0e0e0ff')
      .attr('stroke-opacity', 0.5)
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
}

export function getAreaColor(area) {
  switch (area) {
    case 'physics': return '#2a7fff';
    case 'society': return '#36d673';
    case 'engineering': return '#ffb400';
    default: return '#666666';
  }
}

export function renderNodeBase(nodeSel, { nodeWidth, nodeHeight }) {
  nodeSel.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('x', -nodeWidth / 2)
      .attr('y', -nodeHeight / 2)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', d => getAreaColor(d.area));
}

export function renderTierIndicator(nodeSel, { nodeWidth, nodeHeight, stripeWidth = 8 }) {
  const cornerRadius = 10;
  const x0 = -nodeWidth / 2;
  const y0 = -nodeHeight / 2;
  const x1 = -nodeWidth / 2 + stripeWidth;
  const y1 = nodeHeight / 2;
  const r = cornerRadius;
  const pathData = `M ${x0},${y0 + r} A ${r},${r} 0 0 1 ${x0 + r},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0 + r},${y1} A ${r},${r} 0 0 1 ${x0},${y1 - r} Z`;

  const tierIndicator = nodeSel.append('g');
  tierIndicator.append('path').attr('d', pathData).attr('fill', 'white');

  tierIndicator.each(function(d) {
      const tier = parseInt(d.tier) || 0;
      if (tier > 0) {
          const gSel = d3.select(this);
          const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

          gSel.append('defs')
            .append('clipPath')
            .attr('id', clipId)
            .append('path')
            .attr('d', pathData);

          const stripes = gSel.append('g').attr('clip-path', `url(#${clipId})`);
          const stripeSpacing = 6;
          const strokeW = 2;
          for (let i = 0; i < Math.min(tier, 11); i++) {
              const y = y0 + 3 + i * stripeSpacing;
              stripes.append('line')
                  .attr('stroke', 'black')
                  .attr('stroke-width', strokeW)
                  .attr('x1', x0 - 5)
                  .attr('y1', y)
                  .attr('x2', x1 + 5)
                  .attr('y2', y + (x1 - x0) + 6);
          }
      }
  });
}

// Unified render dispatcher moved from ui/renderDispatcher.js
// Usage: renderGraph(layout, nodes, links, selectedSpecies, container, deps)
export function renderGraph(layout, nodes, links, selectedSpecies, container, deps) {
  if (layout === 'force-directed') {
    return deps.forceLayout(nodes, links, selectedSpecies, container, deps);
  } else if (layout === 'disjoint-force-directed') {
    return deps.disjointLayout(nodes, links, selectedSpecies, container, deps);
  } else if (layout === 'force-directed-arrows') {
    return deps.arrowsLayout(nodes, links, selectedSpecies, container, deps);
  }
  // Fallback to force layout
  return deps.forceLayout(nodes, links, selectedSpecies, container, deps);
}

// Approximate char width for 12px bold font; avoids getComputedTextLength when text is clearly short
const _approxCharWidth = 6.5;
function _estWidth(str) { return (str || '').length * _approxCharWidth; }

// Helper to wrap SVG text into tspans up to a max number of lines
export function wrapText(textSelection, width, lineHeight = 12, maxLines = 2) {
  textSelection.each(function(d) {
      const text = d3.select(this);
      const full = text.text() || '';
      const words = full.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
          d._nameLineCount = 0;
          return;
      }
      let line = [];
      let lineNumber = 0;
      const x = +((text.attr('x') ?? 0));
      const y = +((text.attr('y') ?? 0));
      text.text(null);
      let tspan = text.append('tspan').attr('x', x).attr('y', y).attr('dy', 0);
      for (let i = 0; i < words.length; i++) {
          const word = words[i];
          line.push(word);
          const lineStr = line.join(' ');
          tspan.text(lineStr);
          if (_estWidth(lineStr) > width * 0.95) {
              line.pop();
              tspan.text(line.join(' '));
              line = [word];
              lineNumber += 1;
              if (lineNumber >= maxLines) {
                  const last = text.select('tspan:last-child');
                  let trimmed = last.text();
                  // Trim using width estimate to avoid layout reflows
                  while (_estWidth(trimmed + '…') > width && trimmed.length > 0) {
                      trimmed = trimmed.slice(0, -1);
                  }
                  last.text(trimmed + '…');
                  d._nameLineCount = maxLines;
                  return;
              }
              tspan = text.append('tspan').attr('x', x).attr('y', y).attr('dy', lineNumber * lineHeight).text(word);
          }
      }
      d._nameLineCount = lineNumber + 1;
  });
}

export function renderNodeLabels(nodeSel, { nodeWidth, nodeHeight }) {
  const nodeTextWidth = nodeWidth - 8 /*wedge*/ - 16 /*padding*/;
  const nameText = nodeSel.append('text')
      .attr('class', 'node-label node-name')
      .attr('x', 0)
      .attr('y', -nodeHeight / 2 + 14)
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .style('fill', '#ffffff')
      .text(d => d.name || d.id);
  wrapText(nameText, nodeTextWidth, 12, 2);

  nodeSel.append('text')
      .attr('class', 'node-label node-category')
      .attr('x', 0)
      .attr('y', d => {
          const lines = d && d._nameLineCount ? d._nameLineCount : 1;
          return -nodeHeight / 2 + 30 + (lines - 1) * 12;
      })
      .attr('text-anchor', 'middle')
      .style('fill', '#ffffff')
      .text(d => `${d.category || 'N/A'}`);

  // Tech Icon - right-aligned in lower half of node
  const iconSize = 28;
  nodeSel.append('image')
      .attr('class', 'node-label node-icon')
      .attr('x', nodeWidth / 2 - iconSize - 8) // 8px from right edge
      .attr('y', nodeHeight / 2 - iconSize - 8) // 8px from bottom
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('href', d => {
          const iconName = d.icon || d.id;
          return `icons/tech/${iconName}.webp`;
      })
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .on('error', function() {
          // Fallback: hide broken images
          d3.select(this).style('display', 'none');
      });

  // Unlock type icons - bottom-left corner
  renderUnlockIcons(nodeSel, nodeWidth, nodeHeight);

  // Species display removed - now only in tooltip
  // Kept for potential future use:
  // nodeSel.append('text')
  //     .attr('class', 'node-label node-species')
  //     .attr('x', 0)
  //     .attr('y', d => {
  //         const lines = d && d._nameLineCount ? d._nameLineCount : 1;
  //         return -nodeHeight / 2 + 45 + (lines - 1) * 12;
  //     })
  //     .attr('text-anchor', 'middle')
  //     .style('font-size', '8px')
  //     .style('fill', '#ffffff')
  //     .text(d => (d.required_species && d.required_species.length > 0) ? d.required_species.join(', ') : 'Global');
}

import { getAllTechsCached } from './data.js';

export function formatTooltip(d, currentFactionId = 'all') {
    const techSource = getAllTechsCached() || [];
    const nameById = new Map(techSource.map(t => [t.id, t.name]));

    // NEW Phase 2: Use faction-specific name if available
    const displayName = getTechName(d, currentFactionId) || d.name || d.id;
    const isExclusive = isFactionExclusive(d, currentFactionId);

    // Build prerequisites string
    const prerequisites = (d.prerequisites || []).map(id => nameById.get(id) || id).join(', ');

    // Build unlocks HTML using structured data
    let unlocksHtml = '';

    if (d.unlock_details && d.unlock_details.unlocks_by_type) {
        // Shallow-clone unlocks_by_type (arrays copied) to avoid modifying original data
        const unlocksByType = Object.fromEntries(
            Object.entries(d.unlock_details.unlocks_by_type).map(([k, v]) => [k, [...v]])
        );

        // Add faction-specific ships if faction is selected AND faction has unique ships
        // Factions without unique ships (like Breen) should only see generic ship names
        if (d.unlock_details.faction_ships && currentFactionId && currentFactionId !== 'all') {
            // Check if this faction has its own unique ships
            const hasUniqueShips = factionHasUniqueShips(currentFactionId);

            if (hasUniqueShips) {
                // Map species IDs to faction names (e.g., 'FED' -> 'Federation')
                const factionName = mapSpeciesToFactionName(currentFactionId);
                const factionShips = d.unlock_details.faction_ships[factionName];
                if (factionShips && factionShips.length > 0) {
                    if (!unlocksByType['Ship Type']) {
                        unlocksByType['Ship Type'] = [];
                    }
                    // Add faction ships (avoid duplicates)
                    const existing = new Set(unlocksByType['Ship Type']);
                    for (const ship of factionShips) {
                        if (!existing.has(ship)) {
                            unlocksByType['Ship Type'].push(ship);
                        }
                    }
                }
            }
            // If hasUniqueShips is false, we don't add any faction_ships - only generic ships shown
        }

        // Use new grouped format with wiki-links
        unlocksHtml = formatUnlocksGrouped(unlocksByType, d.id);
    } else if (d.unlock_details && d.unlock_details.description) {
        // Fallback to description string (legacy)
        unlocksHtml = d.unlock_details.description;
    } else if (d.unlocks && d.unlocks.length > 0) {
        // Fallback to very old unlocks array format
        const unlocksByType = d.unlocks.reduce((acc, u) => {
            if (typeof u === 'object' && u !== null) {
                const type = u.type || 'unknown';
                if (!acc[type]) {
                    acc[type] = [];
                }
                acc[type].push(u.label || u.id);
            }
            return acc;
        }, {});

        for (const type in unlocksByType) {
            unlocksHtml += `<strong>${type}:</strong> ${unlocksByType[type].join(', ')}<br>`;
        }
    }

    // NEW Phase 2: Add description if available (from Phase 1 data)
    let descriptionHtml = '';
    if (d.description && d.description.trim()) {
        descriptionHtml = `<div style="margin: 8px 0; padding: 6px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--primary); font-style: italic;">${d.description}</div>`;
    }

    // NEW Phase 3: Enhanced effect display with grouping
    let effectsHtml = '';
    if (d.effects && Array.isArray(d.effects) && d.effects.length > 0) {
        effectsHtml = formatEffectsGrouped(d.effects);
    }

    // NEW Phase 2: Faction exclusive badge
    let factionBadge = '';
    if (isExclusive && currentFactionId !== 'all') {
        // Capitalize faction name
        const factionName = currentFactionId.charAt(0).toUpperCase() + currentFactionId.slice(1);
        factionBadge = `<span style="color: #ffd700; font-weight: bold;">⭐ ${factionName}-exclusive</span><br>`;
    }

    return `
        <strong>Name:</strong> ${displayName}<br>
        ${factionBadge}
        ${descriptionHtml}
        ${effectsHtml}
        ${unlocksHtml || '<strong>Unlocks:</strong> None'}
        <strong>Prerequisites:</strong> ${prerequisites || 'None'}<br>
        <strong>ID:</strong> ${d.id}<br>
        <strong>Area:</strong> ${d.area}<br>
        <strong>Category:</strong> ${d.category || 'N/A'}<br>
        <strong>Tier:</strong> ${d.tier}<br>
        <strong>Access:</strong> ${d.required_species ? d.required_species.join(', ') : 'All'}<br>
        <strong>Cost:</strong> ${d.cost}<br>
        <strong>Weight:</strong> ${d.weight}
    `;
}

// Shared Level-of-Detail logic used by layouts and the legacy showcase
export function updateLOD(svg, g) {
  if (!g || !svg) return;
  const t = d3.zoomTransform(svg.node());
  const k = t.k;
  const width = parseFloat(svg.attr('width')) || svg.node().clientWidth || 0;
  const height = parseFloat(svg.attr('height')) || svg.node().clientHeight || 0;

  // World-space viewport rectangle derived from current transform
  const x0 = (0 - t.x) / k, y0 = (0 - t.y) / k;
  const x1 = (width - t.x) / k, y1 = (height - t.y) / k;
  const margin = 120; // allow a small offscreen margin

  const isVisible = (d) => d && typeof d.x === 'number' && typeof d.y === 'number'
      && d.x >= (x0 - margin) && d.x <= (x1 + margin)
      && d.y >= (y0 - margin) && d.y <= (y1 + margin);

  // Lower thresholds so details appear earlier when zooming in
  const showLabelsAt = 0.45;
  const showTiersAt = 0.60;
  const showLinksAt = 0.30;
  const showCirclesAt = 0.45;

  // Lazy-create heavy DOM when thresholds are reached
  const flags = {
    labels: g.property('labelsInitialized') || false,
    tiers: g.property('tiersInitialized') || false,
    links: g.property('linksInitialized') || false,
  };
  const layout = g.property('layout');
  const data = g.datum && g.datum() ? g.datum() : { nodes: [], links: [] };
  const nodesSel = g.select('.nodes-layer').selectAll('.tech-node');
  const linksLayer = g.select('.links-layer');

  // Use LOD when graph is large (>= 150 nodes); performance toggle can refine behavior in future
  const totalNodes = (data.nodes || []).length;
  const useLOD = totalNodes > 150;

  if (!useLOD) {
    // Eagerly create heavy DOM once if not already present
    if (!flags.labels && !nodesSel.empty()) {
      const nodeHeight = (layout === 'disjoint-force-directed') ? 70 : 80;
      const nodeWidth = (layout === 'disjoint-force-directed') ? 120 : 140;
      const textWidth = nodeWidth - 8 /*wedge*/ - 16 /*padding*/;

      const nameSel = nodesSel.append('text')
        .attr('class', 'node-label node-name')
        .attr('x', 0)
        .attr('y', -nodeHeight / 2 + 14)
        .attr('text-anchor', 'middle')
        .style('font-weight', 'bold')
        .style('fill', '#ffffff')
        .text(d => d.name || d.id);
      wrapText(nameSel, textWidth, 12, 2);

      const categorySel = nodesSel.append('text')
        .attr('class', 'node-label node-category')
        .attr('x', 0)
        .attr('y', d => {
          const lines = d && d._nameLineCount ? d._nameLineCount : 1;
          return -nodeHeight / 2 + 30 + (lines - 1) * 12;
        })
        .attr('text-anchor', 'middle')
        .style('fill', '#ffffff')
        .text(d => `${d.category || 'N/A'}`);

      // Tech Icon - right-aligned in lower half of node
      const iconSize = nodeHeight === 70 ? 24 : 28;
      nodesSel.append('image')
        .attr('class', 'node-label node-icon')
        .attr('x', nodeWidth / 2 - iconSize - 8) // 8px from right edge
        .attr('y', nodeHeight / 2 - iconSize - 8) // 8px from bottom
        .attr('width', iconSize)
        .attr('height', iconSize)
        .attr('href', d => {
          const iconName = d.icon || d.id;
          return `icons/tech/${iconName}.webp`;
        })
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .on('error', function() {
          d3.select(this).style('display', 'none');
        });

      // Unlock type icons - bottom-left corner
      renderUnlockIcons(nodesSel, nodeWidth, nodeHeight);

      // Species removed - now only in tooltip
      g.property('labelsInitialized', true);
    }

    if (!flags.tiers && !nodesSel.empty()) {
      const nodeWidth = (layout === 'disjoint-force-directed') ? 120 : 140;
      const nodeHeight = (layout === 'disjoint-force-directed') ? 70 : 80;
      const stripeWidth = 8;
      const cornerRadius = (layout === 'disjoint-force-directed') ? 8 : 10;
      const x0t = -nodeWidth / 2;
      const y0t = -nodeHeight / 2;
      const x1t = -nodeWidth / 2 + stripeWidth;
      const x1tAdj = x1t + 1; // move wedge slightly into the node to avoid seam
      const y1t = nodeHeight / 2;
      const rt = cornerRadius;
      const pathDataT = `M ${x0t},${y0t + rt} A ${rt},${rt} 0 0 1 ${x0t + rt},${y0t} L ${x1tAdj},${y0t} L ${x1tAdj},${y1t} L ${x0t + rt},${y1t} A ${rt},${rt} 0 0 1 ${x0t},${y1t - rt} Z`;

      const tierIndicator = nodesSel.append('g').attr('class', 'tier-indicator');
      tierIndicator.append('path').attr('d', pathDataT).attr('fill', 'white');

      tierIndicator.each(function(d) {
        const tier = parseInt(d.tier) || 0;
        if (tier > 0) {
          const tg = d3.select(this);
          const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

          tg.append('defs')
            .append('clipPath')
            .attr('id', clipId)
            .append('path')
            .attr('d', pathDataT);

          const stripes = tg.append('g').attr('clip-path', `url(#${clipId})`);
          const stripeSpacing = 6; // fixed spacing to fit up to 11 tiers
          const strokeW = 2; // fixed stroke width for clarity
          for (let i = 0; i < Math.min(tier, 11); i++) {
            const y = y0t + 3 + i * stripeSpacing; // small top padding
            stripes.append('line')
              .attr('stroke', 'black')
              .attr('stroke-width', strokeW)
              .attr('x1', x0t - 5)
              .attr('y1', y)
              .attr('x2', x1t + 5)
              .attr('y2', y + (x1t - x0t) + 6);
          }
        }
      });
      g.property('tiersInitialized', true);
    }

    if (!flags.links && linksLayer.size()) {
      if (layout === 'force-directed' || layout === 'disjoint-force-directed') {
        linksLayer.selectAll('.link')
          .data(data.links)
          .join('line')
          .attr('class', 'link')
          .attr('stroke', layout === 'force-directed' ? '#e0e0e0ff' : '#999')
          .attr('stroke-opacity', layout === 'force-directed' ? 0.5 : 0.6)
          .attr('x1', d => (d.source && typeof d.source === 'object') ? d.source.x : 0)
          .attr('y1', d => (d.source && typeof d.source === 'object') ? d.source.y : 0)
          .attr('x2', d => (d.target && typeof d.target === 'object') ? d.target.x : 0)
          .attr('y2', d => (d.target && typeof d.target === 'object') ? d.target.y : 0);
      } else if (layout === 'force-directed-arrows') {
        linksLayer.selectAll('.link')
          .data(data.links)
          .join('polygon')
          .attr('class', 'link')
          .attr('fill', '#e0e0e0ff')
          .attr('stroke', 'black')
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.7);
      }
      g.property('linksInitialized', true);
    }

    // Show everything for small graphs or when LOD is disabled
    g.selectAll('.node-label').style('display', null);
    g.selectAll('.tier-indicator').style('display', null);
    g.selectAll('.link').style('display', null);
    // Ensure we revert to rectangle view and hide circle glyphs when not using LOD
    g.selectAll('.node-circle').style('display', 'none');
    g.selectAll('.node-rect').style('display', null);
    return;
  }

  // Initialize labels once when zoom passes threshold
  if (!flags.labels && k >= showLabelsAt && !nodesSel.empty()) {
    const nodeHeight = (layout === 'disjoint-force-directed') ? 70 : 80;
    const nodeWidth = (layout === 'disjoint-force-directed') ? 120 : 140;
    const textWidth = nodeWidth - 8 /*wedge*/ - 16 /*padding*/;

    const nameSel2 = nodesSel.append('text')
      .attr('class', 'node-label node-name')
      .attr('x', 0)
      .attr('y', -nodeHeight / 2 + 14)
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .style('fill', '#ffffff')
      .text(d => d.name || d.id);
    wrapText(nameSel2, textWidth, 12, 2);

    nodesSel.append('text')
      .attr('class', 'node-label node-category')
      .attr('x', 0)
      .attr('y', d => {
        const lines = d && d._nameLineCount ? d._nameLineCount : 1;
        return -nodeHeight / 2 + 30 + (lines - 1) * 12;
      })
      .attr('text-anchor', 'middle')
      .style('fill', '#ffffff')
      .text(d => `${d.category || 'N/A'}`);

    // Tech Icon - right-aligned in lower half of node (LOD mode)
    const iconSize = nodeHeight === 70 ? 24 : 28;
    nodesSel.append('image')
      .attr('class', 'node-label node-icon')
      .attr('x', nodeWidth / 2 - iconSize - 8) // 8px from right edge
      .attr('y', nodeHeight / 2 - iconSize - 8) // 8px from bottom
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('href', d => {
        const iconName = d.icon || d.id;
        return `icons/tech/${iconName}.webp`;
      })
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .on('error', function() {
        d3.select(this).style('display', 'none');
      });

    // Unlock type icons - bottom-left corner
    renderUnlockIcons(nodesSel, nodeWidth, nodeHeight);

    // Species removed - now only in tooltip
    g.property('labelsInitialized', true);
  }

  // Initialize tier indicators once when zoom passes threshold
  if (!flags.tiers && k >= showTiersAt && !nodesSel.empty()) {
    const nodeWidth = (layout === 'disjoint-force-directed') ? 120 : 140;
    const nodeHeight = (layout === 'disjoint-force-directed') ? 70 : 80;
    const stripeWidth = 8;
    const cornerRadius = (layout === 'disjoint-force-directed') ? 8 : 10;
    const x0b = -nodeWidth / 2;
    const y0b = -nodeHeight / 2;
    const x1b = -nodeWidth / 2 + stripeWidth;
    const y1b = nodeHeight / 2;
    const rb = cornerRadius;
    const pathData = `M ${x0b},${y0b + rb} A ${rb},${rb} 0 0 1 ${x0b + rb},${y0b} L ${x1b},${y0b} L ${x1b},${y1b} L ${x0b + rb},${y1b} A ${rb},${rb} 0 0 1 ${x0b},${y1b - rb} Z`;

    const tierIndicator = nodesSel.append('g').attr('class', 'tier-indicator');
    tierIndicator.append('path').attr('d', pathData).attr('fill', 'white');

    tierIndicator.each(function(d) {
      const tier = parseInt(d.tier) || 0;
      if (tier > 0) {
        const tg = d3.select(this);
        const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

        tg.append('defs')
          .append('clipPath')
          .attr('id', clipId)
          .append('path')
          .attr('d', pathData);

        const stripes = tg.append('g').attr('clip-path', `url(#${clipId})`);
        const stripeSpacing = 6; // fixed spacing to fit up to 11 tiers
        const strokeW = 2; // fixed stroke width for clarity
        for (let i = 0; i < Math.min(tier, 11); i++) {
          const y = y0b + 3 + i * stripeSpacing; // small top padding
          stripes.append('line')
            .attr('stroke', 'black')
            .attr('stroke-width', strokeW)
            .attr('x1', x0b - 5)
            .attr('y1', y)
            .attr('x2', x1b + 5)
            .attr('y2', y + (x1b - x0b) + 6);
        }
      }
    });
    g.property('tiersInitialized', true);
  }

  // Initialize links once when zoom passes threshold
  if (!flags.links && k >= showLinksAt && linksLayer.size()) {
    if (layout === 'force-directed' || layout === 'disjoint-force-directed') {
      linksLayer.selectAll('.link')
        .data(data.links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke', layout === 'force-directed' ? '#e0e0e0ff' : '#999')
        .attr('stroke-opacity', layout === 'force-directed' ? 0.5 : 0.6)
        .attr('x1', d => (d.source && typeof d.source === 'object') ? d.source.x : 0)
        .attr('y1', d => (d.source && typeof d.source === 'object') ? d.source.y : 0)
        .attr('x2', d => (d.target && typeof d.target === 'object') ? d.target.x : 0)
        .attr('y2', d => (d.target && typeof d.target === 'object') ? d.target.y : 0);
    } else if (layout === 'force-directed-arrows') {
      linksLayer.selectAll('.link')
        .data(data.links)
        .join('polygon')
        .attr('class', 'link')
        .attr('fill', '#e0e0e0ff')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.7);
    }
    g.property('linksInitialized', true);
  }

  // LOD logic: precompute visible node IDs once to avoid repeated isVisible calls per element
  const isCircleView = useLOD && k < showCirclesAt;
  const visibleNodeIds = new Set(
    (data.nodes || []).filter(n => isVisible(n)).map(n => n.id)
  );

  // Cull off-screen node groups entirely — browser skips painting their whole subtree
  g.select('.nodes-layer').selectAll('.tech-node')
    .style('display', d => visibleNodeIds.has(d?.id) ? null : 'none');

  const nodeCircles = g.selectAll('.node-circle');
  const nodeRects = g.selectAll('.node-rect, .tier-indicator, .node-label');
  nodeCircles.style('display', d => (isCircleView && visibleNodeIds.has(d?.id)) ? null : 'none');
  nodeRects.style('display', d => (!isCircleView && visibleNodeIds.has(d?.id)) ? null : 'none');

  if (!isCircleView) {
    g.selectAll('.node-label').style('display', d => (k >= showLabelsAt && visibleNodeIds.has(d?.id)) ? null : 'none');
    g.selectAll('.tier-indicator').style('display', d => (k >= showTiersAt && visibleNodeIds.has(d?.id)) ? null : 'none');
  }

  linksLayer.selectAll('.link').style('display', d => {
    const s = d?.source;
    const tt = d?.target;
    const sid = s && typeof s === 'object' ? s.id : (typeof s === 'string' ? s : null);
    const tid = tt && typeof tt === 'object' ? tt.id : (typeof tt === 'string' ? tt : null);
    const endpointsVisible = (sid && visibleNodeIds.has(sid)) || (tid && visibleNodeIds.has(tid));
    return (k >= showLinksAt && endpointsVisible) ? null : 'none';
  });
}

export function calculateAndRenderPath(startId, endId, allTechs, deps) {
  const {
    popupViewportEl,
    popupContainerEl,
    tooltipEl,
    techTreeContainerEl,
    renderPopupGraph,
    getPrerequisitesData,
    calculateAllPaths,
  } = deps;

  const placeholderEl = document.getElementById('popup-placeholder');
  let pathNodes, pathLinks;

  // Always clear previous graph rendering
  if (popupContainerEl) {
    const svg = popupContainerEl.querySelector('svg');
    if (svg) svg.remove();
  }
  
  if (endId) {
    let startNode = allTechs.find(t => t.id === startId);
    let endNode = allTechs.find(t => t.id === endId);

    if (startNode && endNode && parseInt(startNode.tier) > parseInt(endNode.tier)) {
      [startId, endId] = [endId, startId];
      [startNode, endNode] = [endNode, startNode];
    }

    const result = calculateAllPaths(startId, endId, allTechs);
    pathNodes = result.nodes;
    pathLinks = result.links;
    if (placeholderEl) {
      placeholderEl.innerHTML = `Path between ${startNode?.name || startId} and ${endNode?.name || endId}`;
    }
  } else {
    const pathNodeIds = getPrerequisitesData(startId, allTechs);
    pathNodes = allTechs.filter(t => pathNodeIds.has(t.id));
    pathLinks = [];
    pathNodes.forEach(tech => {
      if (tech.prerequisites) {
        tech.prerequisites.forEach(prereq => {
          if (pathNodeIds.has(prereq)) {
            pathLinks.push({ source: prereq, target: tech.id });
          }
        });
      }
    });
    const startNode = allTechs.find(t => t.id === startId);
    if (placeholderEl) {
      placeholderEl.innerHTML = `Minimum requirement for ${startNode?.name || startId}`;
    }
  }

  if (popupViewportEl) popupViewportEl.classList.remove('hidden');

  if (endId && pathNodes.length <= 2) {
    const startNode = allTechs.find(t => t.id === startId);
    const endNode = allTechs.find(t => t.id === endId);
    if (endNode && endNode.prerequisites && endNode.prerequisites.includes(startId)) {
      // Special case: the start node is a direct prerequisite. Show all prerequisites.
      const prereqIds = new Set(endNode.prerequisites);
      prereqIds.add(endId);
      pathNodes = allTechs.filter(t => prereqIds.has(t.id));
      pathLinks = endNode.prerequisites.map(p => ({ source: p, target: endId }));
    } else {
      if (placeholderEl) placeholderEl.innerHTML = 'No dependencies detected';
      // Clear the graph area but keep the popup open
      if (popupContainerEl) {
          const svg = popupContainerEl.querySelector('svg');
          if (svg) svg.remove();
      }
      return;
    }
  }

  if (pathNodes.length === 0) {
    if (placeholderEl) placeholderEl.innerHTML = 'No path or prerequisites found.';
    return;
  }

  renderPopupGraph(pathNodes, pathLinks, {
    containerEl: popupContainerEl,
    tooltipEl,
    techTreeContainerEl,
    drag: deps.drag,
  });
}
