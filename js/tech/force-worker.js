// Force simulation Web Worker — runs D3 force layout off the main thread.
// Imported as an ES module worker from the layout adapters.
import * as d3 from 'https://d3js.org/d3.v7.min.js';

self.onmessage = function ({ data }) {
    const { nodes, links, width, height, config = {} } = data;
    const {
        linkDistance   = 100,
        linkStrength   = 0.5,
        chargeStrength = -250,
        collideRadius  = 80,
        forceXStrength = 0,
        forceYStrength = 0,
        numTicks       = 50,
    } = config;

    // Rebuild link source/target node references from plain IDs
    const nodeMap      = new Map(nodes.map(n => [n.id, n]));
    const resolvedLinks = links.map(l => ({
        source: nodeMap.get(l.source) ?? l.source,
        target: nodeMap.get(l.target) ?? l.target,
    }));

    const sim = d3.forceSimulation(nodes)
        .force('link',      d3.forceLink(resolvedLinks).id(d => d.id)
                               .distance(linkDistance).strength(linkStrength))
        .force('charge',    d3.forceManyBody().strength(chargeStrength))
        .force('center',    d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(collideRadius))
        .stop(); // Run manually, not via requestAnimationFrame

    if (forceXStrength) sim.force('x', d3.forceX(width / 2).strength(forceXStrength));
    if (forceYStrength) sim.force('y', d3.forceY(height / 2).strength(forceYStrength));

    for (let i = 0; i < numTicks; i++) sim.tick();

    self.postMessage({
        positions: nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
    });
};
