# Stage 1: Build the static documentation site
FROM python:3.11-slim AS builder

# Install Node.js for TypeScript compilation
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy TypeScript source and compile
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# Install MkDocs and Material theme
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org mkdocs mkdocs-material

# Copy documentation source
COPY mkdocs.yml .
COPY docs/ docs/
COPY README.md .

# Build the static site (compiled JS is already in docs/js/)
RUN mkdocs build

# Stage 2: Serve the museum via Nginx
FROM nginx:alpine

# Copy built site from builder stage
COPY --from=builder /app/site /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
