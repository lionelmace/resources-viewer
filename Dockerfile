# Build stage
# FROM node:20-alpine AS build
FROM --platform=linux/amd64 node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
# FROM nginx:alpine
FROM --platform=linux/amd64 nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Code Engine preferred port)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 