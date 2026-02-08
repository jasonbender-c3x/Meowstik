#!/bin/bash
# ==============================================================================
# VERIFY & FIX: Desktop App Dependency Error
# ==============================================================================
# This script diagnoses and fixes the missing `libglib2.0.so.0` dependency
# that prevents the Electron-based desktop-app from starting.
#
# BUG: The application fails with the error:
#   `error while loading shared libraries: libglib-2.0.so.0`
#
# SOLUTION: Install the `libglib2.0-0` package from the system repository.
#
# USAGE:
#   chmod +x ./verify_and_fix_desktop_app.sh
#   ./verify_and_fix_desktop_app.sh
# ==============================================================================

echo " HUNTING BUG: Desktop App Dependency Failure"
echo "--------------------------------------------------"
echo " This test will attempt to install the missing system library and then"
echo " launch the application to verify the fix."
echo ""

# Step 1: Install the missing dependency
echo " STEP 1: Installing 'libglib2.0-0' via apt-get..."
echo "         (This may require sudo privileges)"

# Add error checking for the apt-get command
if sudo apt-get update && sudo apt-get install -y libglib2.0-0; then
    echo "         SUCCESS: System dependency 'libglib2.0-0' installed."
else
    echo "         ERROR: Failed to install system dependency."
    echo "         Please run 'sudo apt-get update && sudo apt-get install -y libglib2.0-0' manually."
    exit 1
fi

echo ""

# Step 2: Run the application to verify the fix
echo " STEP 2: Launching the desktop application..."
echo ""

# Navigate to the app directory
cd "$(dirname "$0")/desktop-app" || exit

# Attempt to start the app
npm run dev

# Check the exit code of the npm command
if [ $? -eq 0 ]; then
    echo ""
    echo "--------------------------------------------------"
    echo " ✅ VERIFICATION SUCCESSFUL: The application launched without errors."
    echo "    The bug is confirmed to be environmental and fixed by the dependency."
else
    echo ""
    echo "--------------------------------------------------"
    echo " ❌ VERIFICATION FAILED: The application still failed to launch."
    echo "    There may be other issues present."
fi

exit 0
