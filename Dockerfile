# Stage 1: Build MkDocs site
FROM python:3.11-slim AS builder

WORKDIR /app

# Install MkDocs and Material theme
RUN pip install --no-cache-dir mkdocs mkdocs-material

# Copy documentation source (including pre-compiled JavaScript)
COPY mkdocs.yml .
COPY docs/ docs/
COPY README.md .

# Build the static site
RUN mkdocs build

# Stage 2: Serve the museum via Nginx
FROM nginx:alpine

# Copy built site from builder stage
COPY --from=builder /app/site /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
