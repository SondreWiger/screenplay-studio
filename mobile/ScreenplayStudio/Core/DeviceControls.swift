import UIKit

/// Lets one screen rotate on iPhone while the rest of the app stays portrait.
///
/// The slate is the only screen that wants landscape on a phone — a board is
/// wider than it is tall, and held in front of a lens it should fill the
/// frame. iPad rotates everywhere, as iPad apps must for multitasking.
@MainActor
enum OrientationLock {

    static private(set) var mask: UIInterfaceOrientationMask =
        UIDevice.current.userInterfaceIdiom == .pad ? .all : .portrait

    static func allowLandscape(_ allow: Bool) {
        guard UIDevice.current.userInterfaceIdiom == .phone else { return }
        mask = allow ? .allButUpsideDown : .portrait
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows {
                window.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            }
            if !allow {
                scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
            }
        }
    }
}

/// Owns screen orientation for the app; everything else is SwiftUI.
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        OrientationLock.mask
    }
}

/// Full brightness while the slate is in front of a lens, and the user's own
/// setting back the moment it isn't — including when the app is backgrounded,
/// since iOS keeps whatever brightness an app leaves behind.
@MainActor
enum ScreenBrightness {

    private static var saved: CGFloat?

    static func boost() {
        guard let screen else { return }
        if saved == nil { saved = screen.brightness }
        screen.brightness = 1
    }

    static func restore() {
        guard let saved, let screen else { return }
        screen.brightness = saved
        self.saved = nil
    }

    private static var screen: UIScreen? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return (scenes.first { $0.activationState == .foregroundActive } ?? scenes.first)?.screen
    }
}

/// Mac Catalyst window chrome: a sensible minimum size so the sidebar and a
/// readable column always fit, and a unified title bar so the window reads as
/// a Mac app rather than an iPad in a frame. A no-op on iPhone and iPad.
@MainActor
enum MacWindow {
    static func configure() {
        #if targetEnvironment(macCatalyst)
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            scene.sizeRestrictions?.minimumSize = CGSize(width: 900, height: 640)
            scene.sizeRestrictions?.maximumSize = CGSize(width: 4_000, height: 3_000)
            if let titlebar = scene.titlebar {
                titlebar.toolbarStyle = .unified
                titlebar.separatorStyle = .none
            }
        }
        #endif
    }
}
