# Your Museum Dashboard

Below are the engineering guides and pages you have bookmarked across this artifact.

<ul id="museum-bookmark-list" style="margin: 20px 0; padding: 20px; background: rgba(0,0,0,0.02); border-radius: 8px; min-height: 100px;">
    <li style="color: #666;">No bookmarks found yet. Visit exhibits and click the bookmark button to save them here.</li>
</ul>

<script>
document.addEventListener("DOMContentLoaded", () => {
    const listContainer = document.getElementById("museum-bookmark-list");
    const bookmarks = JSON.parse(localStorage.getItem("museum_bookmarks") || "{}");
    const paths = Object.keys(bookmarks);
    
    if (paths.length > 0) {
        listContainer.innerHTML = "";
        // Sort by timestamp, most recent first
        paths.sort((a, b) => bookmarks[b].timestamp - bookmarks[a].timestamp);
        
        paths.forEach(path => {
            const li = document.createElement("li");
            li.style = "margin: 10px 0; padding: 10px; background: white; border-radius: 4px; border: 1px solid #ddd;";
            
            const date = new Date(bookmarks[path].timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            li.innerHTML = `
                <a href="${path}" style="font-weight: bold; font-size: 1.1em;">${bookmarks[path].title}</a>
                <br>
                <small style="color: #666;">Bookmarked on ${dateStr}</small>
            `;
            listContainer.appendChild(li);
        });
    }
});
</script>

## About Bookmarks

Your bookmarks are stored locally in your browser using `localStorage`. This means:

- ✅ No server required - completely private
- ✅ Fast access - instant loading
- ✅ Works offline
- ⚠️ Browser-specific - not synced across devices
- ⚠️ Clearing browser data will remove bookmarks

## Managing Your Data

To export your bookmarks and notes, open your browser's developer console and run:

```javascript
// Export bookmarks
console.log(localStorage.getItem("museum_bookmarks"));

// Export notes
console.log(localStorage.getItem("museum_notes"));
```

To clear all museum data:

```javascript
localStorage.removeItem("museum_bookmarks");
localStorage.removeItem("museum_notes");
```

---

*Return to [Home](index.md) to explore more exhibits.*
