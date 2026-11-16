#!/bin/bash
# Runs ON the EC2 instance (invoked by GitHub Actions via SSM Run Command).
# Resolves the latest successful build from S3, installs it as a new release,
# switches the "current" symlink, restarts the service and rolls back if the health check fails.
set -euo pipefail

BUCKET="$1"
REGION="$2"
APP_DIR=/opt/app

LATEST_JSON=$(aws s3 cp "s3://${BUCKET}/releases/latest.json" - --region "$REGION")
KEY=$(echo "$LATEST_JSON" | sed -n 's/.*"key": *"\([^"]*\)".*/\1/p')
VERSION=$(echo "$LATEST_JSON" | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p')
[ -n "$KEY" ] && [ -n "$VERSION" ] || { echo "latest.json is malformed: $LATEST_JSON"; exit 1; }

echo "Deploying ${VERSION} from s3://${BUCKET}/${KEY}"
RELEASE_DIR="${APP_DIR}/releases/${VERSION}"
TMP_ZIP=$(mktemp --suffix=.zip)
aws s3 cp "s3://${BUCKET}/${KEY}" "$TMP_ZIP" --region "$REGION"
rm -rf "$RELEASE_DIR" && mkdir -p "$RELEASE_DIR"
unzip -q "$TMP_ZIP" -d "$RELEASE_DIR"
rm -f "$TMP_ZIP"

PREVIOUS=$(readlink -f "${APP_DIR}/current" || true)
ln -sfn "$RELEASE_DIR" "${APP_DIR}/current"
systemctl restart app

for i in $(seq 1 15); do
  if curl -fsS http://localhost/health | grep -q "\"version\":\"${VERSION}\""; then
    echo "Health check passed for ${VERSION}"
    # keep the 5 most recent releases
    ls -1dt ${APP_DIR}/releases/*/ | tail -n +6 | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

echo "Health check failed for ${VERSION}"
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
  echo "Rolling back to ${PREVIOUS}"
  ln -sfn "$PREVIOUS" "${APP_DIR}/current"
  systemctl restart app
fi
exit 1
