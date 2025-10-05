// Helper to darken color for hover state
const adjustColorBrightness = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
};

export const updateThemeColor = (colorName) => {
  const colorMap = {
    'blue': '#3b82f6',
    'green': '#10b981',
    'purple': '#8b5cf6',
    'pink': '#ec4899',
    'red': '#ef4444'
  };
  
  const hexColor = colorMap[colorName];
  if (hexColor) {
    document.documentElement.style.setProperty('--color-primary', hexColor);
    document.documentElement.style.setProperty('--color-primary-hover', adjustColorBrightness(hexColor, -20));
  }
};