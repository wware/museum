// D3 GitOps/Kubernetes Cluster Visualizer
import type * as d3Types from "d3";

// === TYPE DEFINITIONS ===
interface ClusterNode {
    name: string;
    status?: "Healthy" | "Degraded" | "Suspended";
    children?: ClusterNode[];
}

interface Margin {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface StatusColors {
    [status: string]: string;
}

document.addEventListener("DOMContentLoaded", () => {
    // Only initialize if the placeholder grid element is on the current page
    const targetDiv = document.getElementById("d3-cluster-museum-piece");
    if (!targetDiv) return;

    // 1. Setup Sample Data representing your GitOps/Kubernetes Clusters
    const clusterData: ClusterNode = {
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
    const margin: Margin = { top: 40, right: 150, bottom: 40, left: 150 };

    // 3. Append SVG Element
    const svg = d3.select("#d3-cluster-museum-piece")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3a. Create tooltip for node interactions
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "cluster-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "#333")
        .style("color", "#fff")
        .style("padding", "10px 14px")
        .style("border-radius", "6px")
        .style("font-size", "13px")
        .style("font-family", "var(--md-text-font, sans-serif)")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)")
        .style("pointer-events", "none")
        .style("z-index", "9999");

    // 4. Create Tree Layout
    const treeLayout = d3.tree<ClusterNode>()
        .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const root = d3.hierarchy(clusterData);
    treeLayout(root);

    // Color schema mapping status fields to clean engineering metrics
    const statusColors: StatusColors = {
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
        .attr("d", d3.linkHorizontal<d3Types.HierarchyLink<ClusterNode>, d3Types.HierarchyPointNode<ClusterNode>>()
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
        .on("click", (event: MouseEvent, d) => {
            // Interactive click hook to drill down into logs or configuration details
            const status = d.data.status || 'Active Master';
            tooltip
                .style("visibility", "visible")
                .style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 10) + "px")
                .html(`<strong>${d.data.name}</strong><br/>Status: ${status}`);

            // Auto-hide after 3 seconds
            setTimeout(() => tooltip.style("visibility", "hidden"), 3000);
        })
        .on("mouseenter", (event: MouseEvent, d) => {
            // Show tooltip on hover
            const status = d.data.status || 'Active Master';
            tooltip
                .style("visibility", "visible")
                .style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 10) + "px")
                .html(`<strong>${d.data.name}</strong><br/>Status: ${status}`);
        })
        .on("mousemove", (event: MouseEvent) => {
            // Follow mouse
            tooltip
                .style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseleave", () => {
            // Hide tooltip when mouse leaves
            tooltip.style("visibility", "hidden");
        });

    // Outer Circle Indicator
    node.append("circle")
        .attr("r", 8)
        .attr("fill", d => statusColors[d.data.status || ""] || "#0288d1")
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
