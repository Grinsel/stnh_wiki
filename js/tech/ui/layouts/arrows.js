// Layout adapter: force-directed with arrows
// Migrated from showcase.js with dependency injection for globals

import { createSvgFor, getAreaColor, formatTooltip, updateLOD } from '../../render.js';
import { zoomToFit } from '../zoom.js';

export function renderForceDirectedArrowsGraph(
  nodes,
  links,
  selectedSpecies,
  container,
  deps
) {
  const {
    drag,
    tooltipEl,
    techTreeContainerEl,
    handleNodeSelection,
    updateVisualization,
    activeTechId,
    selectionStartNode,
    selectionEndNode,
  } = deps || {};

  if (!drag || !tooltipEl || !techTreeContainerEl || !handleNodeSelection || !updateVisualization) {
    throw new Error('renderForceDirectedArrowsGraph: missing required dependencies');
  }

  // Defer updater to capture _svg/_g then pick provided or core
  let applyLOD = () => {};
  const { svg: _svg, g: _g, zoom, width, height } = createSvgFor(container, () => applyLOD());
  // Always use shared updateLOD with local svg/g
  applyLOD = () => updateLOD(_svg, _g);

  const defs = _svg.append('defs');
  const gradients = {
    society: ['#3a3a3a', getAreaColor('society')],
    engineering: ['#3a3a3a', getAreaColor('engineering')],
    physics: ['#3a3a3a', getAreaColor('physics')],
  };

  for (const [area, colors] of Object.entries(gradients)) {
    const gradient = defs
      .append('linearGradient')
      .attr('id', `gradient-${area}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', colors[0]);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', colors[1]);
  }

  // flags for lazy creation (layers are created in createSvgFor)
  _g
    .property('labelsInitialized', false)
    .property('tiersInitialized', false)
    .property('linksInitialized', false)
    .property('layout', 'force-directed-arrows')
    .datum({ nodes, links });

    const cx0 = width / 2, cy0 = height / 2;
    const spread = Math.min(width, height) * 0.25;
    for (const n of nodes) {
      if (n.x == null || Number.isNaN(n.x)) n.x = cx0 + (Math.random() - 0.5) * spread;
      if (n.y == null || Number.isNaN(n.y)) n.y = cy0 + (Math.random() - 0.5) * spread;
    }
  

  const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(100).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(80));

  // Avoid blocking the UI at startup: reduce pre-ticks when performance mode is on
  const perfToggle = document.getElementById('performance-toggle');
  const perfOn = !!perfToggle?.checked;
  const preTicks = perfOn ? 15 : 50;
  for (let i = 0; i < preTicks; ++i) simulation.tick();
  // After initial settle, frame all nodes
  zoomToFit(_svg, _g, zoom, nodes, width, height);

  _g
    .select('.links-layer')
    .selectAll('polygon')
    .data(links)
    .join('polygon')
    .attr('class', 'link')
    .attr('fill', '#e0e0e0ff')
    .attr('stroke', 'black')
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.7);

  const nodeWidth = 140,
    nodeHeight = 80;

  const node = _g
    .select('.nodes-layer')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'tech-node')
    .call(drag(simulation))
    .on('mouseover', (event, d) => {
      const tooltipToggle = document.getElementById('tooltip-toggle');
      if (!tooltipToggle || tooltipToggle.checked) {
        tooltipEl.style.display = 'block';
        tooltipEl.innerHTML = formatTooltip(d);
      }
    })
    .on('mousemove', (event) => {
      const treeRect = techTreeContainerEl.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();
      let x = event.clientX + 15;
      let y = event.clientY + 15;
      if (x + tooltipRect.width > treeRect.right) x = event.clientX - tooltipRect.width - 15;
      if (y + tooltipRect.height > treeRect.bottom) y = event.clientY - tooltipRect.height - 15;
      tooltipEl.style.left = `${Math.max(treeRect.left, x)}px`;
      tooltipEl.style.top = `${Math.max(treeRect.top, y)}px`;
    })
    .on('mouseout', () => (tooltipEl.style.display = 'none'))
    .on('click', (event, d) => {
      window.currentFocusId = d.id;
      updateVisualization(selectedSpecies, d.id, true);
    })
    .on('contextmenu', (event, d) => {
      event.preventDefault();
      handleNodeSelection(d);
    });

  node
    .append('circle')
    .attr('class', 'node-circle')
    .attr('r', 30)
    .attr('fill', (d) => getAreaColor(d.area))
    .style('display', 'none');

  node
    .append('rect')
    .attr('class', 'node-rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('x', -nodeWidth / 2)
    .attr('y', -nodeHeight / 2)
    .attr('rx', 10)
    .attr('ry', 10)
    .attr('fill', (d) =>
      d.area === 'society' || d.area === 'engineering' || d.area === 'physics'
        ? `url(#gradient-${d.area})`
        : getAreaColor(d.area)
    )
    .attr('stroke', (d) => {
      if (d.id === activeTechId) return 'yellow';
      if (d.id === selectionStartNode) return 'lime';
      if (d.id === selectionEndNode) return 'red';
      return 'none';
    })
    .attr('stroke-width', (d) =>
      d.id === activeTechId || d.id === selectionStartNode || d.id === selectionEndNode ? 3 : 1
    );

  const maxDistance = Math.min(width, height) * 1.5;
  const center = { x: width / 2, y: height / 2 };
  function boundingForce() {
    for (const node of nodes) {
      const dist = Math.hypot(node.x - center.x, node.y - center.y);
      if (dist > maxDistance) {
        node.vx += (center.x - node.x) * 0.01 * simulation.alpha();
        node.vy += (center.y - node.y) * 0.01 * simulation.alpha();
      }
    }
  }

  let tickCountArrows = 0;
  simulation.on('tick', () => {
    boundingForce();
    // Update any existing links (created lazily)
    _g.select('.links-layer')
      .selectAll('.link')
      .attr('points', (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0)
          return `${d.source.x},${d.source.y} ${d.source.x},${d.source.y} ${d.source.x},${d.source.y}`;
        const nx = dx / length;
        const ny = dy / length;
        const px = -ny;
        const py = nx;
        const baseWidth = 10;
        const halfWidth = nodeWidth / 2;
        const halfHeight = nodeHeight / 2;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let tipX, tipY;
        if (absDx / halfWidth > absDy / halfHeight) {
          const sign = Math.sign(dx);
          tipX = d.target.x - sign * halfWidth;
          tipY = d.target.y - (sign * halfWidth * dy) / dx;
        } else {
          const sign = Math.sign(dy);
          tipY = d.target.y - sign * halfHeight;
          tipX = d.target.x - (sign * halfHeight * dx) / dy;
        }
        const base1X = d.source.x + (px * baseWidth) / 2;
        const base1Y = d.source.y + (py * baseWidth) / 2;
        const base2X = d.source.x - (px * baseWidth) / 2;
        const base2Y = d.source.y - (py * baseWidth) / 2;
        return `${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`;
      });
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    // Periodically refresh LOD so moving nodes update visibility without zoom
    tickCountArrows += 1;
    if (tickCountArrows % 15 === 0) applyLOD();
    if (tickCountArrows > 60 && simulation.alpha() < 0.03) {
      simulation.stop();
      applyLOD();
    }
  });

  // Apply initial LOD after setting initial transform
  applyLOD();

  return { svg: _svg, g: _g, zoom: zoom };
}
