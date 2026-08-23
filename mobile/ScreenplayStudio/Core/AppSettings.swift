import SwiftUI
import Combine

/// User preferences that shape how the app behaves on a phone.
@MainActor
final class AppSettings: ObservableObject {

    static let shared = AppSettings()

    /// Haptic feedback throughout the app.
    @AppStorage("ss.settings.haptics") var hapticsEnabled = true {
        willSet { objectWillChange.send() }
    }

    /// Extra size steps for the screenplay page, on top of Dynamic Type.
    /// Writers often want the page smaller than their system size to fit a line.
    @AppStorage("ss.settings.editorScale") var editorScale: Double = 1.0 {
        willSet { objectWillChange.send() }
    }

    /// Keep the screen awake while the editor is open — for writing on set.
    @AppStorage("ss.settings.keepAwakeWhileWriting") var keepAwakeWhileWriting = false {
        willSet { objectWillChange.send() }
    }

    /// Skip image prefetching and widen autosave debounce on cellular.
    @AppStorage("ss.settings.dataSaver") var dataSaver = false {
        willSet { objectWillChange.send() }
    }

    /// Show the element type bar above the keyboard in the editor.
    @AppStorage("ss.settings.showElementBar") var showElementBar = true {
        willSet { objectWillChange.send() }
    }

    /// Last project opened, so launching goes straight back to work.
    @AppStorage("ss.settings.lastProjectID") var lastProjectID: String = "" {
        willSet { objectWillChange.send() }
    }

    private init() {}

    /// Autosave debounce, widened when the user is paying per megabyte.
    func autosaveDelay(isExpensive: Bool) -> Duration {
        (dataSaver || isExpensive) ? .seconds(3) : .milliseconds(900)
    }

    var clampedEditorScale: Double {
        min(max(editorScale, 0.75), 1.6)
    }
}
