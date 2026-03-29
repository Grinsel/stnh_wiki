// Compute simple centered grid positions for a list of nodes
// Usage: import { layoutAsGrid } from './ui/grid.js'
export function layoutAsGrid(nodesArr, width, { nodeWidth, nodeHeight }, { padX = 30, padY = 30 } = {}) {
  const nodesPerRow = Math.max(1, Math.floor(width / (nodeWidth + padX)));
  for (let i = 0; i < nodesArr.length; i++) {
    const rowIndex = Math.floor(i / nodesPerRow);
    const nodeIndex = i % nodesPerRow;
    const rowCount = Math.min(nodesPerRow, nodesArr.length - rowIndex * nodesPerRow);
    const rowWidth = rowCount * (nodeWidth + padX) - padX;
    const startX = (width - rowWidth) / 2;
    nodesArr[i].x = startX + nodeIndex * (nodeWidth + padX) + nodeWidth / 2;
    nodesArr[i].y = padY + rowIndex * (nodeHeight + padY) + nodeHeight / 2;
  }
}
