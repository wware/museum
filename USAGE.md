# Museum of Arcane Curiosities - Usage Guide

## Quick Start with Docker (Recommended)

The easiest way to run the museum is using Docker:

```bash
# Build the museum container
docker build -t arcane-museum .

# Run it locally
docker run -p 8080:80 arcane-museum

# Visit in your browser
open http://localhost:8080
```

## Development Mode (with MkDocs installed)

If you have Python and want to develop locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Serve with live reload
mkdocs serve

# Visit in your browser
open http://127.0.0.1:8000
```

Changes to markdown files will automatically reload in your browser.

## Using the Makefile

A Makefile is provided for convenience:

```bash
make build      # Build the Docker image
make run        # Run the container (accessible at localhost:8080)
make dev        # Start development server (requires MkDocs installed)
make clean      # Clean build artifacts
```

## Adding New Exhibits

1. **Create a markdown file** in `docs/`:
   ```bash
   touch docs/my-new-exhibit.md
   ```

2. **Add interactive JavaScript** (optional) in `docs/js/`:
   ```bash
   touch docs/js/my-exhibit.js
   ```

3. **Register in navigation** by editing `mkdocs.yml`:
   ```yaml
   nav:
     - Home: index.md
     - Demonstrations:
         - My New Exhibit: my-new-exhibit.md
   ```

4. **Include JavaScript** (if needed) in `mkdocs.yml`:
   ```yaml
   extra_javascript:
     - js/my-exhibit.js
   ```

## Structure

```
museum/
├── mkdocs.yml              # Configuration
├── Dockerfile              # Container build
├── docs/                   # Content
│   ├── index.md           # Home page
│   ├── mass-spring.md     # Example exhibit
│   ├── js/                # JavaScript modules
│   │   ├── museum-features.js      # Bookmarks & notes
│   │   ├── mass-spring.js          # Physics sim
│   │   └── d3-cluster-visualizer.js # GitOps viz
│   └── css/               # Custom styles
└── site/                  # Generated static files (gitignored)
```

## Features

### Bookmarking
Every page includes a bookmark button. Bookmarks are saved to browser localStorage and visible on the Dashboard.

### Note-Taking
Each page has a notes textarea that auto-saves to localStorage. Your personal annotations persist across sessions.

### Search
The Material theme includes full-text search. Use the search box in the header or press `/` to focus it.

### Dark Mode
Toggle between light and dark themes using the sun/moon icon in the header.

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ✅ Responsive design

localStorage features require JavaScript enabled.

## Deployment Options

### Local Docker
```bash
docker run -p 8080:80 arcane-museum
```

### Cloud Hosting
The built `site/` directory is pure static HTML/CSS/JS. Deploy to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

### Self-Hosted
Copy the `site/` directory to any web server:
```bash
mkdocs build
rsync -av site/ user@server:/var/www/museum/
```

## Troubleshooting

### Port 8080 already in use
Change the port mapping:
```bash
docker run -p 9000:80 arcane-museum
```

### Changes not appearing
Force rebuild:
```bash
docker build --no-cache -t arcane-museum .
```

### JavaScript not loading
Check browser console (F12) for errors. Ensure D3.js CDN is accessible.

## Philosophy

Remember: this isn't documentation, it's a **museum**. Each exhibit should:
- Demonstrate a concept through interaction
- Teach better than static explanation could
- Invite exploration and experimentation

If it can be fully explained in text, it's probably not a museum piece.
