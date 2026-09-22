// D3 GitOps/Kubernetes Cluster Visualizer
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
    const width = targetDiv.clientWidth || 700;
    const height = 300;
    const margin = { top: 40, right: 150, bottom: 40, left: 150 };

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
            alert(`Inspecting node: ${d.data.name}\nStatus: ${d.data.status || 'Active Master'}`);
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
        .attr("x", d => d.children ? -15 : 15)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name)
        .style("font-family", "var(--md-text-font, sans-serif)")
        .style("font-size", "12px")
        .style("fill", "var(--md-typeset-color, #333)");
});
