// Path Highlighting Module
// Highlights prerequisite paths between techs on hover
// Features:
// - Bidirectional path finding (both directions based on tier)
// - Complete prerequisite chains (including filtered/hidden techs)
// - Ghost nodes for missing prerequisites
// - Dimming of non-path nodes for better visibility

let _allTechs = [];           // All techs (for complete prereq search)
let _renderedNodes = [];      // Currently rendered nodes
let _activeTechId = null;     // Currently focused tech
let _highlightDirection = 'prerequisites'; // 'prerequisites' or 'dependents'

/**
 * Set the highlight direction
 * @param {string} direction - 'prerequisites' or 'dependents'
 */
export function setHighlightDirection(direction) {
  _highlightDirection = direction;
}

/**
 * Get the current highlight direction
 * @returns {string} Current direction
 */
export function getHighlightDirection() {
  return _highlightDirection;
}

/**
 * Initialize path highlighting with tech data
 * @param {Array} allTechs - All technologies from the database
 */
export function initPathHighlight(allTechs) {
  _allTechs = allTechs || [];
}

/**
 * Set the currently rendered nodes (for ghost node detection)
 * @param {Array} nodes - Currently rendered node array
 */
export function setRenderedNodes(nodes) {
  _renderedNodes = nodes || [];
}

/**
 * Set the active (focused) tech ID
 * @param {string|null} techId - Active tech ID or null
 */
export function setActiveTechId(techId) {
  _activeTechId = techId;
}

/**
 * Get all prerequisites of a tech (complete chain)
 * @param {string} techId - Tech to find prerequisites for
 * @param {Map} techMap - Map of all techs by ID
 * @returns {Set} Set of prerequisite tech IDs (includes the tech itself)
 */
function getAllPrerequisites(techId, techMap) {
  const prereqs = new Set();

  function collect(id) {
    if (prereqs.has(id)) return;
    prereqs.add(id);
    const tech = techMap.get(id);
    if (tech?.prerequisites) {
      tech.prerequisites.forEach(collect);
    }
  }

  collect(techId);
  return prereqs;
}

/**
 * Get all descendants of a tech (techs that require this tech, directly or indirectly)
 * @param {string} techId - Tech to find descendants for
 * @param {Array} allTechs - All technologies
 * @returns {Set} Set of descendant tech IDs (includes the tech itself)
 */
function getAllDescendants(techId, allTechs) {
  const descendants = new Set();

  function collect(id) {
    if (descendants.has(id)) return;
    descendants.add(id);
    // Find all techs that have this tech as a prerequisite
    const children = allTechs.filter(t => t.prerequisites && t.prerequisites.includes(id));
    children.forEach(child => collect(child.id));
  }

  collect(techId);
  return descendants;
}

/**
 * Calculate the path between two techs using correct algorithm:
 * Path = (prerequisites of end) ∩ (descendants of start)
 *
 * @param {string} hoveredId - Currently hovered tech ID
 * @param {string} activeId - Active (focused) tech ID
 * @returns {Object} { nodes: Set<string>, links: Array<{source, target}>, missingNodes: Array }
 */
