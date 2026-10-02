// Museum Features: Client-side bookmarking and note-taking

// === TYPE DEFINITIONS ===
interface Bookmark {
    title: string;
    timestamp: number;
}

interface BookmarkCollection {
    [path: string]: Bookmark;
}

interface NoteCollection {
    [path: string]: string;
}

// === LOCALSTORAGE UTILITIES WITH ERROR HANDLING ===
function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.warn(`Failed to read ${key} from localStorage:`, e);
        return defaultValue;
    }
}

function safeSetLocalStorage<T>(key: string, value: T): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Failed to write ${key} to localStorage:`, e);
        showStorageError();
        return false;
    }
}

function showStorageError(): void {
    const errorMsg = document.createElement("div");
    errorMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #d32f2f; color: white; padding: 12px 20px; border-radius: 4px; z-index: 9999; font-size: 14px;";
    errorMsg.textContent = "⚠️ Unable to save to browser storage. Your notes may not be saved.";
    document.body.appendChild(errorMsg);
    setTimeout(() => errorMsg.remove(), 4000);
}

document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname;
    const pageTitle = document.querySelector("h1")?.innerText || "Untitled Page";

    // Create UI Container for Museum Utilities
    const utilityContainer = document.createElement("div");
    utilityContainer.id = "museum-utilities";
    utilityContainer.style.cssText = "margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; color: #333;";

    // Inject components into Markdown body (renders near the top of the content)
    const contentBody = document.querySelector("article") || document.body;
    if (contentBody) {
        contentBody.insertBefore(utilityContainer, contentBody.firstChild);

        initBookmarking(utilityContainer, currentPath, pageTitle);
        initNoteTaking(utilityContainer, currentPath);
    }
});

// === BOOKMARKING FUNCTIONALITY ===
function initBookmarking(container: HTMLElement, path: string, title: string): void {
    const bookmarkBtn = document.createElement("button");
    bookmarkBtn.style.cssText = "padding: 6px 12px; margin-right: 10px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #fff;";

    let bookmarks = safeGetLocalStorage<BookmarkCollection>("museum_bookmarks", {});

    const updateButtonUI = (): void => {
        if (bookmarks[path]) {
            bookmarkBtn.innerText = "🔖 Bookmarked";
            bookmarkBtn.style.background = "#e6f7ff";
        } else {
            bookmarkBtn.innerText = "🔖 Bookmark Page";
            bookmarkBtn.style.background = "#fff";
        }
    };

    bookmarkBtn.addEventListener("click", () => {
        bookmarks = safeGetLocalStorage<BookmarkCollection>("museum_bookmarks", {});
        if (bookmarks[path]) {
            delete bookmarks[path];
        } else {
            bookmarks[path] = { title: title, timestamp: new Date().getTime() };
        }
        safeSetLocalStorage("museum_bookmarks", bookmarks);
        updateButtonUI();
    });

    container.appendChild(bookmarkBtn);
    updateButtonUI();
}

// === NOTE-TAKING FUNCTIONALITY ===
function initNoteTaking(container: HTMLElement, path: string): void {
    const notesWrapper = document.createElement("div");
    notesWrapper.style.cssText = "margin-top: 15px;";

    const label = document.createElement("label");
    label.innerText = "Personal Notes for this Museum Piece:";
    label.style.cssText = "display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9em;";

    const textarea = document.createElement("textarea");
    textarea.style.cssText = "width: 100%; height: 80px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box; font-family: sans-serif;";
    textarea.placeholder = "Type your notes, configuration keys, or thoughts here... (Auto-saves)";

    // Load existing note
    let savedNotes = safeGetLocalStorage<NoteCollection>("museum_notes", {});
    textarea.value = savedNotes[path] || "";

    // Auto-save on input change
    textarea.addEventListener("input", () => {
        savedNotes = safeGetLocalStorage<NoteCollection>("museum_notes", {});
        if (textarea.value.trim() === "") {
            delete savedNotes[path];
        } else {
            savedNotes[path] = textarea.value;
        }
        safeSetLocalStorage("museum_notes", savedNotes);
    });

    notesWrapper.appendChild(label);
    notesWrapper.appendChild(textarea);
    container.appendChild(notesWrapper);
}
