#!/usr/bin/env bash
# Build Screenplay Studio and launch it on an iPad simulator, a connected
# iPhone, or both. Run on a Mac with Xcode 16 or newer.
#
#   mobile/run.sh ipad                 iPad simulator (the largest iPad Pro installed)
#   mobile/run.sh iphone ["name"]      a connected iPhone (default: the first one found)
#   mobile/run.sh both ["name"]        both of the above
#
# The iPhone has to be paired with this Mac (connected by cable once, "Trust
# This Computer"), with Developer Mode on (Settings › Privacy & Security). The
# first install on a phone may also need the developer profile trusted under
# Settings › General › VPN & Device Management.
set -euo pipefail

cd "$(dirname "$0")"
PROJECT="ScreenplayStudio.xcodeproj"
SCHEME="ScreenplayStudio"
BUNDLE_ID="no.northem.screenplaystudio"
DERIVED="${DERIVED_DATA:-$PWD/build/DerivedData}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v xcodebuild >/dev/null || fail "xcodebuild not found: install Xcode and run 'sudo xcode-select -s /Applications/Xcode.app'."

built_app() {
  # The .app the last build put in Build/Products/<config>-<platform>.
  find "$DERIVED/Build/Products/Debug-$1" -maxdepth 1 -name '*.app' -print -quit
}

run_ipad() {
  say "Finding an iPad simulator…"
  local line udid
  line=$(xcrun simctl list devices available | grep -E 'iPad Pro 13-inch|iPad Pro \(12\.9' | tail -1 || true)
  [[ -n "$line" ]] || line=$(xcrun simctl list devices available | grep -E '^\s+iPad' | tail -1 || true)
  [[ -n "$line" ]] || fail "No iPad simulator installed. Add one in Xcode › Settings › Platforms (iOS)."
  udid=$(grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' <<<"$line" | head -1)
  echo "  ${line#"${line%%[![:space:]]*}"}"

  say "Building for the simulator…"
  xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug \
    -destination "id=$udid" -derivedDataPath "$DERIVED" build -quiet

  say "Launching on the iPad simulator…"
  xcrun simctl boot "$udid" 2>/dev/null || true
  open -a Simulator --args -CurrentDeviceUDID "$udid"
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl install "$udid" "$(built_app iphonesimulator)"
  xcrun simctl launch "$udid" "$BUNDLE_ID"
}

run_iphone() {
  local wanted="${1:-}"
  say "Finding ${wanted:-a connected iPhone}…"
  local json ids
  json=$(mktemp)
  xcrun devicectl list devices --json-output "$json" >/dev/null
  # identifier (for devicectl) and hardware UDID (for xcodebuild) of the
  # first matching iPhone that is paired.
  ids=$(/usr/bin/python3 - "$json" "$wanted" <<'PY'
import json, sys
devices = json.load(open(sys.argv[1]))["result"]["devices"]
wanted = sys.argv[2].lower()
for d in devices:
    hw, props = d.get("hardwareProperties", {}), d.get("deviceProperties", {})
    name = props.get("name", "")
    if hw.get("deviceType") != "iPhone":
        continue
    if wanted and wanted not in name.lower():
        continue
    if d.get("connectionProperties", {}).get("pairingState") != "paired":
        continue
    print(d["identifier"], hw.get("udid", ""), name, sep="\t")
    break
PY
)
  rm -f "$json"
  [[ -n "$ids" ]] || fail "No paired iPhone${wanted:+ named \"$wanted\"} found. Connect it, unlock it, and tap Trust."
  local device udid name
  IFS=$'\t' read -r device udid name <<<"$ids"
  echo "  $name"

  say "Building for $name…"
  xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug \
    -destination "id=$udid" -derivedDataPath "$DERIVED" -allowProvisioningUpdates build -quiet

  say "Installing and launching on $name…"
  xcrun devicectl device install app --device "$device" "$(built_app iphoneos)"
  xcrun devicectl device process launch --device "$device" "$BUNDLE_ID" \
    || echo "Installed. If it didn't open, unlock the phone (and trust the developer profile the first time), then tap the icon."
}

case "${1:-both}" in
  ipad)   run_ipad ;;
  iphone) run_iphone "${2:-}" ;;
  both)   run_ipad; run_iphone "${2:-}" ;;
  *)      fail "Usage: mobile/run.sh [ipad | iphone [\"name\"] | both [\"name\"]]" ;;
esac
