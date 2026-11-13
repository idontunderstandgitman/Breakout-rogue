#!/bin/bash

if grep -rE "T[O]DO|F[I]XME|console\.log" src
then
  echo "You have left some TO""DO or logs"
  exit 1
fi

if grep -rE "course|atout" src/i18n/fr.json
then
  echo "Bad automatic translations"
  exit 1
fi


set -e
set -x

versionCode=$(($(date +%s) / 60))

bash ./build.sh $versionCode

export JAVA_HOME="/home/renan/android-studio/jbr/"

# generate signed apk for itch.io
./gradlew assembleRelease

# generate signed bundle for play store
./gradlew bundleRelease

# run prettier on src
npm run prettier

# Create a release commit
git add .
git commit -m "Build $versionCode"
git push

# Now that fdroid builds daily, we can deploy there systematically
git tag -a $versionCode -m $versionCode

# upload to breakout.lecaro.me
DOMAIN="breakout.lecaro.me"
PUBLIC_CONTENT="./build/*"

ssh staging "mkdir -p /opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN"
rsync -avz --delete --delete-excluded --exclude="*.sh" --exclude="node_modules" --exclude="android" --exclude=".*"  $PUBLIC_CONTENT staging:/opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN

# upload to itch.io , upload the index file directly
butler push "./build/index.html" renanlecaro/breakout71:latest --userversion $versionCode
butler push  "./build/index.html" renanlecaro/breakout71:offline --userversion $versionCode
butler push app/build/outputs/apk/release/app-release.apk renanlecaro/breakout71:apk --userversion $versionCode

# archive the output files

BASE_FOLDER="/opt/mup-nginx-proxy/config/html/static_sites/archive.lecaro.me/public-files/b71"
FOLDER="$BASE_FOLDER/$versionCode"
ssh staging "mkdir -p $FOLDER"
rsync -vz "./build/index.html" staging:$FOLDER/b71-$versionCode.html
rsync -vz "./app/build/outputs/apk/release/app-release.apk" staging:$FOLDER/b71-$versionCode.apk

# for obtainium
rsync -vz "./app/build/outputs/apk/release/app-release.apk" staging:$BASE_FOLDER/b71-latest.apk