export function calculatePath(hoveredId, activeId) {
  if (!hoveredId || !activeId || hoveredId === activeId) {
    return { nodes: new Set(), links: [], missingNodes: [] };
  }

  const techMap = new Map(_allTechs.map(t => [t.id, t]));
  const hoveredTech = techMap.get(hoveredId);
  const activeTech = techMap.get(activeId);

  if (!hoveredTech || !activeTech) {
    return { nodes: new Set(), links: [], missingNodes: [] };
  }

  // Determine which tech is "higher" (requires the other as prereq)
  const hoveredPrereqs = getAllPrerequisites(hoveredId, techMap);
  const activePrereqs = getAllPrerequisites(activeId, techMap);

  let startId, endId;

  if (hoveredPrereqs.has(activeId)) {
    // Active is a prerequisite of hovered
    // Path goes from active (start) to hovered (end)
    startId = activeId;
    endId = hoveredId;
  } else if (activePrereqs.has(hoveredId)) {
    // Hovered is a prerequisite of active
    // Path goes from hovered (start) to active (end)
    startId = hoveredId;
    endId = activeId;
  } else {
    // No direct prerequisite relationship
    return { nodes: new Set(), links: [], missingNodes: [] };
  }

  // Calculate path using correct algorithm:
  // 1. Find all prerequisites of the END node
  const endPrereqs = getAllPrerequisites(endId, techMap);

  // 2. Find all descendants of the START node
  const startDescendants = getAllDescendants(startId, _allTechs);

  // 3. Path = intersection of these two sets
  const pathNodes = new Set();
  endPrereqs.forEach(id => {
    if (startDescendants.has(id)) {
      pathNodes.add(id);
    }
  });

  // Always include both endpoints
  pathNodes.add(startId);
  pathNodes.add(endId);

  // Build links between path nodes
  const pathLinks = [];
  pathNodes.forEach(id => {
    const tech = techMap.get(id);
    if (tech?.prerequisites) {
      tech.prerequisites.forEach(prereqId => {
        if (pathNodes.has(prereqId)) {
          pathLinks.push({ source: prereqId, target: id });
        }
      });
    }
  });

  // Find missing nodes (in path but not currently rendered)
  const renderedIds = new Set(_renderedNodes.map(n => n.id));
  const missingNodes = [];
  pathNodes.forEach(id => {
    if (!renderedIds.has(id)) {
      const tech = techMap.get(id);
      if (tech) {
        missingNodes.push({ ...tech, isGhost: true });
      }
    }
  });

  return { nodes: pathNodes, links: pathLinks, missingNodes };
}

/**
 * Calculate highlight for a single tech - DECOUPLED from activeTechId
 * Shows ALL prerequisites or dependents based on current direction
 * @param {string} hoveredId - ID of hovered tech
 * @returns {Object} { nodes: Set<string>, links: Array<{source, target}>, missingNodes: Array }
 */
export function calculateHighlight(hoveredId) {
  if (!hoveredId) {
    return { nodes: new Set(), links: [], missingNodes: [] };
  }

  const techMap = new Map(_allTechs.map(t => [t.id, t]));
  const hoveredTech = techMap.get(hoveredId);

  if (!hoveredTech) {
    return { nodes: new Set(), links: [], missingNodes: [] };
  }

  // Calculate nodes based on direction
  let highlightNodes;
  if (_highlightDirection === 'prerequisites') {
    highlightNodes = getAllPrerequisites(hoveredId, techMap);
  } else {
    highlightNodes = getAllDescendants(hoveredId, _allTechs);
  }

  // Build links between highlight nodes
  const highlightLinks = [];
  highlightNodes.forEach(id => {
    const tech = techMap.get(id);
    if (tech?.prerequisites) {
      tech.prerequisites.forEach(prereqId => {
        if (highlightNodes.has(prereqId)) {
          highlightLinks.push({ source: prereqId, target: id });
        }
      });
    }
  });

  // Find missing nodes (in highlight set but not currently rendered)
  const renderedIds = new Set(_renderedNodes.map(n => n.id));
  const missingNodes = [];
  highlightNodes.forEach(id => {
    if (!renderedIds.has(id)) {
      const tech = techMap.get(id);
      if (tech) {
        missingNodes.push({ ...tech, isGhost: true });
      }
    }
  });

  return { nodes: highlightNodes, links: highlightLinks, missingNodes };
}

/**
 * Add ghost nodes to the SVG for missing prerequisites
 * @param {Array} missingNodes - Nodes to add as ghosts
 * @param {Object} g - D3 SVG group selection
 * @param {Object} options - Rendering options (nodeWidth, nodeHeight, etc.)
 * @returns {Array} Created ghost node elements
 */
