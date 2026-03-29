// Renders a small force-directed popup graph with tooltips
// Usage: import { renderPopupGraph } from './ui/popup.js'
// renderPopupGraph(nodes, links, { containerEl, tooltipEl, techTreeContainerEl, drag })
import { wrapText, getAreaColor } from '../render.js';
import { layoutByTier } from './layouts/tier.js';

export function renderPopupGraph(nodes, links, { containerEl, tooltipEl, techTreeContainerEl, drag }) {
  const container = containerEl;
  const tooltip = tooltipEl;
  const techTreeContainer = techTreeContainerEl;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const popupSvg = d3.select(container).append('svg').attr('width', width).attr('height', height);
  const popupG = popupSvg.append('g');
  const zoom = d3.zoom().on('zoom', (event) => popupG.attr('transform', event.transform));
  popupSvg.call(zoom);

  const nodeWidth = 140, nodeHeight = 80;
  layoutByTier(nodes, width, height, { nodeWidth, nodeHeight });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  links.forEach(link => {
    link.source = nodeMap.get(link.source) || link.source;
    link.target = nodeMap.get(link.target) || link.target;
  });

  const link = popupG.append('g')
    .attr('stroke', '#e0e0e0ff')
    .attr('stroke-opacity', 0.5)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  const node = popupG.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'tech-node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('mouseover', (event, d) => {
      tooltip.style.display = 'block';
      tooltip.innerHTML = formatTooltip(d);
      tooltip.style.zIndex = 1000;
    })
    .on('mousemove', (event) => {
      const treeRect = techTreeContainer.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      let x = event.clientX + 15;
      let y = event.clientY + 15;
      if (x + tooltipRect.width > treeRect.right) x = event.clientX - tooltipRect.width - 15;
      if (y + tooltipRect.height > treeRect.bottom) y = event.clientY - tooltipRect.height - 15;
      tooltip.style.left = `${Math.max(treeRect.left, x)}px`;
      tooltip.style.top = `${Math.max(treeRect.top, y)}px`;
    })
    .on('mouseout', () => {
      tooltip.style.display = 'none';
      tooltip.style.zIndex = '';
    });

  node.append('rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('x', -nodeWidth / 2)
    .attr('y', -nodeHeight / 2)
    .attr('rx', 10)
    .attr('ry', 10)
    .attr('fill', d => getAreaColor(d.area));

  const stripeWidth = 8; const cornerRadius = 10;
  const x0 = -nodeWidth / 2; const y0 = -nodeHeight / 2;
  const x1 = -nodeWidth / 2 + stripeWidth; const y1 = nodeHeight / 2; const r = cornerRadius;
  const pathData = `M ${x0},${y0 + r} A ${r},${r} 0 0 1 ${x0 + r},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0 + r},${y1} A ${r},${r} 0 0 1 ${x0},${y1 - r} Z`;

  const tierIndicator = node.append('g');
  tierIndicator.append('path').attr('d', pathData).attr('fill', 'white');

  tierIndicator.each(function(d) {
    const tier = parseInt(d.tier) || 0;
    if (tier > 0) {
      const g = d3.select(this);
      const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
      g.append('defs').append('clipPath').attr('id', clipId).append('path').attr('d', pathData);
      const stripes = g.append('g').attr('clip-path', `url(#${clipId})`);
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

  const nodeTextWidth = nodeWidth - 8 - 16;
  const nameText = node.append('text')
    .attr('class', 'node-label node-name')
    .attr('x', 0)
    .attr('y', -nodeHeight / 2 + 14)
    .attr('text-anchor', 'middle')
    .style('font-weight', 'bold')
    .style('fill', '#ffffff')
    .text(d => d.name || d.id);
  wrapText(nameText, nodeTextWidth, 12, 2);

  node.append('text')
    .attr('class', 'node-label node-area')
    .attr('x', 0)
    .attr('y', d => {
      const lines = d && d._nameLineCount ? d._nameLineCount : 1;
      return -nodeHeight / 2 + 30 + (lines - 1) * 12;
    })
    .attr('text-anchor', 'middle')
    .style('fill', '#ffffff')
    .text(d => `${d.area || 'N/A'}`);

  node.append('text')
    .attr('class', 'node-label node-species')
    .attr('x', 0)
    .attr('y', d => {
      const lines = d && d._nameLineCount ? d._nameLineCount : 1;
      return -nodeHeight / 2 + 45 + (lines - 1) * 12;
    })
    .attr('text-anchor', 'middle')
    .style('font-size', '8px')
    .style('fill', '#ffffff')
    .text(d => (d.required_species && d.required_species.length > 0) ? d.required_species.join(', ') : 'Global');
}

// Inline copy of formatTooltip to avoid tight coupling. If you prefer, you can pass it in deps.
function formatTooltip(d) {
  let info = '';
  const excludeKeys = new Set(['x', 'y', 'vx', 'vy', 'index', 'fx', 'fy']);
  for (const key in d) {
    if (Object.prototype.hasOwnProperty.call(d, key) && d[key] && !excludeKeys.has(key)) {
      info += `<strong>${key}:</strong> ${Array.isArray(d[key]) ? d[key].join(', ') : d[key]}<br>`;
    }
  }
  return info;
}
