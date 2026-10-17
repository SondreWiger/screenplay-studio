import SwiftUI
import Combine

/// What the app opens to.
enum LaunchDestination: String, CaseIterable, Identifiable {
    case projects, today, lastProject

    var id: String { rawValue }

    var label: String {
        switch self {
        case .projects:    return "Projects"
        case .today:       return "Today"
        case .lastProject: return "Last project"
        }
    }
}

/// Line spacing on the script page.
enum EditorLineSpacing: String, CaseIterable, Identifiable {
    case compact, standard, relaxed

    var id: String { rawValue }

    var label: String {
        switch self {
        case .compact:  return "Compact"
        case .standard: return "Standard"
        case .relaxed:  return "Relaxed"
        }
    }

    /// Extra leading as a fraction of the font size.
    var leadingFactor: CGFloat {
        switch self {
        case .compact:  return 0.08
        case .standard: return 0.18
        case .relaxed:  return 0.34
        }
    }
}

/// The tools on a project's home screen. Their order and visibility are the
/// user's to arrange (Settings → Project tools, or Edit on the hub).
enum HubTool: String, CaseIterable, Identifiable, Codable {
    case documents, scenes, shots, schedule, characters, gear, slate

    var id: String { rawValue }

    var title: String {
        switch self {
        case .documents:  return "Documents"
        case .scenes:     return "Scenes & breakdown"
        case .shots:      return "Shot list"
        case .schedule:   return "Schedule"
        case .characters: return "Characters"
        case .gear:       return "Gear"
        case .slate:      return "Slate"
        }
    }

    var symbol: String {
        switch self {
        case .documents:  return "doc.richtext"
        case .scenes:     return "list.bullet.rectangle"
        case .shots:      return "camera"
        case .schedule:   return "calendar"
        case .characters: return "person.2"
        case .gear:       return "shippingbox"
        case .slate:      return "camera.aperture"
        }
    }

    var tint: Color {
        switch self {
        case .documents:  return Color(hex: 0x14B8A6)
        case .scenes:     return Color(hex: 0x8B5CF6)
        case .shots:      return Color(hex: 0x06B6D4)
        case .schedule:   return Color(hex: 0x22C55E)
        case .characters: return Color(hex: 0xEC4899)
        case .gear:       return Color(hex: 0xF97316)
        case .slate:      return Color(hex: 0xF59E0B)
        }
    }

    var route: ProjectRoute {
        switch self {
        case .documents:  return .documents
        case .scenes:     return .scenes
        case .shots:      return .shots
        case .schedule:   return .schedule
        case .characters: return .characters
        case .gear:       return .gear
        case .slate:      return .slate
        }
    }

    /// The writing-first order a new install starts with.
    static let defaultOrder: [HubTool] = [.documents, .characters, .scenes, .shots, .schedule, .slate, .gear]
}

/// User preferences that shape how the app looks and behaves.
@MainActor
final class AppSettings: ObservableObject {

    static let shared = AppSettings()

    // MARK: - Appearance

    /// Light, Dark or follow the system.
    @AppStorage("ss.settings.appearance") var appearance: AppearanceMode = .system {
        willSet { objectWillChange.send() }
    }

    /// The accent colour used for buttons, selection and highlights.
    @AppStorage(AccentChoice.storageKey) var accent: AccentChoice = .ember {
        willSet { objectWillChange.send() }
    }

    /// Haptic feedback throughout the app.
    @AppStorage("ss.settings.haptics") var hapticsEnabled = true {
        willSet { objectWillChange.send() }
    }

    // MARK: - Launch

    @AppStorage("ss.settings.launchDestination") var launchDestination: LaunchDestination = .projects {
        willSet { objectWillChange.send() }
    }

    /// Last project opened, so launching can go straight back to work.
    @AppStorage("ss.settings.lastProjectID") var lastProjectID: String = "" {
        willSet { objectWillChange.send() }
    }

    // MARK: - Writing

    /// Extra size steps for the screenplay page, on top of Dynamic Type.
    /// Writers often want the page smaller than their system size to fit a line.
    @AppStorage("ss.settings.editorScale") var editorScale: Double = 1.0 {
        willSet { objectWillChange.send() }
    }

    @AppStorage("ss.settings.editorLineSpacing") var editorLineSpacing: EditorLineSpacing = .standard {
        willSet { objectWillChange.send() }
    }

    /// Draw the script as a sheet of paper on wide screens (iPad, landscape).
    @AppStorage("ss.settings.editorPaper") var editorPaper = true {
        willSet { objectWillChange.send() }
    }

