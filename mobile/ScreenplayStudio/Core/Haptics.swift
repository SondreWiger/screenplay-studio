import UIKit

/// Centralised haptics.
///
/// Generators are kept alive and pre-warmed because creating one on demand adds
/// perceptible latency to the first tap. Every call is a no-op when the user has
/// haptics switched off in Settings.
@MainActor
enum Haptics {

    private static let selection = UISelectionFeedbackGenerator()
    private static let impactLight = UIImpactFeedbackGenerator(style: .light)
    private static let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private static let notification = UINotificationFeedbackGenerator()

    private static var isEnabled: Bool {
        AppSettings.shared.hapticsEnabled
    }

    /// Call when a gesture that will end in haptics begins, so the Taptic Engine
    /// is already spun up when the feedback fires.
    static func prepare() {
        guard isEnabled else { return }
        selection.prepare()
        impactLight.prepare()
    }

    /// Moving between discrete values — element type picker, segmented controls.
    static func selectionChanged() {
        guard isEnabled else { return }
        selection.selectionChanged()
    }

    /// A light confirmation — toggling a checkbox, adding a line.
    static func tap() {
        guard isEnabled else { return }
        impactLight.impactOccurred()
    }

    /// A more substantial action — creating a scene, committing a reorder.
    static func impact() {
        guard isEnabled else { return }
        impactMedium.impactOccurred()
    }

    static func success() {
        guard isEnabled else { return }
        notification.notificationOccurred(.success)
    }

    static func warning() {
        guard isEnabled else { return }
        notification.notificationOccurred(.warning)
    }

    static func error() {
        guard isEnabled else { return }
        notification.notificationOccurred(.error)
    }
}
