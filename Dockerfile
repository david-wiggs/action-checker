FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY cli.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S github -u 1001

# Change ownership of the app directory
RUN chown -R github:nodejs /usr/src/app
USER github

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "src/index.js"]