export function addGhostNodes(missingNodes, g, options = {}) {
  if (!missingNodes?.length || !g || g.empty()) return [];

  const { nodeWidth = 140, nodeHeight = 80, getAreaColor } = options;
  const padY = 40;

  // Collect positions from existing rendered nodes
  const existingNodes = g.selectAll('.tech-node').data();
  const tierPositions = {};

  existingNodes.forEach(n => {
    const tier = n.tier || 0;
    if (!tierPositions[tier]) {
      tierPositions[tier] = { x: n.x, maxY: n.y };
    }
    tierPositions[tier].maxY = Math.max(tierPositions[tier].maxY, n.y);
  });

  // Global baseline: below ALL existing nodes across ALL tiers
  const allMaxY = Object.values(tierPositions).map(t => t.maxY);
  const globalMaxY = allMaxY.length > 0 ? Math.max(...allMaxY) : 200;
  const ghostBaseY = globalMaxY + nodeHeight + 60;

  // Track ghost count per tier for stacking
  const ghostCountPerTier = {};

  // Create ghost node group
  const ghostGroup = g.append('g').attr('class', 'ghost-nodes-layer');

  missingNodes.forEach(node => {
    const tier = node.tier || 0;
    if (!ghostCountPerTier[tier]) ghostCountPerTier[tier] = 0;

    let x;
    if (tierPositions[tier]) {
      x = tierPositions[tier].x;
    } else {
      // Estimate X for tiers with no existing nodes
      const tierKeys = Object.keys(tierPositions).map(Number).sort((a, b) => a - b);
      if (tierKeys.length > 0) {
        const nearestTier = tierKeys.reduce((prev, curr) =>
          Math.abs(curr - tier) < Math.abs(prev - tier) ? curr : prev
        );
        x = tierPositions[nearestTier].x + (tier - nearestTier) * (nodeWidth + 70);
      } else {
        x = 200 + tier * (nodeWidth + 70);
      }
      tierPositions[tier] = { x, maxY: ghostBaseY };
    }

    // Stack ghost nodes below the global baseline (aligned across tiers)
    const y = ghostBaseY + ghostCountPerTier[tier] * (nodeHeight + padY);
    ghostCountPerTier[tier]++;

    // Store position on node for link calculation
    node.x = x;
    node.y = y;

    // Create ghost node
    const ghostNode = ghostGroup.append('g')
      .attr('class', 'tech-node ghost-node path-highlight')
      .attr('transform', `translate(${x},${y})`)
      .datum(node);

    // Rectangle (with ghost styling)
    const areaColor = getAreaColor ? getAreaColor(node.area) : '#666';
    ghostNode.append('rect')
      .attr('class', 'node-rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('x', -nodeWidth / 2)
      .attr('y', -nodeHeight / 2)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', areaColor)
      .attr('fill-opacity', 0.5)
      .attr('stroke', 'cyan')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');

    // Tech name
    ghostNode.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#aaa')
      .attr('font-size', '10px')
      .text(node.name || node.id);
  });

  return missingNodes;
}

/**
 * Add ghost links for missing prerequisites
 * @param {Array} pathLinks - All path links
 * @param {Set} pathNodes - All path node IDs
 * @param {Object} g - D3 SVG group selection
 */
export function addGhostLinks(pathLinks, pathNodes, g) {
  if (!pathLinks?.length || !g || g.empty()) return;

  const renderedIds = new Set(_renderedNodes.map(n => n.id));

  // Get all node positions (rendered + ghost)
  const nodePositions = new Map();

  // Rendered nodes
  g.selectAll('.tech-node:not(.ghost-node)').each(function(d) {
    nodePositions.set(d.id, { x: d.x, y: d.y });
  });

  // Ghost nodes
  g.selectAll('.ghost-node').each(function(d) {
    nodePositions.set(d.id, { x: d.x, y: d.y });
  });

  // Find links that need ghost lines (involve at least one ghost node)
  const ghostLinks = pathLinks.filter(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return !renderedIds.has(sourceId) || !renderedIds.has(targetId);
  });

  if (ghostLinks.length === 0) return;

  // Create ghost link layer (behind nodes)
  let ghostLinkLayer = g.select('.ghost-links-layer');
  if (ghostLinkLayer.empty()) {
    ghostLinkLayer = g.insert('g', '.nodes-layer').attr('class', 'ghost-links-layer');
  }

  ghostLinks.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    const sourcePos = nodePositions.get(sourceId);
    const targetPos = nodePositions.get(targetId);

    if (sourcePos && targetPos) {
      ghostLinkLayer.append('line')
        .attr('class', 'link ghost-link path-highlight')
        .attr('x1', sourcePos.x)
        .attr('y1', sourcePos.y)
        .attr('x2', targetPos.x)
        .attr('y2', targetPos.y)
        .attr('stroke', 'cyan')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('stroke-opacity', 0.7);
    }
  });
}

