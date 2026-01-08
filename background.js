// Background service worker: listens for messages, manages icon changes
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg?.type === 'SET_ICON' && msg.iconPath) {
    chrome.action.setIcon({
      path: {
        16: msg.iconPath,
        32: msg.iconPath,
        48: msg.iconPath,
        128: msg.iconPath
      }
    });
    sendResponse({ ok: true });
    return false;
  }
});
