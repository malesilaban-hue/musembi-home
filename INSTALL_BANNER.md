# PWA Installation Banner

## Overview

A persistent installation banner that encourages users to install MUSEMBI PMS on their iOS or Android device. The banner appears automatically and stays visible until the app is installed.

## Features

### Smart Detection
- **Android:** Uses `beforeinstallprompt` event (native browser support)
- **iOS:** Manual installation instructions (iOS doesn't support `beforeinstallprompt`)
- **Already Installed:** Banner automatically hides if app is installed

### Behavior

#### Android
- Shows banner with "Install" button
- Tapping "Install" triggers the browser's install dialog
- Banner disappears after successful installation
- "Later" button hides banner temporarily (returns on next visit)
- "X" button permanently dismisses banner until app is installed

#### iOS
- Shows banner with installation instructions
- Displays step-by-step guide:
  1. Tap the Share button
  2. Select "Add to Home Screen"
  3. Tap "Add" to confirm
- "Later" button hides banner temporarily
- "X" button permanently dismisses banner until app is installed

### Persistence

The banner remains visible across sessions **unless**:
- User successfully installs the app
- User explicitly closes it (X button)
- App is already installed

Tapping "Later" just hides it temporarily - it reappears on the next visit.

## Technical Details

### Storage
- Uses `localStorage.install_banner_dismissed` to track dismissal
- Key gets cleared when app is installed
- Banner reappears on next session if not installed

### Detection Methods
1. **Standalone Mode:** `window.matchMedia("(display-mode: standalone)")`
2. **iOS Detection:** User agent check for iPad/iPhone/iPod
3. **beforeinstallprompt:** Android native prompt event

### Display
- Fixed position at bottom of screen
- Positions above mobile bottom nav (z-50)
- Responsive: Full width on mobile, max-width on desktop
- Animated slide-in from bottom
- Color-coded: Primary gradient background

## Files

- **Component:** `src/components/InstallBanner.tsx`
- **Integration:** `src/components/layout/AppShell.tsx`

## How Users Install

### iOS
1. Open app in Safari or any browser
2. Tap Share button (⬆️ at bottom)
3. Scroll and tap "Add to Home Screen"
4. Customize name if desired
5. Tap "Add"

### Android
1. Open app in Chrome or any supported browser
2. Tap the app menu (⋮ at top right)
3. Tap "Install app" (if available)
4. Confirm installation
5. App opens in fullscreen mode

## Browser Compatibility

| Browser | Support | Method |
|---------|---------|--------|
| Chrome | ✅ Full | beforeinstallprompt |
| Firefox | ✅ Full | beforeinstallprompt |
| Safari (iOS) | ⚠️ Manual | Instructions shown |
| Safari (Mac) | ✅ Full | beforeinstallprompt |
| Edge | ✅ Full | beforeinstallprompt |
| Samsung Internet | ✅ Full | beforeinstallprompt |

## Customization

To modify the banner appearance:

### Colors
Edit `InstallBanner.tsx`:
```tsx
// Change from 'primary' to any color
className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground"
```

### Text
Edit the `<p>` tags:
```tsx
<p className="font-semibold text-sm">Install MUSEMBI PMS</p>
```

### Position
Change from `bottom-0` to `top-0` for top banner:
```tsx
<div className="fixed top-0 left-0 right-0 z-50 ...">
```

### Icon
Replace `Download` icon with any from lucide-react:
```tsx
import { Home, Settings, AlertCircle } from "lucide-react";
```

## Analytics (Optional)

To track installations, add events:

```tsx
const handleInstall = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      // Track installation
      trackEvent("app_installed", { platform: "android" });
    }
  }
};
```

## Troubleshooting

### Banner not showing on Android
- Ensure PWA manifest is configured
- Check browser supports beforeinstallprompt
- Verify app meets PWA requirements

### Banner not showing on iOS
- Manually check iOS detection in browser console
- Verify user agent string includes "iPhone", "iPad", or "iPod"
- Check localStorage for dismissal flag

### Banner keeps reappearing after install
- Clear browser cache and localStorage
- Verify app is in standalone mode (`display-mode: standalone`)
- Check manifest.webmanifest has correct configuration

### Install button not working
- Ensure PWA criteria are met
- Check browser console for errors
- Try in Chrome/Edge first (best support)

## PWA Requirements

For the install button to work on Android, ensure:

1. **manifest.webmanifest** exists and is valid
2. **HTTPS** is enabled (required for PWA)
3. **Service Worker** is registered
4. **Icons** are properly configured (192x192, 512x512)
5. **Display** is set to "standalone" or "minimal-ui"

## Performance

- Minimal impact: ~2KB component
- No dependencies beyond React
- Runs on component mount only
- Uses browser native APIs (no external libraries)
- LocalStorage check is synchronous (fast)

## Accessibility

- Keyboard navigation supported
- High contrast colors (primary background)
- Clear instructions for all users
- Descriptive text and buttons
- No auto-dismiss (respects user choice)

## Future Enhancements

Possible additions:
- Track installation success/failure
- Custom dismissal time (e.g., show again after 7 days)
- A/B testing different messages
- Deep linking to app features
- Notification when update is available
