# Build & Deployment Guide

## Quick Start

```bash
# Build and run with Docker
make build
make run

# Or with one command
make all
```

Visit http://localhost:8080

## Build Options

### 1. Docker Build (Production)

```bash
# Standard build
docker build -t arcane-museum .

# No-cache build (force fresh)
docker build --no-cache -t arcane-museum .

# Build with custom tag
docker build -t my-museum:v1.0 .
```

### 2. Local Build (Development)

```bash
# Install dependencies
pip install -r requirements.txt

# Build static site
mkdocs build

# Output will be in site/ directory
ls -la site/
```

### 3. Development Server

```bash
# Live reload on changes
mkdocs serve

# Custom port
mkdocs serve -a localhost:9000

# Verbose output
mkdocs serve -v
```

## Running the Museum

### Docker

```bash
# Foreground (Ctrl+C to stop)
docker run --rm -p 8080:80 arcane-museum

# Background
docker run -d --name museum -p 8080:80 arcane-museum

# Stop background container
docker stop museum
docker rm museum
```

### Static File Server

```bash
# Using Python
cd site && python3 -m http.server 8080

# Using Node.js
cd site && npx serve

# Using Nginx (copy to webroot)
cp -r site/* /var/www/html/museum/
```

## Deployment Targets

### GitHub Pages

```bash
# Build
mkdocs build

# Deploy to gh-pages branch
mkdocs gh-deploy
```

Add to `.github/workflows/deploy.yml`:
```yaml
name: Deploy Museum
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: 3.x
      - run: pip install -r requirements.txt
      - run: mkdocs gh-deploy --force
```

### Netlify

1. Connect your repository
2. Set build command: `mkdocs build`
3. Set publish directory: `site`

Or use `netlify.toml`:
```toml
[build]
  command = "mkdocs build"
  publish = "site"
```

### Vercel

1. Connect repository
2. Set build command: `mkdocs build`
3. Set output directory: `site`

### Docker Registry

```bash
# Tag for registry
docker tag arcane-museum your-registry.io/arcane-museum:latest

# Push
docker push your-registry.io/arcane-museum:latest

# Pull and run elsewhere
docker pull your-registry.io/arcane-museum:latest
docker run -p 8080:80 your-registry.io/arcane-museum:latest
```

### Kubernetes

Create `k8s-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: arcane-museum
spec:
  replicas: 2
  selector:
    matchLabels:
      app: arcane-museum
  template:
    metadata:
      labels:
        app: arcane-museum
    spec:
      containers:
      - name: museum
        image: arcane-museum:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: arcane-museum
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: arcane-museum
```

Deploy:
```bash
kubectl apply -f k8s-deployment.yaml
```

## Performance Optimization

### Minification

Add to `mkdocs.yml`:
```yaml
plugins:
  - minify:
      minify_html: true
      minify_js: true
      minify_css: true
```

Install plugin:
```bash
pip install mkdocs-minify-plugin
```

### CDN for Assets

The D3.js library is already loaded from CDN. Consider adding more:

```yaml
extra_javascript:
  - https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js
```

### Docker Image Size

Current multi-stage build keeps the image small (~30MB).

To optimize further:
```dockerfile
# Use even smaller base
FROM nginx:alpine-slim

# Or use distroless
FROM gcr.io/distroless/static-debian11
```

## Testing

### Link Checking

```bash
# Check for broken links
mkdocs build --strict

# Or use external tool
wget --spider -r -nd -nv -l 3 http://localhost:8080
```

### Visual Regression

```bash
# Use Playwright or similar
npx playwright test
```

### Performance Testing

```bash
# Lighthouse CI
lighthouse http://localhost:8080 --view

# Or use Chrome DevTools
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - run: pip install -r requirements.txt
      - run: mkdocs build --strict
      - run: docker build -t test-image .
```

## Troubleshooting

### Build fails

```bash
# Check dependencies
pip install -r requirements.txt --upgrade

# Verify mkdocs
mkdocs --version

# Check config
mkdocs build --strict --verbose
```

### Docker issues

```bash
# Check Docker
docker --version

# View build logs
docker build --progress=plain -t arcane-museum .

# Check container
docker run --rm arcane-museum nginx -t
```

### Missing files in build

Check `.gitignore` - sometimes necessary files are excluded.

```bash
# List all files being included
git ls-files
```

## Monitoring

### Docker Container

```bash
# View logs
docker logs -f museum

# Resource usage
docker stats museum

# Inspect
docker inspect museum
```

### Nginx Access Logs

```bash
# Inside container
docker exec museum tail -f /var/log/nginx/access.log
```

## Backup

```bash
# Export Docker image
docker save arcane-museum > museum-backup.tar

# Restore
docker load < museum-backup.tar

# Backup source
tar -czf museum-source.tar.gz docs/ mkdocs.yml Dockerfile
```
