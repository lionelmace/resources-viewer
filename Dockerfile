# Build stage
FROM node:20-slim AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with increased memory for node
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Install dependencies
RUN npm ci --no-audit --network-timeout 300000

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Code Engine preferred port)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 