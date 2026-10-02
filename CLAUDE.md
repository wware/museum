# Museum of Arcane Curiosities - Development Guide

## Philosophy

This isn't documentation, it's a **museum**. Each exhibit should:
- Demonstrate a concept through interaction, not explanation
- Teach better than static text ever could
- Invite exploration and experimentation
- Be self-contained and client-side (for now - see HYBRID_ARCHITECTURE.md for future plans)

**Rule of thumb**: If it can be fully explained in text alone, it's probably not a museum piece.

## Architecture

### Current: TypeScript + Static Site
- Written in **TypeScript** (`src/`) compiled to JavaScript (`docs/js/`)
- All exhibits run in the browser (TypeScript + D3.js)
- No backend, no state, no authentication
- Fully portable: Docker container or static hosting
- Bookmarking and notes via localStorage

**TypeScript Benefits:**
- Type safety catches errors at compile time
- Better IDE autocomplete and refactoring
- Proper D3.js type definitions
- Modern ES6+ features with type checking

### Future: Hybrid (Proposal)
See `HYBRID_ARCHITECTURE.md` for plans to add optional API-backed exhibits for real infrastructure demonstrations.

## Adding a New Exhibit

### 1. Create the Content

**Markdown file** in `docs/`:
```markdown
# Your Exhibit Title

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
<strong>🎯 Demonstration Goal:</strong> What this exhibit teaches
</div>

## The Concept
Background and theory...

## Interactive Demonstration
<div id="your-exhibit-container" style="width: 100%; min-height: 300px;"></div>

**Interaction Tips:**
- How to use the exhibit
- What to try
- What to observe
```

### 2. Create the TypeScript Code (if needed)

**TypeScript file** in `src/your-exhibit.ts`:

```typescript
// D3 is loaded globally via CDN - type definitions available
import type * as d3Types from "d3";

// === TYPE DEFINITIONS ===
interface YourDataStructure {
    name: string;
    value: number;
}

// CRITICAL: Wrap everything in DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    // CRITICAL: Check if container exists (JS loads on every page)
    const container = document.getElementById("your-exhibit-container");
    if (!container) return; // Exit if not on this exhibit's page

    // Now initialize your visualization with type safety
    const width: number = container.clientWidth || 700;
    const height: number = 400;
    
    const svg = d3.select(container)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);
    
    // Your visualization code here with full type checking...
    
}); // Don't forget to close the DOMContentLoaded wrapper!
```

**Compile TypeScript:**
```bash
npm run build          # One-time compilation
# OR
npm run watch          # Auto-compile on file changes
```

### 3. Register in Configuration

**Add to `mkdocs.yml`**:

```yaml
# Add to nav section
nav:
  - Home: index.md
  - Demonstrations:
      - Your Exhibit: your-exhibit.md  # Add here

# Add compiled JavaScript to extra_javascript (if needed)
extra_javascript:
  - https://d3js.org/d3.v7.min.js
  - js/your-exhibit.js  # Compiled from src/your-exhibit.ts
```

### 4. Test

```bash
npm run build      # Compile TypeScript first
mkdocs serve       # Start development server
# Visit http://localhost:8000/your-exhibit/
```

**Or use Makefile shortcuts:**
```bash
make ts-build      # Compile TypeScript
make run           # Compile + serve (auto-compiles)
make ts-watch      # Watch mode - auto-compile on changes
```

Check:
- ✅ TypeScript compiles without errors
- ✅ Visualization appears
- ✅ Interaction works (drag, click, etc.)
- ✅ No console errors (F12 → Console)
- ✅ Works in dark mode
- ✅ Bookmarking and notes work
- ✅ No errors when visiting other pages (JS should exit gracefully)

## Common Pitfalls & Solutions

### ❌ Problem: JavaScript runs but nothing appears
**Cause**: Container check missing or selector wrong
```javascript
// BAD - will error on pages without the container
const svg = d3.select("#my-container").append("svg");

// GOOD - checks first, exits gracefully
const container = document.getElementById("my-container");
if (!container) return;
const svg = d3.select(container).append("svg");
```

### ❌ Problem: Works standalone but not in MkDocs
**Cause**: JavaScript not wrapped in `DOMContentLoaded`
```javascript
// BAD - runs immediately, DOM might not be ready
const container = document.getElementById("my-container");

// GOOD - waits for DOM
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("my-container");
});
```

### ❌ Problem: 404 when loading JavaScript
**Cause**: Filename mismatch (hyphen vs underscore)

