#!/bin/bash

set -e
set -x
versionCode=$(($(date +%s) / 60))

bash ./build.sh $versionCode

# we don't add a version tag to let fdroid ignore this build

# upload to b72.lecaro.me
DOMAIN="b72.lecaro.me"
PUBLIC_CONTENT="./build/*"

ssh staging "mkdir -p /opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN"
rsync -avz --delete  $PUBLIC_CONTENT staging:/opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN

