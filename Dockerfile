# Stage 1: Build TypeScript
FROM node:20-slim AS typescript-builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy TypeScript source and compile
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# Stage 2: Build MkDocs site
FROM python:3.11-slim AS site-builder

WORKDIR /app

# Install MkDocs and Material theme
RUN pip install --no-cache-dir mkdocs mkdocs-material

# Copy documentation source
COPY mkdocs.yml .
COPY docs/ docs/
COPY README.md .

# Copy compiled JavaScript from typescript-builder stage
COPY --from=typescript-builder /app/docs/js/*.js docs/js/

# Build the static site
RUN mkdocs build

# Stage 3: Serve the museum via Nginx
FROM nginx:alpine

# Copy built site from site-builder stage
COPY --from=site-builder /app/site /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
