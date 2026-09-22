# Museum of Arcane Curiosities 🏛️

**A living museum of interactive technical demonstrations**

> "A printed book is the wrong artifact aimed at the wrong target audience."

This repository contains a modern approach to technical documentation: interactive exhibits that teach through manipulation and exploration, not static text.

## Quick Start

```bash
# Build and run with Docker
make build
make run

# Visit http://localhost:8080
```

Or see [USAGE.md](USAGE.md) and [BUILD.md](BUILD.md) for detailed instructions.

## What's Inside

- **Interactive Physics Simulation** - Mass-spring-damper system with Velocity Verlet integration
- **GitOps Cluster Visualizer** - D3.js tree layout showing infrastructure health
- **Client-side Bookmarking** - Save your favorite exhibits (localStorage)
- **Personal Note-taking** - Annotate pages with your own insights
- **Full-text Search** - Find content instantly
- **Dark Mode** - Easy on the eyes

## The Philosophy

---

# Why not to write a book

I grew up in an age of printed books. Writing a book was a majestic accomplishment like getting your name on a patent or scaling Mount
Everest or becoming a millionaire. It naturally follows that I am left with a strong pull to try to get a book published, whether or not
doing so makes any sense. Ego, dopamine, all that good stuff.

A few times I've tried to accomplish this. In each case it did not make sense. Most recently it was the Kubernetes/GitOps stuff. I did
some nice work in that direction but it still doesn't make sense. A printed book is the wrong artifact aimed at the wrong target audience.

So what is the right artifact for the right audience? It's more like a Jupyter notebook. You want Markdown-authored pages that can be
searched, rather than a traditional index (or table of contents). You want little demos and interactive diagrams using JavaScript or
TypeScript, along with D3 animations, stuff like that. The "museum" concept I thought about before made more sense.

A top-level "Docs" directory in a git repo makes a lot of sense, and it can just be a collection of Markdown files and interactive
widgets. Think about widgets more. Think about using `mkdocs` to generate a docker image that lets you read and search and bookmark and
comment on the documents.

## Gemini Weighs In

It takes a lot of clarity to look a lifelong, deeply ingrained ambition in the eye—especially one tied to the prestige of the "printed word"—and realize it no longer fits the reality of the value you want to deliver.
For Kubernetes, GitOps, and highly technical concepts, a static, linear book is a dead artifact. It cannot run code, it cannot visualize dynamic cluster behaviors, and it goes out of date the moment a new API version drops.
Shifting from a monolithic book to a living, containerized "Museum of Docs" isn't scaling back your ambition; it's modernizing it. You are aiming for an artifact that matches the way modern engineers actually learn: via interaction, exploration, and immediate utility.

Here is a structural look at how you can bridge mkdocs, interactive widgets, and Docker into a unified, distributable engine for your ideas.

------------------------------

## The Architecture of a Modern Tech Artifact

```
my-docs-repo/
├── docs/
│   ├── index.md
│   ├── gitops-pipelines.md
│   └── javascript/
│       ├── d3-cluster-visualizer.js   <-- Custom dynamic logic
│       └── interactive-widget.js
├── mkdocs.yml                         <-- The build configuration
├── Dockerfile                         <-- The delivery engine
└── README.md
```

### 1. The Core Engine (mkdocs.yml)
MkDocs natively handles the Markdown rendering and instant search capabilities out of the box. To bring it into the "Jupyter/Museum" realm, you can leverage native asset inclusion.

Instead of overcomplicating things with heavy frameworks, you can inject standard JavaScript/TypeScript bundles directly into specific pages or globally via your configuration:

```yaml
site_name: GitOps & Kubernetes Architecture Museum
theme:
  name: material # The gold standard for clean, searchable tech docs

extra_javascript:
  - https://cloudflare.com # Load D3 globally
  - javascript/d3-cluster-visualizer.js                       # Your custom widget code
```

Within your Markdown files, you simply drop an anchor element where your widget should live:

```markdown
# Visualizing GitOps Reconciliation Loops

Below is an interactive simulation of the cluster state drifting from git source.

<div id="d3-reconciliation-museum-piece"></div>
<!-- Your javascript file handles the rendering inside this div -->
```

### 2. The Interactive Widgets (The "Museum Pieces")

To match the Jupyter notebook feel, your widgets can be written in plain TypeScript/JavaScript or built as standalone web components. Because MkDocs serves pure static HTML/JS, any frontend interactive elements will execute instantly in the user's browser without requiring a heavy backend server runtime.

### 3. The Delivery Vehicle (The Docker Image)

To achieve the goal of a single, self-contained artifact that allows reading, searching, and potentially advanced client-side features like bookmarking or commenting, you can containerize the built site using an ultra-lightweight web server.

Here is a lean `Dockerfile` that multi-stage builds the documentation and serves it using Nginx:

