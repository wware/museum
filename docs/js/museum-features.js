// Museum Features: Client-side bookmarking and note-taking
document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname;
    const pageTitle = document.querySelector("h1")?.innerText || "Untitled Page";

    // Create UI Container for Museum Utilities
    const utilityContainer = document.createElement("div");
    utilityContainer.id = "museum-utilities";
    utilityContainer.style = "margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; color: #333;";

    // Inject components into Markdown body (renders near the top of the content)
    const contentBody = document.querySelector("article") || document.body;
    if (contentBody) {
        contentBody.insertBefore(utilityContainer, contentBody.firstChild);

        initBookmarking(utilityContainer, currentPath, pageTitle);
        initNoteTaking(utilityContainer, currentPath);
    }
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
