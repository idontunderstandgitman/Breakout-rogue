

source ~/.nvm/nvm.sh;

nvm install v21
nvm use v21

rm -rf .parcel-cache
rm -rf build
npx run-p dev:*