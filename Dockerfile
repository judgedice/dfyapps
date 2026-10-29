# Base images come from Microsoft's registry (Azure Linux), not Docker Hub, whose anonymous
# pull limit (429) has failed builds before. See the hub repo's deploy workflow.

# Build stage: install dependencies and build every app plus the bundled server.
FROM mcr.microsoft.com/azurelinux/base/nodejs:24 AS build
WORKDIR /repo

COPY apps/workflow-survey/package.json apps/workflow-survey/package-lock.json apps/workflow-survey/
RUN npm ci --prefix apps/workflow-survey
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server

COPY . .
RUN sh scripts/build.sh

# Runtime stage: distroless Node (no shell or package manager) plus the build/ folder.
# No node_modules; the server bundle is self-contained.
FROM mcr.microsoft.com/azurelinux/distroless/nodejs:24
ARG BUILD_SHA=dev
ENV NODE_ENV=production \
    PORT=8080 \
    PUBLIC_DIR=/app/public \
    BUILD_SHA=$BUILD_SHA
WORKDIR /app
COPY --from=build /repo/build/ ./
# nobody
USER 65534
EXPOSE 8080
ENTRYPOINT ["/usr/bin/node", "--enable-source-maps", "server.cjs"]
