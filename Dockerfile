
# Stage 1: Build the Vite app
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy the application source code
COPY . .

# Build arguments (secrets passed from Cloud Build)
ARG VITE_API_KEY
ARG VITE_GOOGLE_CLIENT_ID

# Ensure secrets are available as env vars during build
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the production version
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:1.25-alpine

# Remove default config and add our own
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run expects the app to listen on $PORT
EXPOSE 8080

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

