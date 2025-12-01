# Video Extractor Chrome Extension

Loads as an unpacked extension and pulls out video URLs (including ones inside H5P iframes) from the active tab.

## Install (unpacked)
- Open `chrome://extensions`.
- Enable "Developer mode".
- Click "Load unpacked" and select `chrome-extension` in this repo.

## Use
- Open the page with the video (e.g., the Moodle page / EConcordia).
- Click the extension icon and press **Scan Page**.
- The extension will automatically start downloading any direct `http/https` video URLs it finds (page + iframes) to your default Downloads folder. Blob/data URLs cannot be downloaded directly.
- Each result also has Copy and Download buttons if you want to handle items individually.
