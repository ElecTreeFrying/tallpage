import AppKit
import Foundation

struct IconExport {

  let canvas: Int

  let artwork: Int

  let path: String

}

let project = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
let master = project.appendingPathComponent("store/icon-master.svg")

guard let image = NSImage(contentsOf: master) else {
  fputs("Could not read store/icon-master.svg\n", stderr)
  exit(1)
}

let exports = [
  IconExport(canvas: 16, artwork: 16, path: "public/icon/16.png"),
  IconExport(canvas: 32, artwork: 32, path: "public/icon/32.png"),
  IconExport(canvas: 48, artwork: 48, path: "public/icon/48.png"),
  IconExport(canvas: 96, artwork: 96, path: "public/icon/96.png"),
  IconExport(canvas: 128, artwork: 96, path: "public/icon/128.png"),
  IconExport(canvas: 512, artwork: 512, path: "store/icon-512.png")
]

for item in exports {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: item.canvas,
    pixelsHigh: item.canvas,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    fputs("Could not allocate \(item.canvas)px bitmap\n", stderr)
    exit(1)
  }

  bitmap.size = NSSize(width: item.canvas, height: item.canvas)

  guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("Could not create \(item.canvas)px graphics context\n", stderr)
    exit(1)
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.imageInterpolation = .none
  context.cgContext.setShouldAntialias(false)

  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: item.canvas, height: item.canvas).fill(using: .copy)

  let inset = (item.canvas - item.artwork) / 2
  image.draw(
    in: NSRect(x: inset, y: inset, width: item.artwork, height: item.artwork),
    from: NSRect(origin: .zero, size: image.size),
    operation: .sourceOver,
    fraction: 1,
    respectFlipped: false,
    hints: [ .interpolation: NSImageInterpolation.none ]
  )

  NSGraphicsContext.restoreGraphicsState()

  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Could not encode \(item.path)\n", stderr)
    exit(1)
  }

  do {
    try data.write(to: project.appendingPathComponent(item.path), options: .atomic)
  } catch {
    fputs("Could not write \(item.path): \(error)\n", stderr)
    exit(1)
  }
}
