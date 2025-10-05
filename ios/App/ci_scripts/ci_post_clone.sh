#!/bin/sh

# This script runs from the ios/App/ci_scripts directory.
# We need to go up to the root of the repository to install npm dependencies.
cd ../../../

echo "--- INSTALLING NPM DEPENDENCIES ---"
npm install

# Now, navigate back to the iOS project directory to install pods.
cd ios/App

echo "--- INSTALLING COCOAPODS ---"
pod install

exit 0