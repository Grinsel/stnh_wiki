// Factory to create a node selection handler with injected state accessors
// Usage:
//   const handleNodeSelection = createHandleNodeSelection({ getG, getActiveTechId, getSelection, setSelection })
//   node.on('click', (e,d) => handleNodeSelection(d))
export function createHandleNodeSelection({ getG, getActiveTechId, getSelection, setSelection }) {
  return function handleNodeSelection(d) {
    const { selectionStartNode, selectionEndNode } = getSelection();

    let start = selectionStartNode;
    let end = selectionEndNode;

    if (!start) {
      start = d.id; end = null;
    } else if (!end) {
      end = d.id;
    } else {
      start = d.id; end = null;
    }

    setSelection(start, end);

    const g = getG();
    const activeTechId = getActiveTechId();

    if (g) {
      g.selectAll('.tech-node rect').attr('stroke', (nodeData) => {
        if (nodeData.id === start) return 'lime';
        if (nodeData.id === end) return 'red';
        if (nodeData.id === activeTechId) return 'yellow';
        return 'none';
      });
    }

    const renderPathButton = document.getElementById('render-path-button');
    if (renderPathButton) {
      if (start) {
        renderPathButton.style.display = 'inline-block';
        renderPathButton.textContent = end ? 'Show Research Path' : 'Show Required Research';
      } else {
        renderPathButton.style.display = 'none';
      }
    }
  };
}
