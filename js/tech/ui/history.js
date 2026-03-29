// History-related UI helpers
// Usage:
//   import { updateHistoryButtons } from './history.js';
//   updateHistoryButtons({ backButton, forwardButton, navigationHistory, historyIndex });

export function updateHistoryButtons({ backButton, forwardButton, navigationHistory, historyIndex }) {
  if (!backButton || !forwardButton || !Array.isArray(navigationHistory)) return;

  // Buttons IMMER sichtbar
  backButton.style.display = 'inline-block';
  forwardButton.style.display = 'inline-block';

  // Disabled-State basierend auf Position in History
  backButton.disabled = historyIndex <= 0;
  forwardButton.disabled = historyIndex >= navigationHistory.length - 1;
}
