// Compute tier-based positions for a list of nodes
export function layoutByTier(nodesArr, width, height, { nodeWidth, nodeHeight }, { padX = 70, padY = 40 } = {}) {
  const tiers = {};
  const tierPositions = {};
  for (const node of nodesArr) {
    const tier = node.tier || 0;
    if (!tiers[tier]) {
      tiers[tier] = [];
    }
    tiers[tier].push(node);
  }

  const tierKeys = Object.keys(tiers).map(Number).sort((a, b) => a - b);
  const numTiers = tierKeys.length;
  // Allow layout to expand beyond viewport width if necessary
  const tierWidth = nodeWidth; 
  const totalLayoutWidth = numTiers * tierWidth + Math.max(0, numTiers - 1) * padX;
  const startX = (width - totalLayoutWidth) / 2;

  for (let i = 0; i < tierKeys.length; i++) {
    const tier = tierKeys[i];
    const tierNodes = tiers[tier];
    const tierX = startX + i * (tierWidth + padX) + tierWidth / 2;
    tierPositions[tier] = tierX;

    // Calculate total height dynamically to prevent overlaps
    const totalTierHeight =
      tierNodes.reduce((acc, node) => acc + (node.height || nodeHeight), 0) +
      Math.max(0, tierNodes.length - 1) * padY;
    const startY = (height - totalTierHeight) / 2;

    let currentY = startY;
    for (const node of tierNodes) {
      const currentNodeHeight = node.height || nodeHeight;
      node.x = tierX;
      node.y = currentY + currentNodeHeight / 2;
      currentY += currentNodeHeight + padY;
    }
  }
  return tierPositions;
}
