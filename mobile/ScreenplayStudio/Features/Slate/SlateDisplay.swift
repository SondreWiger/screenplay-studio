import UIKit
import QuartzCore

/// Finds the moment the next frame reaches the screen, so the sync flash and
/// the sync beep can be made to coincide.
///
/// A state change made inside a display-link callback is committed with that
/// frame and shown at its `targetTimestamp`; iOS's compositor typically adds
/// one more refresh before it's lit. The beep is scheduled for that instant
/// (less the audio output latency, which `SlateAudio` subtracts), and the
/// user's calibration offset absorbs whatever this device does differently.
final class DisplaySyncTrigger: NSObject {

    private var link: CADisplayLink?
    private var handler: ((Double) -> Void)?

    /// Calls `handler` on the next display frame with the host time (seconds,
    /// `CACurrentMediaTime` base) at which a change made now will be visible.
    func next(_ handler: @escaping (_ visibleAtHostSeconds: Double) -> Void) {
        self.handler = handler
        link?.invalidate()
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        // Ask for the fastest refresh, so the uncertainty is as small as the
        // display allows: 8 ms on a ProMotion iPad, 17 ms at 60 Hz — under
        // half a frame at 24 fps either way.
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    @objc private func tick(_ link: CADisplayLink) {
        let refresh = link.targetTimestamp - link.timestamp
        let visibleAt = link.targetTimestamp + refresh
        link.invalidate()
        self.link = nil
        let handler = self.handler
        self.handler = nil
        handler?(visibleAt)
    }

    deinit { link?.invalidate() }
}

/// Lets a screen ask for landscape on iPhone, where the rest of the app is
/// portrait-only. The app delegate reads `mask`.
@MainActor
enum OrientationLock {

    static var mask: UIInterfaceOrientationMask = UIDevice.current.userInterfaceIdiom == .pad ? .all : .portrait

    /// Allow rotation (the slate) or snap back to portrait.
    static func allowLandscape(_ allow: Bool) {
        guard UIDevice.current.userInterfaceIdiom != .pad else { return }
        mask = allow ? .allButUpsideDown : .portrait
        for scene in windowScenes {
            scene.keyWindow?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            if !allow {
                scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
            }
        }
    }

    /// Turn back to portrait without locking it, so turning the phone
    /// sideways again still works.
    static func requestPortrait() {
        guard UIDevice.current.userInterfaceIdiom != .pad else { return }
        for scene in windowScenes where scene.interfaceOrientation.isLandscape {
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
        }
    }

    private static var windowScenes: [UIWindowScene] {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    }
}

/// Full brightness while the board is up — it has to read through a lens, often
/// outdoors — and the user's own level back afterwards.
@MainActor
enum ScreenBrightness {
    private static var saved: CGFloat?

    static func boost() {
        guard saved == nil else { return }
        saved = UIScreen.main.brightness
        UIScreen.main.brightness = 1
    }

    static func restore() {
        guard let saved else { return }
        UIScreen.main.brightness = saved
        self.saved = nil
    }
}
