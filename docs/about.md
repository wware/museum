# About the Museum of Arcane Curiosities

## The Philosophy

> "A printed book is the wrong artifact aimed at the wrong target audience."

This museum represents a fundamental shift in how technical knowledge should be shared. Instead of static text frozen at publication time, we embrace:

### Living Documentation
- Content that can be updated and improved continuously
- No "second edition" waiting period
- Git history provides the audit trail

### Interactive Learning
- Manipulate simulations to build intuition
- See cause and effect in real-time
- Learning by doing, not just reading

### Personal Annotation
- Take notes directly on the content
- Bookmark important sections
- Build your own learning path

### Modern Search
- Full-text search across all content
- No need for traditional indexes
- Find what you need instantly

## Why Not a Book?

Writing a book carries prestige from the age of print. But for technical content — especially topics like:

- Distributed systems architecture
- Physics simulations
- Interactive algorithms
- Real-time visualizations
- Dynamic system behavior

...a printed book is fundamentally limited. It cannot:

- Execute code
- Visualize motion
- Respond to interaction
- Update when technology changes
- Provide personalized learning paths

## The Architecture

This museum is built with:

- **MkDocs** with Material theme for clean, searchable documentation
- **D3.js** for interactive visualizations and animations
- **Client-side JavaScript** for bookmarking and notes (no server needed)
- **Docker** for portable, self-contained deployment
- **Markdown** for easy authoring and version control

## Adding to the Museum

Each "exhibit" is:

1. A Markdown file in `docs/`
2. Optional JavaScript in `docs/js/` for interactivity
3. Registered in `mkdocs.yml` navigation

The bar for inclusion is simple: **Does it teach better through interaction than through static explanation?**

## Deployment

The entire museum can be containerized:

```bash
docker build -t arcane-museum .
docker run -p 8080:80 arcane-museum
```

Then visit `http://localhost:8080` to explore.

## Contributing

This is a personal collection, but the concept is universal. Consider:

- What technical concept do you struggle to explain in words?
- What diagram would be better as an interactive simulation?
- What understanding requires playing with parameters?

Those are candidates for museum exhibits.

## Credits

Built by [Will Ware](https://github.com/wware) as an exploration of modern technical communication.

Inspired by:
- Jupyter notebooks for interactive computation
- Bret Victor's explorable explanations
- The failure of traditional technical book publishing to keep pace with change

---

*"The best way to show that a brick wall is not infinite is to get someone to walk to the end of it."* — Bret Victor