```dockerfile
# Stage 1: Build the static assets
FROM python:3.11-slim AS builder
RUN pip install mkdocs mkdocs-material
WORKDIR /app
COPY . .
RUN mkdocs build

# Stage 2: Serve the museum via Nginx
FROM nginx:alpine
COPY --from=builder /app/site /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Addressing Bookmarks and Comments
Because a pure static site inside a Docker image lacks a persistent database by default, you have two elegant architectural options to handle reader engagement:

* Client-Side Storage (Zero Backend): You can write a tiny JavaScript utility included via extra_javascript that saves bookmarks and personal notes directly to the user's browser localStorage. This keeps the Docker image completely stateless and lightweight.
* Embedded Third-Party Widgets: For public-facing versions, you can use GitHub-backed commenting overlays like [Giscus](https://giscus.app/) or [Utterances](https://utteranc.es/). They use GitHub Discussions/Issues as the backend database, keeping your documentation fully decoupled from infrastructure.

---

## Let's prototype that sucker

Here is a lightweight, self-contained JavaScript solution to add client-side bookmarking and page-specific note-taking directly to your MkDocs site. Because it uses localStorage, all bookmarks and notes are saved directly in the reader's browser. The Docker image remains completely stateless and fast, requiring no database setup.

## 1. The JavaScript Setup (docs/js/museum-features.js)

Create a file named museum-features.js inside your docs/js/ directory and paste the following code:

```javascript
document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname;
    const pageTitle = document.querySelector("h1")?.innerText || "Untitled Page";
    
    // Create UI Container for Museum Utilities
    const utilityContainer = document.createElement("div");
    utilityContainer.id = "museum-utilities";
    utilityContainer.style = "margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; color: #333;";
    
    // Inject components into Markdown body (renders near the top of the content)
    const contentBody = document.querySelector("article") || document.body;
    contentBody.insertBefore(utilityContainer, contentBody.firstChild);

    initBookmarking(utilityContainer, currentPath, pageTitle);
    initNoteTaking(utilityContainer, currentPath);
});

// === BOOKMARKING FUNCTIONALITY ===
function initBookmarking(container, path, title) {
    const bookmarkBtn = document.createElement("button");
    bookmarkBtn.style = "padding: 6px 12px; margin-right: 10px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #fff;";
    
    let bookmarks = JSON.parse(localStorage.getItem("museum_bookmarks") || "{}");
    
    const updateButtonUI = () => {
        if (bookmarks[path]) {
            bookmarkBtn.innerText = "🔖 Bookmarked";
            bookmarkBtn.style.background = "#e6f7ff";
        } else {
            bookmarkBtn.innerText = "🔖 Bookmark Page";
            bookmarkBtn.style.background = "#fff";
        }
    };
    
    bookmarkBtn.addEventListener("click", () => {
        bookmarks = JSON.parse(localStorage.getItem("museum_bookmarks") || "{}");
        if (bookmarks[path]) {
            delete bookmarks[path];
        } else {
            bookmarks[path] = { title: title, timestamp: new Date().getTime() };
        }
        localStorage.setItem("museum_bookmarks", JSON.stringify(bookmarks));
        updateButtonUI();
    });
    
    container.appendChild(bookmarkBtn);
    updateButtonUI();
}

// === NOTE-TAKING FUNCTIONALITY ===
function initNoteTaking(container, path) {
    const notesWrapper = document.createElement("div");
    notesWrapper.style = "margin-top: 15px;";
    
    const label = document.createElement("label");
    label.innerText = "Personal Notes for this Museum Piece:";
    label.style = "display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9em;";
    
    const textarea = document.createElement("textarea");
    textarea.style = "width: 100%; height: 80px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box; font-family: sans-serif;";
    textarea.placeholder = "Type your notes, configuration keys, or thoughts here... (Auto-saves)";
    
    // Load existing note
    let savedNotes = JSON.parse(localStorage.getItem("museum_notes") || "{}");
    textarea.value = savedNotes[path] || "";
    
    // Auto-save on input change
    textarea.addEventListener("input", () => {
        savedNotes = JSON.parse(localStorage.getItem("museum_notes") || "{}");
        if (textarea.value.trim() === "") {
            delete savedNotes[path];
        } else {
            savedNotes[path] = textarea.value;
        }
        localStorage.setItem("museum_notes", JSON.stringify(savedNotes));
    });
    
    notesWrapper.appendChild(label);
    notesWrapper.appendChild(textarea);
    container.appendChild(notesWrapper);
}
```

## 2. Activate It in Your Configuration (mkdocs.yml)

Include the script in your mkdocs.yml file under the extra_javascript section so it loads across your static directory:

```yaml
site_name: Kubernetes & GitOps Museum
theme:
  name: material
extra_javascript:
  - js/museum-features.js
