#!/bin/bash

# the version number is just a unix timestamp in minutes

defaultVersionCode=$(($(date +%s) / 60))
versionCode=${1:-$defaultVersionCode}


source ~/.nvm/nvm.sh;

nvm install v21
nvm use v21

if [[ $(node --version) != v21* ]]; then
  echo "run first: nvm use v21"
  exit 1
fi

set -e
set -x

# clear output folders first, so that they are empty for failed builds
rm -rf ./build/*
mkdir -p ./app/src/main/assets/
rm -rf ./app/src/main/assets/*
echo "DGJLHICYKNST2AAAAAAAAAAAAA" > ./app/src/main/assets/adi-registration.properties
rm -rf  ./app/build/outputs/apk/release/*
rm -rf  ./app/build/outputs/bundle/release/*



# Replace the version code and name in gradle for fdroid and play store
sed -i -e "s/^[[:space:]]*versionCode = .*/        versionCode = $versionCode/" \
       -e "s/^[[:space:]]*versionName = .*/        versionName = \"$versionCode\"/" \
       ./app/build.gradle.kts

echo "\"$versionCode\"" > src/data/version.json

# Update service worker
sed -i -e "s/VERSION = .*/ VERSION = '$versionCode'/"  ./src/PWA/sw-b71.js

# remove all exif metadata from pictures, because i think fdroid doesn't like that. odd
find  -name '*.jp*g' -o -name '*.png' | xargs exiftool -all= -overwrite_original

npm run prettier
npx jest
node checks.js

# Actual js app build
npx parcel build src/index.html --dist-dir build

# Add public files to the web version, but not to the apk
cp public/* build

# Add only index.html file to the apk, it should be enough
cp build/index.html ./app/src/main/assets/


