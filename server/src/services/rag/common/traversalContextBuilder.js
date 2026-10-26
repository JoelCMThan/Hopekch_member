const buildTraversalContext = (retrievedNodes, paths) => {
  const descriptions = new Map();
  for (const node of retrievedNodes) descriptions.set(node.nodeId, node.text);
  for (const path of paths) for (const node of path.nodes) {
    if (node?.id && node.description) descriptions.set(node.id, node.description);
  }
  const relationshipLines = new Set();
  for (const path of paths) {
    const nodeNames = path.nodes.map(node => node.id).join(' -> ');
    const relNames = path.relationships.map(rel => rel.type).join(', ');
    if (nodeNames) relationshipLines.add(`Path (${relNames || 'same node'}): ${nodeNames}`);
  }
  return [
    'Relevant schema entities:', ...[...descriptions].map(([id, text]) => `- ${id}: ${text}`),
    '', 'Verified traversal paths:', ...[...relationshipLines].map(line => `- ${line}`)
  ].join('\n');
};

module.exports = { buildTraversalContext };