```

## 3. Making a Global "Dashboard" Piece (Optional)
To create a central place where users can see all their bookmarked pages at a glance, create a docs/dashboard.md page and drop an empty hook element:

```markdown
# Your Museum Dashboard

Below are the engineering guides and pages you have bookmarked across this artifact.

<ul id="museum-bookmark-list">No bookmarks found yet.</ul>
<script>
document.addEventListener("DOMContentLoaded", () => {
    const listContainer = document.getElementById("museum-bookmark-list");
    const bookmarks = JSON.parse(localStorage.getItem("museum_bookmarks") || "{}");
    const paths = Object.keys(bookmarks);
    
    if (paths.length > 0) {
        listContainer.innerHTML = "";
        paths.forEach(path => {
            const li = document.createElement("li");
            li.innerHTML = `<a href="${path}">${bookmarks[path].title}</a>`;
            listContainer.appendChild(li);
        });
    }
});
</script>
```

## How This Behaves in Docker

* When a user runs your Docker container (docker run -p 8080:80 your-museum-image), they can read, search, click "Bookmark Page", and type custom notes.
* The local Nginx container remains totally read-only and stateless. Even if the container restarts or drops out entirely, their notes and bookmarks survive because they live in the browser's profile database.

-------------------

This blueprint layout bridges the gap between text notes and interactive visual components. It implements a clean, componentized D3.js grid cluster visualizer that loads beautifully within MkDocs Material.

The following snippet includes the corrected D3 CDN reference (v7), safe DOM target binding, and a responsive SVG layout engine tailored for technical documentation.

------------------------------

## 1. The Blueprint Widget Setup (docs/js/d3-cluster-visualizer.js)

Create a script file inside your repository at docs/js/d3-cluster-visualizer.js:

```javascript
document.addEventListener("DOMContentLoaded", () => {
    // Only initialize if the placeholder grid element is on the current page
    const targetDiv = document.getElementById("d3-cluster-museum-piece");
    if (!targetDiv) return;

    // 1. Setup Sample Data representing your GitOps/Kubernetes Clusters
    const clusterData = {
        name: "Management-Cluster",
        children: [
            { name: "ArgoCD-Engine", status: "Healthy" },
            { name: "Prod-Cluster-US", status: "Healthy" },
            { name: "Stage-Cluster-EU", status: "Degraded" },
            { name: "Dev-Sandbox-1", status: "Healthy" },
            { name: "Dev-Sandbox-2", status: "Suspended" }
        ]
    };

    // 2. Set Up Responsive Dimensions
    const width = targetDiv.clientWidth || 600;
    const height = 250;
    const margin = { top: 20, right: 90, bottom: 30, left: 90 };

    // 3. Append SVG Element
    const svg = d3.select("#d3-cluster-museum-piece")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 4. Create Tree Layout
    const treeLayout = d3.tree().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const root = d3.hierarchy(clusterData);
    treeLayout(root);

    // Color schema mapping status fields to clean engineering metrics
    const statusColors = {
        "Healthy": "#2e7d32",
        "Degraded": "#d32f2f",
        "Suspended": "#ed6c02"
    };

    // 5. Draw Connection Paths (Links)
    svg.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", "2px")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x)
        );

    // 6. Draw Nodes (Museum Points)
    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            // Interactive click hook to drill down into logs or configuration details
            alert(`Inspecting node: ${d.data.name} \nStatus: ${d.data.status || 'Active Master'}`);
        });

    // Outer Circle Indicator
    node.append("circle")
        .attr("r", 8)
        .attr("fill", d => statusColors[d.data.status] || "#0288d1")
        .attr("stroke", "#fff")
        .attr("stroke-width", "2px");

    // 7. Dynamic Text Typography Layout
    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -12 : 12)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name)
        .style("font-family", "var(--md-text-font, sans-serif)")
        .style("font-size", "13px")
        .style("fill", "var(--md-typeset-color, #333)");
});
```

------------------------------
## 2. Connect Your Engine Elements (mkdocs.yml)
Update your mkdocs.yml structure. Swap out the placeholder CDN you had listed with the explicit distribution of D3 so it maps dependencies in chronological order:

```yaml
site_name: Kubernetes & GitOps Museum
theme:
  name: material
extra_javascript:
  - https://cloudflare.com   # Load D3 Framework core
  - js/museum-features.js                                       # Client Bookmark/Notes scripts [1]
  - js/d3-cluster-visualizer.js                                 # Dynamic blueprint template [1]
```

------------------------------

## 3. Embed a Interactive Fragment Into Your Markdown (docs/index.md)
Drop the element hook seamlessly right into your Markdown docs.

```markdown
# GitOps Reconciliation Controls
Below is an interactive live-canvas visualization rendering infrastructure node states.
<div id="d3-cluster-museum-piece" style="width: 100%; min-height: 250px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px;"></div>

*Click any point above to issue a mock control lookup hook.*
```