/**
 * Apply path highlighting with dimming
 * @param {Set} pathNodes - Set of node IDs in the path
 * @param {Array} pathLinks - Array of link objects in the path
 */
export function applyPathHighlight(pathNodes, pathLinks) {
  const g = d3.select('#tech-tree svg g');
  if (g.empty()) return;

  // Create link ID set for quick lookup
  const linkSet = new Set(pathLinks.map(l => {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return `${sourceId}-${targetId}`;
  }));

  // Dim all non-path techs (except ghost nodes which are already highlighted)
  g.selectAll('.tech-node:not(.ghost-node)')
    .classed('path-dimmed', d => !pathNodes.has(d.id))
    .classed('path-highlight', d => pathNodes.has(d.id));

  // Highlight/dim links (except ghost links)
  g.selectAll('.link:not(.ghost-link)')
    .classed('path-dimmed', d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      return !linkSet.has(`${sourceId}-${targetId}`);
    })
    .classed('path-highlight', d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      return linkSet.has(`${sourceId}-${targetId}`);
    });
}

/**
 * Clear all path highlighting and remove ghost nodes
 */
export function clearPathHighlight() {
  const g = d3.select('#tech-tree svg g');
  if (g.empty()) return;

  // Remove dimming and highlighting classes
  g.selectAll('.tech-node')
    .classed('path-dimmed', false)
    .classed('path-highlight', false);

  g.selectAll('.link')
    .classed('path-dimmed', false)
    .classed('path-highlight', false);

  // Remove ghost nodes and links
  g.selectAll('.ghost-nodes-layer').remove();
  g.selectAll('.ghost-links-layer').remove();
}

/**
 * Main function: Handle hover on a tech node
 * Calculates path, adds ghost nodes if needed, applies highlighting
 * @param {string} hoveredId - ID of hovered tech
 * @param {Object} g - D3 SVG group selection
 * @param {Object} options - Rendering options
 */
export function handleTechHover(hoveredId, g, options = {}) {
  if (!_activeTechId || hoveredId === _activeTechId) {
    return;
  }

  const { nodes, links, missingNodes } = calculatePath(hoveredId, _activeTechId);

  if (nodes.size <= 1) {
    // No path found
    return;
  }

  // Add ghost nodes for missing prerequisites
  if (missingNodes.length > 0) {
    addGhostNodes(missingNodes, g, options);
    addGhostLinks(links, nodes, g);
  }

  // Apply highlighting
  applyPathHighlight(nodes, links);
}

/**
 * Handle mouse leaving a tech node
 */
export function handleTechMouseOut() {
  clearPathHighlight();
}

/**
 * Main function: Handle hover on a tech node (DECOUPLED version)
 * Calculates ALL prerequisites or dependents, adds ghost nodes, applies highlighting
 * @param {string} hoveredId - ID of hovered tech
 * @param {Object} g - D3 SVG group selection
 * @param {Object} options - Rendering options
 */
export function handleTechHoverDecoupled(hoveredId, g, options = {}) {
  if (!hoveredId) {
    return;
  }

  const { nodes, links, missingNodes } = calculateHighlight(hoveredId);

  if (nodes.size <= 1) {
    // Only the hovered node itself, no chain to show
    return;
  }

  // Add ghost nodes for missing techs in the chain
  if (missingNodes.length > 0) {
    addGhostNodes(missingNodes, g, options);
    addGhostLinks(links, nodes, g);
  }

  // Apply highlighting
  applyPathHighlight(nodes, links);
}
