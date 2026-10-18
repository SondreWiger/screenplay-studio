// Generates the store artwork that isn't a screenshot, from the iOS app icon:
//
//   • Mac Catalyst icon sizes, in the macOS rounded-square shape with its
//     drop shadow (a full-bleed iOS square looks wrong in the Dock)
//   • Google Play: 512×512 icon and the 1024×500 feature graphic
//
//   swift store/tools/make-store-art.swift
//
// Re-run after changing AppIcon.png.
import AppKit

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
let iconURL = root.appendingPathComponent("mobile/ScreenplayStudio/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let icon = NSImage(contentsOf: iconURL), let iconCG = icon.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fatalError("Can't read \(iconURL.path)")
}

func render(_ width: Int, _ height: Int, _ draw: (CGContext) -> Void) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = ctx
    draw(ctx.cgContext)
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

func write(_ data: Data, _ path: String) {
    let url = root.appendingPathComponent(path)
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try! data.write(to: url)
    print("wrote \(path)")
}

// MARK: macOS icon — 824pt squircle on a 1024 canvas, per Apple's template.
func macIcon(_ px: Int) -> Data {
    render(px, px) { c in
        let s = CGFloat(px) / 1024
        let rect = CGRect(x: 100 * s, y: 100 * s, width: 824 * s, height: 824 * s)
        let path = CGPath(roundedRect: rect, cornerWidth: 185 * s, cornerHeight: 185 * s, transform: nil)
        c.saveGState()
        c.setShadow(offset: CGSize(width: 0, height: -10 * s), blur: 28 * s, color: NSColor.black.withAlphaComponent(0.35).cgColor)
        c.addPath(path); c.setFillColor(NSColor.black.cgColor); c.fillPath()
        c.restoreGState()
        c.addPath(path); c.clip()
        c.interpolationQuality = .high
        c.draw(iconCG, in: rect)
    }
}

let macSizes: [(String, Int, String)] = [
    ("16x16", 1, "16"), ("16x16", 2, "32"), ("32x32", 1, "32"), ("32x32", 2, "64"),
    ("128x128", 1, "128"), ("128x128", 2, "256"), ("256x256", 1, "256"), ("256x256", 2, "512"),
    ("512x512", 1, "512"), ("512x512", 2, "1024"),
]
var images: [[String: String]] = [["filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"]]
for (size, scale, px) in macSizes {
    let name = "Mac-\(size)@\(scale)x.png"
    write(macIcon(Int(px)!), "mobile/ScreenplayStudio/Resources/Assets.xcassets/AppIcon.appiconset/\(name)")
    images.append(["filename": name, "idiom": "mac", "scale": "\(scale)x", "size": size])
}
let contents: [String: Any] = ["images": images, "info": ["author": "xcode", "version": 1]]
write(try! JSONSerialization.data(withJSONObject: contents, options: [.prettyPrinted, .sortedKeys]),
      "mobile/ScreenplayStudio/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json")

// MARK: Google Play icon — 512×512, full square (Play applies its own mask).
write(render(512, 512) { c in c.interpolationQuality = .high; c.draw(iconCG, in: CGRect(x: 0, y: 0, width: 512, height: 512)) },
      "store/google-play/icon-512.png")

// MARK: Google Play feature graphic — 1024×500.
write(render(1024, 500) { c in
    let bg = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                        colors: [NSColor(srgbRed: 0.07, green: 0.07, blue: 0.13, alpha: 1).cgColor,
                                 NSColor(srgbRed: 0.027, green: 0.027, blue: 0.063, alpha: 1).cgColor] as CFArray,
                        locations: [0, 1])!
    c.drawLinearGradient(bg, start: CGPoint(x: 0, y: 500), end: CGPoint(x: 1024, y: 0), options: [])
    let glow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                          colors: [NSColor(srgbRed: 1, green: 0.37, blue: 0.12, alpha: 0.45).cgColor,
                                   NSColor(srgbRed: 1, green: 0.37, blue: 0.12, alpha: 0).cgColor] as CFArray,
                          locations: [0, 1])!
    c.drawRadialGradient(glow, startCenter: CGPoint(x: 230, y: 250), startRadius: 0, endCenter: CGPoint(x: 230, y: 250), endRadius: 420, options: [])
    let iconRect = CGRect(x: 120, y: 140, width: 220, height: 220)
    c.saveGState()
    c.addPath(CGPath(roundedRect: iconRect, cornerWidth: 50, cornerHeight: 50, transform: nil)); c.clip()
    c.draw(iconCG, in: iconRect)
    c.restoreGState()
    let title = NSAttributedString(string: "Screenplay Studio", attributes: [
        .font: NSFont.systemFont(ofSize: 58, weight: .bold), .foregroundColor: NSColor.white])
    title.draw(at: CGPoint(x: 390, y: 262))
    let tag = NSAttributedString(string: "Write it. Break it down. Shoot it.", attributes: [
        .font: NSFont.systemFont(ofSize: 30, weight: .medium),
        .foregroundColor: NSColor(srgbRed: 0.69, green: 0.69, blue: 0.8, alpha: 1)])
    tag.draw(at: CGPoint(x: 392, y: 205))
}, "store/google-play/feature-graphic-1024x500.png")
