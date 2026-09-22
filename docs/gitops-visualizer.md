# GitOps Cluster Visualizer

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
<strong>🎯 Demonstration Goal:</strong> Visualize the hierarchical relationship between a management cluster and its managed infrastructure nodes.
</div>

## GitOps Reconciliation Controls

Below is an interactive live-canvas visualization rendering infrastructure node states. Each node's color indicates its health status:

- 🟢 **Green**: Healthy - operating normally
- 🔴 **Red**: Degraded - experiencing issues
- 🟠 **Orange**: Suspended - intentionally paused

<div id="d3-cluster-museum-piece" style="width: 100%; min-height: 300px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; margin: 20px 0;"></div>

*Click any node above to inspect its status and configuration.*

## Understanding the Visualization

This tree layout shows:

1. **Management-Cluster** (root node) - The central control plane
2. **Child Clusters** - Various environments managed by the control plane:
   - **ArgoCD-Engine**: The GitOps operator that reconciles desired state
   - **Prod-Cluster-US**: Production environment in US region
   - **Stage-Cluster-EU**: Staging environment in EU region
   - **Dev-Sandbox-1** & **Dev-Sandbox-2**: Development environments

## GitOps Reconciliation Loop

In a GitOps architecture:

1. **Desired State** is defined in Git repositories (Infrastructure as Code)
2. **ArgoCD Engine** continuously monitors Git for changes
3. **Actual State** in clusters is compared against desired state
4. **Drift** is automatically corrected by reconciliation loops
5. **Status** is reported back to the management cluster

## Why This Matters

Traditional imperative deployment models (`kubectl apply`, manual changes) lead to:
- Configuration drift
- Unclear state ownership
- No audit trail
- Manual error recovery

GitOps treats Git as the single source of truth:
- Declarative infrastructure
- Automatic drift correction
- Full audit trail via Git history
- Self-healing systems

## Technical Implementation

This visualization uses:
- **D3.js** tree layout algorithm
- **Hierarchical data structure** representing cluster relationships
- **Dynamic status coloring** based on health metrics
- **Interactive drill-down** for detailed inspection

The tree layout automatically positions nodes to minimize edge crossings and maintain clear parent-child relationships.

---

*Try building your own cluster visualizations by extending the data structure in `docs/js/d3-cluster-visualizer.js`*
