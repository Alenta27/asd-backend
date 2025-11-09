# How to Restart the Backend Server

## Quick Steps

1. **Stop the current server** (if it's running)
   - In your terminal, press `Ctrl+C`

2. **Restart the server**
   ```bash
   npm start
   ```

3. **Wait for the message** "Server listening on port 5000"

4. **Try adding a student again** from the teacher dashboard

## What Was Fixed

- Removed duplicate route mounting in `index.js`
- Added explicit role verification in teacher routes
- Added debug logging to help identify issues

## Verification

After restarting, you should see in the server logs:
- ✓ Teacher routes mounted
- ✓ Parent routes mounted  
- ✓ All route mounts should be successful

If you still see the error after restarting, check the server logs for the debug output to see which route is being hit.



