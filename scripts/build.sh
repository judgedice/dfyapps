#!/bin/sh
# Builds every survey and the server into build/, the folder the container runs from:
#   build/server.cjs                     the server, dependencies bundled in
#   build/public/<survey-id>/            each survey's static files, served at dfy.work/<survey-id>/
set -eu
cd "$(dirname "$0")/.."

# Every survey in apps/survey/src/surveys/. Add new ids here too.
SURVEYS="how-you-work work-survey"

rm -rf build
mkdir -p build/public

npm run typecheck --prefix apps/survey
for id in $SURVEYS; do
  # Each survey posts to the server on the same host, so no CORS or absolute URL is needed.
  (cd apps/survey && VITE_SURVEY="$id" VITE_SUBMIT_URL="/$id/api/responses" \
    npx vite build --outDir "../../build/public/$id" --emptyOutDir)
done

npm run build --prefix server
cp server/dist/server.cjs server/dist/server.cjs.map build/
