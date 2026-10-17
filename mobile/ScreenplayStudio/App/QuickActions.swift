import SwiftUI
import UIKit

/// Home-screen quick actions (press and hold the app icon).
///
/// The items are dynamic: "Continue <last project>" names whatever was open
/// last, so they're rebuilt whenever the app goes to the background.
@MainActor
final class QuickActions: ObservableObject {

    static let shared = QuickActions()

    enum Action: Equatable {
        case newProject
        case today
        case openProject(id: String)
    }

    /// Set when the app is launched or woken by a quick action; the shell
    /// performs it and clears it.
    @Published var pending: Action?

    private enum Kind: String {
        case newProject = "no.northem.screenplaystudio.new-project"
        case today = "no.northem.screenplaystudio.today"
        case openProject = "no.northem.screenplaystudio.open-project"
    }

    private static let projectIDKey = "projectID"

    private init() {}

    func handle(_ item: UIApplicationShortcutItem) {
        switch Kind(rawValue: item.type) {
        case .newProject:
            pending = .newProject
        case .today:
            pending = .today
        case .openProject:
            if let id = item.userInfo?[Self.projectIDKey] as? String {
                pending = .openProject(id: id)
            }
        case .none:
            break
        }
    }

    /// Rebuild the icon's menu around the most recent project.
    func refreshShortcutItems(lastProject: Project?) {
        var items: [UIApplicationShortcutItem] = []

        if let lastProject {
            items.append(UIApplicationShortcutItem(
                type: Kind.openProject.rawValue,
                localizedTitle: "Continue “\(lastProject.title)”",
                localizedSubtitle: lastProject.resolvedFormat.label,
                icon: UIApplicationShortcutIcon(systemImageName: "pencil.line"),
                userInfo: [Self.projectIDKey: lastProject.id as NSString]
            ))
        }

        items.append(UIApplicationShortcutItem(
            type: Kind.today.rawValue,
            localizedTitle: "Today",
            localizedSubtitle: "What’s scheduled",
            icon: UIApplicationShortcutIcon(systemImageName: "calendar.day.timeline.left"),
            userInfo: nil
        ))

        items.append(UIApplicationShortcutItem(
            type: Kind.newProject.rawValue,
            localizedTitle: "New Project",
            localizedSubtitle: nil,
            icon: UIApplicationShortcutIcon(systemImageName: "plus"),
            userInfo: nil
        ))

        UIApplication.shared.shortcutItems = items
    }
}

// MARK: - UIKit hooks

/// SwiftUI has no scene-level hook for quick actions, so the app delegate
/// installs a scene delegate that forwards them. SwiftUI still owns the window.
final class AppDelegate: NSObject, UIApplicationDelegate {

    /// iPhone is portrait except where a screen asks otherwise (the slate
    /// board); iPad turns freely.
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        OrientationLock.mask
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        // A cold launch from a quick action delivers it here, not to the scene.
        if let item = options.shortcutItem {
            Task { @MainActor in QuickActions.shared.handle(item) }
        }
        let configuration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

final class SceneDelegate: NSObject, UIWindowSceneDelegate {

    func windowScene(
        _ windowScene: UIWindowScene,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        Task { @MainActor in QuickActions.shared.handle(shortcutItem) }
        completionHandler(true)
    }
}
