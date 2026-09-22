# Hybrid Architecture Proposal
**Status**: Draft / Work in Progress  
**Created**: 2026-09-23  
**Purpose**: Enable API-backed exhibits for real infrastructure demonstrations

## Vision

Extend the Museum of Arcane Curiosities from pure static exhibits to support **optional** API-backed demonstrations that interact with real infrastructure (K8s, GitOps, Proxmox, etc.).

### Goals
- Keep existing static exhibits unchanged
- Add capability for "live" infrastructure demonstrations
- Maintain Docker packaging
- Start personal/local, evolve toward public later
- Stateless and auth-less initially (add later as needed)

### Non-Goals (for now)
- Authentication/authorization (future)
- Multi-tenancy (future)
- Production-grade reliability (future)
- Complex state management (future)

## Current vs Future

### Current: Pure Static
```
┌─────────────────┐
│   Browser       │
│  ┌───────────┐  │
│  │ MkDocs    │  │
│  │ Site      │  │
│  │           │  │
│  │ D3.js     │  │
│  │ Exhibits  │  │
│  └───────────┘  │
└─────────────────┘
```

**Characteristics:**
- All computation in browser
- No backend required
- localStorage for user data
- Fully portable (Docker, static hosting)

### Proposed: Hybrid Architecture
```
┌─────────────────┐          ┌──────────────┐          ┌─────────────┐
│   Browser       │          │ Museum API   │          │ Proxmox     │
│  ┌───────────┐  │  HTTP    │              │  SSH/API │             │
│  │ Static    │  │  REST    │ ┌──────────┐ │          │ ┌─────────┐ │
│  │ Exhibits  │  │◄────────►│ │  Node.js │ │◄────────►│ │   K8s   │ │
│  └───────────┘  │          │ │  Server  │ │          │ │ Cluster │ │
│  ┌───────────┐  │          │ └──────────┘ │          │ └─────────┘ │
│  │ API       │  │  WS      │              │          │             │
│  │ Exhibits  │  │◄────────►│ ┌──────────┐ │          │ ┌─────────┐ │
│  └───────────┘  │          │ │WebSocket │ │          │ │ ArgoCD  │ │
└─────────────────┘          │ │  Server  │ │          │ └─────────┘ │
                             │ └──────────┘ │          └─────────────┘
                             └──────────────┘
```

**New Capabilities:**
- Deploy ephemeral K8s clusters
- Watch real GitOps reconciliation
- Visualize distributed system behavior
- Interactive infrastructure control

## Architecture Components

### 1. Museum API Service

**Technology**: Node.js/Express (or Python/FastAPI)

**Responsibilities:**
- REST API for infrastructure operations
- WebSocket server for live updates
- Resource lifecycle management
- Proxmox interaction layer

**Key Endpoints (draft)**:
```
POST   /api/demos/:type/start          Start a demo instance
GET    /api/demos/:demoId/status       Get current status
DELETE /api/demos/:demoId              Cleanup demo
WS     /api/demos/:demoId/stream       Live event stream
GET    /api/demos/:type/available      Check if infrastructure is available
```

**Example Response**:
```json
{
  "demoId": "gitops-abc123",
  "type": "gitops-reconciliation",
  "status": "running",
  "wsUrl": "ws://localhost:5000/api/demos/gitops-abc123/stream",
  "expiresAt": "2026-09-23T15:30:00Z",
  "endpoints": {
    "argocd": "https://argocd-abc123.museum.local",
    "k8s": "https://k8s-abc123.museum.local"
  }
}
```

### 2. Client-Side Integration

**Pattern**: Progressive enhancement

Static exhibits work as-is. API exhibits check availability:

```javascript
// In exhibit JavaScript
document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("gitops-demo");
    if (!container) return;
    
    // Try to connect to API
    const apiAvailable = await checkAPI();
    
    if (apiAvailable) {
        // Initialize live demo
        initLiveGitOpsDemo(container);
    } else {
        // Fallback to simulated demo
        initSimulatedGitOpsDemo(container);
    }
});

async function checkAPI() {
    try {
        const response = await fetch('/api/demos/gitops/available');
        return response.ok;
    } catch (error) {
        return false; // API not available, use simulation
    }
}
```

### 3. Infrastructure Layer (Proxmox)

**Capabilities needed:**
- Spin up VMs for K8s nodes
- Provision K8s cluster (k3s? kind?)
- Install ArgoCD
- Create sample GitOps repositories
- Teardown after timeout

