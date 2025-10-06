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
# The working directory for this script is ios/App/ci_scripts
cd ../../../

echo "--- INSTALLING NPM DEPENDENCIES ---"
npm install

# --- VERSIONING LOGIC START ---
echo "--- SETTING APP VERSION ---"

# Extract the version from package.json (e.g., "1.0.5")
PACKAGE_VERSION=$(node -p "require('./package.json').version")
echo "Version from package.json: $PACKAGE_VERSION"
echo "Xcode Cloud Build Number: $CI_BUILD_NUMBER"

# Use the capacitor-set-version tool to update the native project files
# Note: --version sets MARKETING_VERSION, --build sets CURRENT_PROJECT_VERSION
npx capacitor-set-version --version "$PACKAGE_VERSION" --build "$CI_BUILD_NUMBER"
# --- VERSIONING LOGIC END ---


echo "--- BUILDING WEB APP ---"
npm run build

echo "--- SYNCING CAPACITOR PROJECT --"
npx cap sync ios

# Navigate back to the iOS project directory to install pods.
cd ios/App

echo "--- INSTALLING COCOAPODS ---"
pod install

echo "--- SETUP COMPLETE ---"

exit 0