    /// Dim every line except the one being written.
    @AppStorage("ss.settings.focusMode") var focusMode = false {
        willSet { objectWillChange.send() }
    }

    /// Keep the line being written in the middle of the screen.
    @AppStorage("ss.settings.typewriterScrolling") var typewriterScrolling = true {
        willSet { objectWillChange.send() }
    }

    /// Scene numbers beside scene headings.
    @AppStorage("ss.settings.showSceneNumbers") var showSceneNumbers = true {
        willSet { objectWillChange.send() }
    }

    /// Keep the screen awake while the editor is open — for writing on set.
    @AppStorage("ss.settings.keepAwakeWhileWriting") var keepAwakeWhileWriting = false {
        willSet { objectWillChange.send() }
    }

    /// Show the element type bar above the keyboard in the editor.
    @AppStorage("ss.settings.showElementBar") var showElementBar = true {
        willSet { objectWillChange.send() }
    }

    // MARK: - Production

    /// Skip image prefetching and widen autosave debounce on cellular.
    @AppStorage("ss.settings.dataSaver") var dataSaver = false {
        willSet { objectWillChange.send() }
    }

    /// Play a sound when the slate is clapped. Off by default on set is a
    /// matter of taste, so it is a switch rather than an assumption.
    @AppStorage("ss.settings.slateSound") var slateSoundEnabled = true {
        willSet { objectWillChange.send() }
    }

    // MARK: - Library

    /// Projects pinned to the top of the list and the iPad sidebar.
    @AppStorage("ss.settings.pinnedProjects") private var pinnedProjectsRaw: String = "" {
        willSet { objectWillChange.send() }
    }

    /// Hub tools in the user's order, comma-separated raw values.
    @AppStorage("ss.settings.hubToolOrder") private var hubToolOrderRaw: String = "" {
        willSet { objectWillChange.send() }
    }

    /// Hub tools the user has hidden.
    @AppStorage("ss.settings.hiddenHubTools") private var hiddenHubToolsRaw: String = "" {
        willSet { objectWillChange.send() }
    }

    private init() {}

    // MARK: - Derived

    /// Autosave debounce, widened when the user is paying per megabyte.
    func autosaveDelay(isExpensive: Bool) -> Duration {
        (dataSaver || isExpensive) ? .seconds(3) : .milliseconds(900)
    }

    var clampedEditorScale: Double {
        min(max(editorScale, 0.75), 1.6)
    }

    // MARK: Pinned projects

    var pinnedProjectIDs: [String] {
        pinnedProjectsRaw.split(separator: ",").map(String.init)
    }

    func isPinned(_ projectID: String) -> Bool {
        pinnedProjectIDs.contains(projectID)
    }

    func togglePin(_ projectID: String) {
        var ids = pinnedProjectIDs
        if let index = ids.firstIndex(of: projectID) {
            ids.remove(at: index)
        } else {
            ids.insert(projectID, at: 0)
        }
        pinnedProjectsRaw = ids.joined(separator: ",")
    }

    // MARK: Hub tools

    /// Every tool, in the user's order. Tools added in a later version that the
    /// stored order doesn't mention are appended rather than lost.
    var hubToolOrder: [HubTool] {
        let stored = hubToolOrderRaw.split(separator: ",").compactMap { HubTool(rawValue: String($0)) }
        guard !stored.isEmpty else { return HubTool.defaultOrder }
        return stored + HubTool.defaultOrder.filter { !stored.contains($0) }
    }

    var hiddenHubTools: Set<HubTool> {
        Set(hiddenHubToolsRaw.split(separator: ",").compactMap { HubTool(rawValue: String($0)) })
    }

    var visibleHubTools: [HubTool] {
        let hidden = hiddenHubTools
        return hubToolOrder.filter { !hidden.contains($0) }
    }

    func setHubToolOrder(_ tools: [HubTool]) {
        hubToolOrderRaw = tools.map(\.rawValue).joined(separator: ",")
    }

    func setHubTool(_ tool: HubTool, hidden: Bool) {
        var set = hiddenHubTools
        if hidden { set.insert(tool) } else { set.remove(tool) }
        hiddenHubToolsRaw = HubTool.allCases.filter { set.contains($0) }.map(\.rawValue).joined(separator: ",")
    }

    func resetHubTools() {
        hubToolOrderRaw = ""
        hiddenHubToolsRaw = ""
    }
}
