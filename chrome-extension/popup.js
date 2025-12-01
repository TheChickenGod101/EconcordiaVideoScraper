const scanButton = document.getElementById("scan");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

scanButton.addEventListener("click", scan);

async function scan() {
  setStatus("Scanning current page and its iframes...");
  resultsEl.innerHTML = "";
  scanButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus("No active tab detected.");
      return;
    }

    const injections = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: scrapeVideos
    });

    const unique = new Set();
    const collected = [];

    for (const injection of injections) {
      if (!injection?.result) continue;
      const { urls = [], frameUrl } = injection.result;
      for (const url of urls) {
        if (unique.has(url)) continue;
        unique.add(url);
        collected.push({ url, frameUrl });
      }
    }

    if (!collected.length) {
      setStatus("No video elements found on this page or its iframes.");
      return;
    }

    setStatus(`Found ${collected.length} video URL${collected.length > 1 ? "s" : ""}. Starting downloads...`);
    renderResults(collected);
    await downloadAll(collected);
  } catch (error) {
    console.error("Video extractor error", error);
    setStatus("Could not scan the page. Check the console for details.");
  } finally {
    scanButton.disabled = false;
  }
}

function renderResults(entries) {
  resultsEl.innerHTML = "";
  for (const entry of entries) {
    const card = document.createElement("div");
    card.className = "result";

    const urlLink = document.createElement("a");
    urlLink.href = entry.url;
    urlLink.textContent = entry.url;
    urlLink.target = "_blank";
    urlLink.rel = "noreferrer";
    urlLink.className = "url";

    const frame = document.createElement("div");
    frame.className = "frame";
    frame.textContent = entry.frameUrl ? `Frame: ${entry.frameUrl}` : "Frame: current page";

    const actions = document.createElement("div");
    actions.className = "actions";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => copyToClipboard(entry.url));

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", () => downloadAll([entry]));

    const typePill = document.createElement("span");
    typePill.className = "pill";
    typePill.textContent = urlType(entry.url);

    actions.appendChild(copyBtn);
    actions.appendChild(downloadBtn);
    actions.appendChild(typePill);

    card.appendChild(urlLink);
    card.appendChild(frame);
    card.appendChild(actions);
    resultsEl.appendChild(card);
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.");
  } catch (error) {
    console.error("Clipboard error", error);
    setStatus("Could not copy to clipboard.");
  }
}

function urlType(url) {
  if (url.startsWith("blob:")) return "blob";
  if (url.startsWith("data:")) return "data URI";
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (_) {
    return "unknown";
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function downloadAll(entries) {
  const downloadable = entries.filter((entry) => /^https?:/i.test(entry.url));
  if (!downloadable.length) {
    setStatus("Found URLs but none are direct http/https; blob/data cannot be downloaded directly.");
    return;
  }

  let started = 0;
  let failed = 0;
  for (const entry of downloadable) {
    try {
      const filename = suggestFilename(entry.url);
      await chrome.downloads.download({
        url: entry.url,
        filename,
        conflictAction: "uniquify"
      });
      started += 1;
    } catch (err) {
      console.error("Download failed", entry.url, err);
      failed += 1;
    }
  }

  const pieces = [];
  if (started) pieces.push(`started ${started} download${started > 1 ? "s" : ""}`);
  if (failed) pieces.push(`${failed} failed`);
  setStatus(pieces.length ? pieces.join("; ") : "Nothing downloaded.");
}

function suggestFilename(url) {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    if (lastSegment) return lastSegment;
  } catch (_) {
    // fall through
  }
  return "video.mp4";
}

function scrapeVideos() {
  const urls = [];
  const seen = new Set();
  const pushUrl = (candidate) => {
    if (!candidate) return;
    try {
      const resolved = new URL(candidate, location.href).href;
      if (seen.has(resolved)) return;
      seen.add(resolved);
      urls.push(resolved);
    } catch (_) {
      // ignore invalid URLs
    }
  };

  const videos = Array.from(document.querySelectorAll("video"));
  for (const video of videos) {
    if (video.src) pushUrl(video.src);
    const sources = video.querySelectorAll("source");
    for (const source of sources) {
      pushUrl(source.src);
    }
  }

  return { urls, frameUrl: location.href };
}

// Run an initial scan when the popup opens.
scan();