**Tools:**
- Terraform for infrastructure provisioning
- Ansible for configuration
- Proxmox API for VM management

### 4. Demo Lifecycle Management

**State tracking**:
```javascript
{
  demoId: "unique-id",
  type: "gitops-reconciliation",
  status: "running" | "starting" | "stopping" | "error",
  startedAt: timestamp,
  expiresAt: timestamp,
  resources: {
    vmIds: [101, 102, 103],
    k8sClusterId: "cluster-abc",
    argoCdUrl: "https://..."
  }
}
```

**Lifecycle**:
1. User clicks "Start Demo"
2. API provisions infrastructure (may take 2-5 minutes)
3. WebSocket streams progress updates
4. Demo runs for N minutes (timeout)
5. Auto-cleanup or manual cleanup

**Cleanup strategies**:
- Auto-expire after timeout (e.g., 30 minutes)
- Cron job sweeps old demos
- Resource limits (max N concurrent demos)

## Deployment Scenarios

### Scenario A: Local Development
```
docker-compose.yml:
  - museum-static (nginx)
  - museum-api (node.js)
  - proxmox (external, referenced by config)
```

**Benefits**: Easy testing, full control  
**Drawbacks**: Requires local Proxmox or mock

### Scenario B: Personal Server
```
Server with:
  - Proxmox host
  - Docker container: museum-static
  - Docker container: museum-api
  - Local network only
```

**Benefits**: Real infrastructure, personal use  
**Drawbacks**: Single user, no auth needed yet

### Scenario C: Public (Future)
```
Public facing:
  - Static site on CDN/Netlify
  - API behind authentication
  - Rate limiting
  - Queue management
```

**Benefits**: Shareable demos  
**Drawbacks**: Need auth, security, resource limits

## Docker Packaging Strategy

### Option 1: Separate Containers (Recommended)
```yaml
# docker-compose.yml
services:
  museum:
    build: .
    ports:
      - "8080:80"
    # Pure static museum

  museum-api:
    build: ./api
    ports:
      - "5000:5000"
    environment:
      - PROXMOX_HOST=${PROXMOX_HOST}
      - PROXMOX_TOKEN=${PROXMOX_TOKEN}
    # Optional API service
```

**Benefits**:
- Static museum works independently
- API is optional add-on
- Can deploy separately
- Clear separation of concerns

### Option 2: Monolithic Container
```dockerfile
# Single container with both static + API
FROM nginx:alpine
COPY site/ /usr/share/nginx/html/
COPY api/ /app/api/
# Run both nginx and node in same container
```

**Benefits**: Single deployment unit  
**Drawbacks**: Couples components, harder to scale

**Recommendation**: Start with Option 1

## Example Exhibit: GitOps Reconciliation Loop

### User Experience
1. Visit `/gitops-visualizer/` page
2. See simulated demo by default
3. Button: "🚀 Launch Live Demo" (if API available)
4. Click → provisioning starts (progress bar)
5. Once ready → real-time visualization of:
   - Git commit pushed
   - ArgoCD detects change
   - Kubernetes resources update
   - State converges
6. User can modify Git repo, watch reconciliation
7. Demo auto-expires after 30 minutes

### Technical Flow
```javascript
async function startLiveDemo() {
    // 1. Request demo instance
    const response = await fetch('/api/demos/gitops/start', {
        method: 'POST'
    });
    const { demoId, wsUrl } = await response.json();
    
    // 2. Show progress
    showProgress("Provisioning K8s cluster...");
    
    // 3. Connect WebSocket for updates
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
        const { type, data } = JSON.parse(event.data);
        
        switch(type) {
            case 'progress':
                updateProgress(data.message);
                break;
            case 'ready':
                hideProgress();
                initVisualization(data);
                break;
            case 'git-commit':
                animateGitChange(data);
                break;
            case 'argocd-sync':
                animateArgoSync(data);
                break;
            case 'k8s-update':
                updateClusterState(data);
                break;
        }
    };
    
    // 4. Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        fetch(`/api/demos/${demoId}`, { method: 'DELETE' });
    });
}
```

## Security Considerations (Future)

### Phase 1: Personal (Current Proposal)
- No authentication
- Local network only
- Single user assumed
- Stateless API

### Phase 2: Semi-Public
- Simple API key
- Rate limiting per IP
- Resource quotas
- No sensitive data exposed

### Phase 3: Public
- OAuth/JWT authentication
- User accounts
- Per-user resource limits
- Audit logging
- Network isolation per demo

