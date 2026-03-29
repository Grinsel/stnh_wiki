// Layout adapter: disjoint force-directed
// Migrated from showcase.js with dependency injection

import { createSvgFor, getAreaColor, formatTooltip, updateLOD } from '../../render.js';
import { zoomToFit } from '../zoom.js';

export function renderDisjointForceDirectedGraph(nodes, links, selectedSpecies, container, deps) {
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
    throw new Error('renderDisjointForceDirectedGraph: missing required dependencies');
  }

  // Defer updater so we can capture _svg/_g
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

  _g
    .property('labelsInitialized', false)
    .property('tiersInitialized', false)
    .property('linksInitialized', false)
    .property('layout', 'disjoint-force-directed')
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
    .force('charge', d3.forceManyBody().strength(-300))
    .force('x', d3.forceX(width / 2).strength(0.1))
    .force('y', d3.forceY(height / 2).strength(0.1))
    .force('collision', d3.forceCollide().radius(60));

  // Avoid blocking the UI at startup: reduce pre-ticks when performance mode is on
  const perfToggle = document.getElementById('performance-toggle');
  const perfOn = !!perfToggle?.checked;
  const preTicks = perfOn ? 50 : 200;
  for (let i = 0; i < preTicks; ++i) simulation.tick();

  // After initial settle, frame all nodes within the viewport
  zoomToFit(_svg, _g, zoom, nodes, width, height, 300, 0.02, 2);

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

  const nodeWidth = 120,
    nodeHeight = 70;

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
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('fill', (d) => (d.area ? `url(#gradient-${d.area})` : getAreaColor(d.area)))
    .attr('stroke', (d) => {
      if (d.id === activeTechId) return 'yellow';
      if (d.id === selectionStartNode) return 'lime';
      if (d.id === selectionEndNode) return 'red';
      return 'none';
    })
    .attr('stroke-width', (d) =>
      d.id === activeTechId || d.id === selectionStartNode || d.id === selectionEndNode ? 3 : 1
    );

  // Tier indicators and labels are created by updateLOD()

  const maxDistanceDJ = Math.min(width, height) * 1.5;
  const centerDJ = { x: width / 2, y: height / 2 };
  function boundingForceDJ() {
    for (const node of nodes) {
      const dist = Math.hypot(node.x - centerDJ.x, node.y - centerDJ.y);
      if (dist > maxDistanceDJ) {
        node.vx += (centerDJ.x - node.x) * 0.01 * simulation.alpha();
        node.vy += (centerDJ.y - node.y) * 0.01 * simulation.alpha();
      }
    }
  }

  let tickCountDisjoint = 0;
  simulation.on('tick', () => {
    boundingForceDJ();
    _g
      .select('.links-layer')
      .selectAll('.link')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    if (++tickCountDisjoint % 15 === 0) applyLOD();
    if (tickCountDisjoint > 80 && simulation.alpha() < 0.03) {
      simulation.stop();
      applyLOD();
    }
  });

  applyLOD();

  return { svg: _svg, g: _g, zoom: zoom };
}
