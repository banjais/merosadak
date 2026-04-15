export type RoadNode = {
  id: string;
  name: string;
  district: string;
  connections: string[];
};

export class NationalRoadGraph {
  nodes: Record<string, RoadNode> = {};

  addNode(node: RoadNode) {
    this.nodes[node.id] = node;
  }

  getNeighbors(id: string) {
    return this.nodes[id]?.connections.map((c) => this.nodes[c]) || [];
  }

  // simulate network impact
  propagateImpact(startId: string, depth = 2) {
    const visited = new Set<string>();
    const affected: string[] = [];

    const dfs = (id: string, d: number) => {
      if (!id || visited.has(id) || d > depth) return;

      visited.add(id);
      affected.push(id);

      const neighbors = this.getNeighbors(id);
      neighbors.forEach((n) => dfs(n.id, d + 1));
    };

    dfs(startId, 0);
    return affected;
  }
}

export const roadGraph = new NationalRoadGraph();