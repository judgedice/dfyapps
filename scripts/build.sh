#!/bin/sh
# Builds every app and the server into build/, the folder the container runs from:
#   build/server.cjs                     the server, dependencies bundled in
#   build/public/<app>/                  each app's static files, served at dfy.work/<app>/
set -eu
cd "$(dirname "$0")/.."

rm -rf build
mkdir -p build/public

# The survey posts to the server on the same host, so no CORS or absolute URL is needed.
VITE_SUBMIT_URL=/workflow-survey/api/responses npm run build --prefix apps/workflow-survey
cp -R apps/workflow-survey/dist build/public/workflow-survey

npm run build --prefix server
cp server/dist/server.cjs server/dist/server.cjs.map build/