**Convention**: Use hyphens in filenames to match web URLs
- ✅ `mass-spring.js` in `docs/js/`
- ✅ `js/mass-spring.js` in `mkdocs.yml`
- ❌ `mass_spring.js` (underscores don't match URL conventions)

### ❌ Problem: D3.js not defined
**Cause**: Script loads before D3.js

**Solution**: Ensure D3.js is listed first in `extra_javascript`:
```yaml
extra_javascript:
  - https://d3js.org/d3.v7.min.js  # Must be first!
  - js/your-exhibit.js              # Your scripts after
```

### ❌ Problem: Exhibit breaks on other pages
**Cause**: Global timer/event handlers running when they shouldn't

**Solution**: Always check container exists first:
```javascript
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("simulation-space");
    if (!container) return; // CRITICAL - exits if not on this page
    
    // Safe to start timers now
    d3.timer(() => { /* physics loop */ });
});
```

## TypeScript Development Workflow

### Project Structure
```
museum/
├── src/                         # TypeScript source files
│   ├── museum-features.ts       # Global bookmarking & notes
│   ├── d3-cluster-visualizer.ts # Cluster visualization
│   ├── mass-spring.ts           # Physics simulation
│   ├── your-exhibit.ts          # Your new exhibit
│   └── globals.d.ts             # Global type declarations (d3)
├── docs/js/                     # Compiled JavaScript (git-ignored)
│   ├── museum-features.js
│   ├── d3-cluster-visualizer.js
│   └── mass-spring.js
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Node.js dependencies
```

### Development Commands
```bash
# Install dependencies (first time)
npm install

# Compile TypeScript
npm run build          # One-time compilation
npm run watch          # Watch mode - auto-compile on changes
make ts-build          # Same as npm run build
make ts-watch          # Same as npm run watch
make ts-check          # Type-check without compiling

# Run the site
make run               # Auto-compiles + starts server
make dev               # Same as above
mkdocs serve           # Direct (requires manual compile first)

# Full workflow
npm install            # Install dependencies
npm run build          # Compile TypeScript
mkdocs serve           # Start server
```

### TypeScript Tips

**1. D3 is a Global**
D3 is loaded via CDN in the browser, not imported as a module:
```typescript
// ✅ CORRECT - Use d3 as global with type imports
import type * as d3Types from "d3";

// Then use d3 directly (loaded globally)
const svg = d3.select("#container");

// For type annotations, use d3Types
const dragHandler = d3.drag<SVGRectElement, unknown>();
```

**2. Type Your Data Structures**
```typescript
interface SimulationState {
    x: number;
    v: number;
    m: number;
}

const state: SimulationState = {
    x: 0,
    v: 0,
    m: 2.0
};
```

**3. Event Handlers with Type Safety**
```typescript
// Mouse events
node.on("click", (event: MouseEvent, d) => {
    console.log(event.pageX, event.pageY);
});

// D3 drag events
import type * as d3Types from "d3";

const dragHandler = d3.drag<SVGRectElement, unknown>()
    .on("drag", (event: d3Types.D3DragEvent<SVGRectElement, unknown, unknown>) => {
        const x = event.x;
        const y = event.y;
    });
```

**4. HTML Element Type Assertions**
```typescript
// Input elements need type assertions
d3.select<HTMLInputElement, unknown>("#mySlider")
    .on("input", function() {
        const value = +this.value;  // 'this' is now HTMLInputElement
    });
```

### Troubleshooting TypeScript

**Error: "Cannot find namespace 'd3'"**
- Solution: Use `import type * as d3Types from "d3"` for type annotations
- The global `d3` object is for runtime, `d3Types` is for types

**Error: "Property 'value' does not exist on type 'BaseType'"**
- Solution: Add type parameter to `d3.select<HTMLInputElement, unknown>()`

**Error: "Module not found"**
- Solution: Run `npm install` to install dependencies

**Compilation fails but no clear error**
- Run `make ts-check` or `npx tsc --noEmit` for detailed type errors

## JavaScript Patterns (TypeScript)
```javascript
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("simulation-space");
    if (!container) return;
    
    let state = { x: 0, v: 0 };
    const dt = 0.016; // ~60fps
    
    d3.timer(() => {
        // Update state
        state.x += state.v * dt;
        
        // Render
        updateVisualization(state);
    });
});
```

### Pattern: Interactive Drag
```javascript
const dragHandler = d3.drag()
    .on("start", (event, d) => {
        // Handle drag start
    })
    .on("drag", (event, d) => {
        // Update position
    })
    .on("end", (event, d) => {
        // Handle drag end
    });

element.call(dragHandler);
```

### Pattern: Slider Controls
```javascript
d3.select("#mySlider").on("input", function() {
    const value = +this.value;
    d3.select("#myValue").text(value.toFixed(2));
    updateSimulation(value);
});
```

### Pattern: Responsive SVG
```javascript
const container = document.getElementById("my-container");
const width = container.clientWidth || 700; // Fallback width
const height = 400;

const svg = d3.select(container)
    .append("svg")
    .attr("width", "100%")  // Responsive width
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`); // Maintains aspect ratio
```

## Project Structure

```
museum/
├── mkdocs.yml              # Configuration
├── Dockerfile              # Container build
├── requirements.txt        # Python dependencies
├── Makefile                # Convenience commands
│
├── docs/                   # Content directory
│   ├── index.md           # Home page
│   ├── about.md           # Philosophy
│   ├── dashboard.md       # Bookmarks page
│   │
│   ├── your-exhibit.md    # Your exhibit content
│   │
│   ├── js/                # JavaScript modules
│   │   ├── museum-features.js      # Bookmarking & notes (global)
│   │   ├── mass-spring.js          # Physics simulation
│   │   ├── d3-cluster-visualizer.js # GitOps demo
│   │   └── your-exhibit.js         # Your exhibit code
│   │
│   └── css/
│       └── custom.css     # Global styles (dark mode support)
│
├── USAGE.md               # User guide
├── BUILD.md               # Deployment guide
├── INSTALL.md             # Installation guide
├── CLAUDE.md              # This file
└── HYBRID_ARCHITECTURE.md # Future API proposal
```

## Building & Testing

### Development Server
```bash
mkdocs serve
# Visit http://localhost:8000
# Auto-reloads on file changes
```

### Docker Build
```bash
docker build -t arcane-museum .
docker run -p 8080:80 arcane-museum
# Visit http://localhost:8080
```

### Makefile Commands
```bash
make help    # Show all commands
make run     # Start dev server (tries mkdocs, falls back to instructions)
make build   # Build Docker image
make clean   # Clean build artifacts
```

## Styling Guidelines

### Dark Mode Support
Material theme automatically provides dark mode. Test your exhibits in both:
- Light mode: Default
- Dark mode: Toggle sun/moon icon in header

**For custom colors**, use CSS variables when possible:
```css
color: var(--md-typeset-color, #333);
background: var(--md-code-bg-color, #f5f5f5);
```

### Consistent Exhibit Layout
```markdown
# Exhibit Title

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
<strong>🎯 Demonstration Goal:</strong> What you'll learn
</div>

## The Concept
Background...

## Interactive Demonstration
<div id="exhibit-id" style="width: 100%; min-height: 300px; border: 1px solid #ccc; border-radius: 8px; background: #fff;"></div>

**Interaction Tips:**
- Bullet points on usage
```

## Museum Features

### Bookmarking & Notes
Every page automatically includes:
- **Bookmark button** - Saves page to Dashboard
- **Notes textarea** - Personal annotations (localStorage)

These are injected by `museum-features.js` - no action needed in your exhibit.

### Search
Full-text search is automatic via Material theme. Your exhibit content is searchable immediately.

### Navigation
Tabs and sections automatically organize based on `mkdocs.yml` nav structure.

## Git Workflow

```bash
# After making changes
git status
git add docs/your-exhibit.md docs/js/your-exhibit.js mkdocs.yml
git commit -m "Add [your exhibit name] demonstration

Brief description of what it demonstrates and why it's interesting.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Questions & Troubleshooting

### How do I debug JavaScript issues?
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Use `console.log()` liberally
4. Check Network tab to verify JS files load (200 status)

### How do I make my exhibit responsive?
- Use percentage widths: `width: 100%`
- Get container width: `container.clientWidth`
- Use SVG viewBox for scaling: `.attr("viewBox", "0 0 ${width} ${height}")`

### Can I use libraries other than D3.js?
Yes! Add them to `extra_javascript` in `mkdocs.yml`:
```yaml
extra_javascript:
  - https://cdn.jsdelivr.net/npm/plotly.js@2/dist/plotly.min.js
  - js/your-exhibit.js
```

### How do I share state between exhibits?
Currently: Don't. Each exhibit should be independent. If you need shared infrastructure, see `HYBRID_ARCHITECTURE.md`.

### What about mobile?
Material theme is responsive by default. Test your exhibit on mobile viewports. Keep in mind:
- Touch events vs mouse events
- Smaller screen sizes
- Performance on mobile browsers

## Design Principles

1. **Interaction over explanation** - Let users discover by doing
2. **Immediate feedback** - Changes should be reflected instantly
3. **Forgiving interfaces** - Hard to break, easy to reset
4. **Progressive complexity** - Simple to start, deep to master
5. **Beautiful defaults** - Works well out of the box
6. **Accessible** - Keyboard navigation, screen readers, color contrast

## Future Directions

See `HYBRID_ARCHITECTURE.md` for plans to add:
- API-backed exhibits for real infrastructure
- K8s/GitOps demonstrations
- Proxmox integration
- WebSocket live updates

For now, focus on client-side demonstrations that push the boundaries of what's possible in the browser.
