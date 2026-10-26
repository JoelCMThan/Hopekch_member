const config = require('../../../config/ragConfig');
const { select } = require('./rdfClient');
const { NS, GRAPH_URI, uriForId, idFromUri, predicate } = require('./rdfBuilder');

const allowedUri = uri => String(uri).startsWith(`${NS}resource/`);

const traverseRdf = async (nodeIds, options = {}) => {
  const maxHops = Math.min(4, Math.max(1, Number(options.maxHops || config.rdfMaxHops)));
  const limit = Math.min(100, Math.max(1, Number(options.limit || config.rdfResultLimit)));
  const starts = [...new Set(nodeIds.map(uriForId))];
  let frontier = starts;
  const visited = new Set(starts);
  const paths = starts.map(uri => ({ uris: [uri], relationships: [] }));
  let currentPaths = paths;
  const predicates = ['hasColumn', 'references', 'relatesTo'].map(name => `<${predicate(name)}>`).join(', ');

  for (let hop = 1; hop <= maxHops && frontier.length && paths.length < limit; hop++) {
    const values = frontier.filter(allowedUri).map(uri => `<${uri}>`).join(' ');
    if (!values) break;
    const bindings = await select(`SELECT ?seed ?p ?next WHERE {
      GRAPH <${GRAPH_URI}> {
        VALUES ?seed { ${values} }
        { ?seed ?p ?next } UNION { ?next ?p ?seed }
        FILTER(?p IN (${predicates}))
      }
    } LIMIT ${limit}`);
    const nextFrontier = [];
    const nextPaths = [];
    for (const binding of bindings) {
      const seed = binding.seed?.value;
      const next = binding.next?.value;
      const relation = binding.p?.value;
      if (!allowedUri(seed) || !allowedUri(next)) continue;
      const bases = currentPaths.filter(path => path.uris[path.uris.length - 1] === seed);
      for (const base of bases) {
        if (base.uris.includes(next) || paths.length >= limit) continue;
        const path = { uris: [...base.uris, next], relationships: [...base.relationships, relation.slice(NS.length)], hops: hop };
        paths.push(path);
        nextPaths.push(path);
      }
      if (!visited.has(next)) { visited.add(next); nextFrontier.push(next); }
    }
    frontier = [...new Set(nextFrontier)];
    currentPaths = nextPaths;
  }

  return paths.slice(0, limit).map(path => ({
    nodes: path.uris.map(uri => ({ id: idFromUri(uri), uri })),
    relationships: path.relationships.map(type => ({ type })),
    hops: path.hops || 0
  }));
};

module.exports = { traverseRdf, allowedUri };
