#!/bin/sh

echo "--- SETTING UP ENVIRONMENT ---"

# Install Homebrew if needed and add to PATH
if ! command -v brew &> /dev/null; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
export PATH="/opt/homebrew/bin:$PATH"

# Install Node.js
echo "Installing Node.js..."
brew install node

# Navigate to the root of the repository.
cd ../../../

echo "--- INSTALLING NPM DEPENDENCIES ---"
npm install

echo "--- BUILDING WEB APP ---"
npm run build

echo "--- SYNCING CAPACITOR PROJECT ---"
npx cap sync ios

# Navigate back to the iOS project directory to install pods.
cd ios/App

echo "--- INSTALLING COCOAPODS ---"
pod install

echo "--- SETUP COMPLETE ---"

exit 0