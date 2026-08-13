#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_PATH="${SCRIPT_DIR:h}"
APP_PATH="$HOME/Applications/履析简历助手.app"
DESKTOP_LINK="$HOME/Desktop/履析简历助手.app"
SOURCE_PATH="$SCRIPT_DIR/履析简历助手.applescript"
TEMP_DIR="$(mktemp -d)"
ICONSET="$TEMP_DIR/履析.iconset"
TEMP_APP="$TEMP_DIR/履析简历助手.app"
COMPILED_SOURCE="$TEMP_DIR/履析简历助手.applescript"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "${APP_PATH:h}"

if [[ -e "$APP_PATH" || -L "$APP_PATH" ]]; then
  BACKUP_PATH="${APP_PATH%.app}-旧版-$(date +%Y%m%d-%H%M%S).app"
  mv "$APP_PATH" "$BACKUP_PATH"
  echo "旧版已备份到：$BACKUP_PATH"
fi

if [[ -e "$DESKTOP_LINK" || -L "$DESKTOP_LINK" ]]; then
  mv "$DESKTOP_LINK" "$TEMP_DIR/旧桌面启动器.app"
fi

/usr/bin/qlmanage -t -s 1024 -o "$TEMP_DIR" "$SCRIPT_DIR/icon.svg" >/dev/null 2>&1
ICON_SOURCE="$TEMP_DIR/icon.svg.png"
mkdir -p "$ICONSET"

for size in 16 32 128 256 512; do
  /usr/bin/sips -z "$size" "$size" "$ICON_SOURCE" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  /usr/bin/sips -z "$double_size" "$double_size" "$ICON_SOURCE" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

/usr/bin/iconutil -c icns "$ICONSET" -o "$TEMP_DIR/履析.icns"
escaped_project="${PROJECT_PATH//\\/\\\\}"
escaped_project="${escaped_project//&/\\&}"
escaped_project="${escaped_project//|/\\|}"
/usr/bin/sed "s|__PROJECT_PATH__|$escaped_project|g" "$SOURCE_PATH" > "$COMPILED_SOURCE"
/usr/bin/osacompile -o "$TEMP_APP" "$COMPILED_SOURCE"
/bin/cp "$TEMP_DIR/履析.icns" "$TEMP_APP/Contents/Resources/applet.icns"

/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.luxi.resume-studio" "$TEMP_APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.luxi.resume-studio" "$TEMP_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string 履析简历助手" "$TEMP_APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 履析简历助手" "$TEMP_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :LSApplicationCategoryType string public.app-category.productivity" "$TEMP_APP/Contents/Info.plist" 2>/dev/null || true
/usr/bin/xattr -cr "$TEMP_APP"
/usr/bin/codesign --force --deep --sign - "$TEMP_APP" >/dev/null
/usr/bin/ditto --noqtn "$TEMP_APP" "$APP_PATH"
/usr/bin/xattr -cr "$APP_PATH"
/usr/bin/codesign --verify --deep --strict "$APP_PATH"
/bin/ln -s "$APP_PATH" "$DESKTOP_LINK"

echo "APP 已安装：$APP_PATH"
echo "桌面入口：$DESKTOP_LINK"
