// Zoom utilities
// Provides zoomToFit used by showcase and search

export function zoomToFit(svg, g, zoom, nodes, width, height, padding = 60, minScale = 0.02, maxScale = 2) {
  if (!nodes || nodes.length === 0) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x;
    if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y;
  }
  if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const scale = Math.max(minScale, Math.min(maxScale, Math.min(
    (width - 2 * padding) / w,
    (height - 2 * padding) / h
  )));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const t = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(scale)
    .translate(-cx, -cy);
  svg.transition().duration(300).call(zoom.transform, t);
}

export function zoomByFactor(svg, zoom, factor) {
    if (!svg || !zoom) return;
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const transform = d3.zoomTransform(svg.node());
    const newScale = transform.k * factor;
  
    // Center of the viewport
    const centerX = width / 2;
    const centerY = height / 2;
  
    // Translate so the center of the view remains the center
    const newX = centerX - (centerX - transform.x) * factor;
    const newY = centerY - (centerY - transform.y) * factor;
  
    const newTransform = d3.zoomIdentity.translate(newX, newY).scale(newScale);
  
    svg.transition().duration(200).call(zoom.transform, newTransform);
}
