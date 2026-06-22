# Build Resources

## Icons Required

To build the Electron app, you need to create the following icon files:

### macOS
- `icon.icns` — 1024x1024 PNG, converted to .icns format
  - Use `png2icns` or an online converter
  - Include all standard sizes: 16, 32, 64, 128, 256, 512, 1024

### Windows
- `icon.ico` — 256x256 PNG, converted to .ico format
  - Use `png2ico` or an online converter
  - Include sizes: 16, 32, 48, 256

### Linux
- Icons are auto-generated from a 512x512+ PNG by electron-builder
- Place a `icon.png` (512x512 or larger) in this directory

## Quick Icon Generation

If you have a 1024x1024 PNG logo:

```bash
# macOS (requires ImageMagick)
convert icon-1024.png -resize 1024 icon.icns

# Windows (requires ImageMagick)
convert icon-1024.png -resize 256 icon.ico

# Linux (just copy)
cp icon-1024.png icon.png
```

## Code Signing

Without code signing, users will see scary warnings:
- **macOS**: "Screenplay Studio can't be opened because Apple cannot check it for malicious software"
- **Windows**: "Windows protected your PC — SmartScreen prevented an unrecognized app from starting"

### macOS Code Signing + Notarization

**Requirements:**
1. Apple Developer Program membership ($99/year)
2. A "Developer ID Application" certificate
3. An app-specific password for notarization

**Setup:**

1. **Create a signing certificate:**
   - Go to [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates)
   - Create a "Developer ID Application" certificate
   - Download and install it in Keychain Access

2. **Create an app-specific password:**
   - Go to [appleid.apple.com](https://appleid.apple.com)
   - Sign in → App-Specific Passwords → Generate
   - Save the password

3. **Set GitHub Secrets:**
   ```
   CSC_LINK: <base64-encoded .p12 certificate>
             To encode: base64 -i certificate.p12 | pbcopy
   CSC_KEY_PASSWORD: <password for the .p12>
   APPLE_ID: <your Apple ID email>
   APPLE_APP_SPECIFIC_PASSWORD: <app-specific password from step 2>
   APPLE_TEAM_ID: <your 10-character Team ID>
   ```

4. **How it works:**
   - `electron-builder` signs the .app bundle with your certificate
   - After building, it uploads to Apple's notarization service
   - Apple scans for malware and returns a ticket
   - The ticket is stapled to the .dmg so Gatekeeper trusts it offline

### Windows Code Signing

**Requirements:**
1. A code signing certificate (EV or OV recommended)
   - Options: DigiCert, Sectigo, GlobalSign, Certum
   - EV certificates include a hardware token — needed for SmartScreen reputation
2. A hardware token or PFX file

**Setup:**

1. **Get a code signing certificate:**
   - Purchase from a Certificate Authority (CA)
   - OV: ~$80-200/year (may trigger SmartScreen warnings initially)
   - EV: ~$200-500/year (instant SmartScreen trust)

2. **Set GitHub Secrets:**
   ```
   CSC_LINK: <base64-encoded .pfx certificate>
             To encode: base64 -i certificate.pfx | pbcopy
   CSC_KEY_PASSWORD: <password for the .pfx>
   ```

3. **For EV certificates with hardware tokens:**
   - You'll need a custom GitHub Actions workflow with a physical token
   - Or use a cloud HSM service like Azure Key Vault or AWS CloudHSM
   - electron-builder supports this via `CSC_LINK` + `CSC_KEY_PASSWORD` for PFX

### Linux

Linux doesn't have code signing. AppImages are unsigned by default.
For distribution, you can:
- Host on your own website (recommended)
- Submit to Flathub or Snap Store (they have their own review process)
- Sign with GPG for package managers

## Build Commands

```bash
# Build for current platform
npm run electron:build:mac     # macOS .dmg
npm run electron:build:win     # Windows .exe
npm run electron:build:linux   # Linux .AppImage

# Build for all platforms (needs each OS)
npm run electron:build:all
```

## GitHub Actions

The `.github/workflows/build-desktop.yml` workflow:
1. Triggers on version tags (`v*`) or manual dispatch
2. Builds on macOS, Windows, and Linux in parallel
3. Creates a GitHub Release with all artifacts
4. Uses the signing secrets from GitHub Settings → Secrets

**To release:**
```bash
git tag v1.0.0
git push origin v1.0.0
```
This triggers the build and creates a release with all platform installers.

## First Launch Performance

The Electron app is optimized for fast first launch:
- Window shows immediately with `show: false` → `ready-to-show` pattern
- Background color is set to match the app theme (no white flash)
- Menu and auto-updater are deferred until after first paint
- File system operations use lazy `import()` to avoid blocking startup
