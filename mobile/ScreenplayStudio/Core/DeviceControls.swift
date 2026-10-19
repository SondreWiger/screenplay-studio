import UIKit

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
