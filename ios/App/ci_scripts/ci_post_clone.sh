#!/bin/sh

echo "--- SETTING UP ENVIRONMENT ---"

# Install Homebrew if it's not already installed
if ! command -v brew &> /dev/null
then
    echo "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Add Homebrew to the PATH
export PATH="/opt/homebrew/bin:$PATH"

# Install Node.js
echo "Installing Node.js..."
brew install node

# This script runs from the ios/App/ci_scripts directory.
# Navigate to the root of the repository.
cd ../../../

echo "--- INSTALLING NPM DEPENDENCIES ---"
npm install

# Navigate back to the iOS project directory to install pods.
cd ios/App

echo "--- INSTALLING COCOAPODS ---"
pod install

echo "--- SETUP COMPLETE ---"

exit 0