## Resource Management

### Constraints
- Proxmox capacity: N VMs max
- Concurrent demos: M max
- Demo duration: 30 minutes max
- Queue: First-come-first-served

### Strategies
- Check availability before starting
- Show "queue position" if at capacity
- Auto-cleanup expired demos
- Graceful degradation (fall back to simulation)

## Open Questions

1. **Proxmox networking**: How do demo VMs get routable IPs? NAT? VPN?
2. **K8s flavor**: k3s (lightweight), kind (Docker-in-Docker), full k8s?
3. **GitOps repo**: Ephemeral per demo, or shared with branches?
4. **Cost**: What's the resource cost per demo? (CPU, RAM, storage)
5. **Failure handling**: What if Proxmox is down? VM provision fails?
6. **User notifications**: Email when demo ready? Browser notification?
7. **Data persistence**: Do we keep any demo data? Logs? Metrics?

## Implementation Phases

### Phase 0: Foundation (Current)
- ✅ Static museum working
- ✅ Docker packaging
- ✅ Documentation

### Phase 1: API Skeleton
- [ ] Basic Node.js API server
- [ ] Health check endpoint
- [ ] Mock demo start/stop (no real infrastructure)
- [ ] WebSocket echo server
- [ ] Client-side integration with fallback

### Phase 2: Proxmox Integration
- [ ] Terraform scripts for VM provisioning
- [ ] Ansible playbooks for K8s setup
- [ ] API calls Terraform/Ansible
- [ ] Demo lifecycle management
- [ ] Auto-cleanup

### Phase 3: First Live Exhibit
- [ ] GitOps reconciliation loop
- [ ] Real K8s cluster provisioned
- [ ] ArgoCD installed and configured
- [ ] Sample app deployed
- [ ] Live visualization working

### Phase 4: Polish
- [ ] Better progress indicators
- [ ] Error handling
- [ ] Resource limits
- [ ] Documentation
- [ ] Demo timeout warnings

### Phase 5: Additional Exhibits
- [ ] K8s pod scheduling visualizer
- [ ] Network policy demonstrator
- [ ] Distributed tracing demo
- [ ] Chaos engineering scenarios

## Configuration

**Example `api/config.yml`**:
```yaml
proxmox:
  host: 192.168.1.100
  port: 8006
  token: ${PROXMOX_TOKEN}
  node: pve
  
demos:
  gitops:
    enabled: true
    vm_count: 3
    timeout_minutes: 30
    k8s_flavor: k3s
    
  chaos:
    enabled: false
    
limits:
  max_concurrent_demos: 5
  max_queue_size: 10
  demo_max_duration: 3600  # seconds
  
websocket:
  port: 5000
  heartbeat_interval: 30
```

## Alternatives Considered

### Alternative 1: No API, Use Cloud Providers
- Provision K8s on AWS/GCP/Azure instead
- Use Terraform Cloud or similar
- **Pros**: Don't need Proxmox, more reliable
- **Cons**: Cost per demo, slower, less control

### Alternative 2: Kubernetes-in-Browser
- Use WebAssembly to run K8s in browser
- Pure client-side simulation
- **Pros**: No infrastructure needed
- **Cons**: Not "real", limited fidelity

### Alternative 3: Recorded Demos
- Pre-record infrastructure interactions
- Play back as videos/animations
- **Pros**: Zero runtime cost
- **Cons**: Not interactive, stale

**Conclusion**: Hybrid approach (static + optional API) gives best balance.

## Success Metrics

For Phase 3 (first live exhibit):
- Demo provision time < 5 minutes
- Demo reliability > 90%
- Clean teardown > 95%
- User can trigger GitOps sync successfully
- Visualization updates in < 1 second

## Next Steps

1. **Validate assumptions**:
   - Can Proxmox handle this workload?
   - What's the actual provision time?
   - Network routing feasible?

2. **Prototype Phase 1**:
   - Basic API server
   - Mock endpoints
   - Client integration

3. **Manual testing**:
   - Manually provision a K8s cluster
   - Time the process
   - Document steps
   - Identify pain points

4. **Iterate on proposal** based on learnings

## References

- Proxmox API: https://pve.proxmox.com/pve-docs/api-viewer/
- k3s: https://k3s.io/
- ArgoCD: https://argo-cd.readthedocs.io/
- Terraform Proxmox provider: https://registry.terraform.io/providers/Telmate/proxmox/latest/docs

---

**This is a living document. Update as we learn and build.**
