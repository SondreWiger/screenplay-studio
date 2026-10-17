import SwiftUI

// MARK: - Board & sync setup

/// The marks that stay the same all day, the frame rate, and how the clap is
/// made: flash, beep and the calibration that lines them up.
struct SlateSetupSheet: View {

    @ObservedObject var model: SlateViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var production = ""
    @State private var director = ""
    @State private var camera = ""
    @State private var cameraLetter = "A"
    @State private var roll = ""
    @State private var soundRoll = ""
    @State private var lens = ""
    @State private var hasLoaded = false

    private static let cameraLetters = ["A", "B", "C", "D", "E"]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    textRow("Production", text: $production, placeholder: model.projectTitle, caps: .words)
                    textRow("Director", text: $director, placeholder: "Name", caps: .words)
                    textRow("Camera", text: $camera, placeholder: "DP or operator", caps: .words)
                } header: {
                    SettingsSectionHeader("On the board")
                }
                .listRowBackground(Theme.card)

                Section {
                    Picker("Camera", selection: $cameraLetter) {
                        ForEach(Self.cameraLetters, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    rollRow("Camera roll", text: $roll)
                    rollRow("Sound roll", text: $soundRoll)
                    textRow("Lens", text: $lens, placeholder: "e.g. 35mm", caps: .never)
                } header: {
                    SettingsSectionHeader("Camera & sound")
                } footer: {
                    footer("Rolls go into the camera and sound reports. Linking a shot fills in its lens.")
                }
                .listRowBackground(Theme.card)

                Section {
                    Picker("Frame rate", selection: Binding(
                        get: { model.state.frameRate },
                        set: { model.setFrameRate($0) }
                    )) {
                        ForEach(FrameRate.allCases) { rate in
                            Text(rate.label).tag(rate)
                        }
                    }
                    .foregroundStyle(Theme.textPrimary)
                } header: {
                    SettingsSectionHeader("Timecode")
                } footer: {
                    footer("Match the camera and the sound recorder. DF is drop-frame, ND non-drop.")
                }
                .listRowBackground(Theme.card)

                syncSection
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("Board & sync")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.body.weight(.semibold))
                }
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onAppear(perform: load)
        // Swiping the sheet away keeps the changes too.
        .onDisappear(perform: apply)
    }

    // MARK: Sync

    private var syncSection: some View {
        Section {
            Toggle("Flash on the clap", isOn: Binding(
                get: { model.state.flashEnabled },
                set: { on in model.update { $0.flashEnabled = on } }
            ))
            Toggle("Sync beep", isOn: Binding(
                get: { model.state.beepEnabled },
                set: { on in model.update { $0.beepEnabled = on } }
            ))

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Beep offset")
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text(offsetLabel)
                        .font(.body.monospacedDigit())
                        .foregroundStyle(Theme.textSecondary)
                }
                HStack(spacing: 8) {
                    offsetButton("−1 frame", delta: -frameMs)
                    offsetButton("−5 ms", delta: -5)
                    offsetButton("+5 ms", delta: 5)
                    offsetButton("+1 frame", delta: frameMs)
                }
                if model.state.syncOffsetMs != 0 {
                    Button("Reset to 0") {
                        model.update { $0.syncOffsetMs = 0 }
                        Haptics.tap()
                    }
                    .font(.footnote.weight(.semibold))
                }
            }
            .padding(.vertical, 4)
            .disabled(!model.state.beepEnabled)

            Button {
                model.testSync()
            } label: {
                Label("Test clap (not logged)", systemImage: "speaker.wave.2")
                    .font(.body.weight(.semibold))
            }
            .disabled(model.state.ltcOutputEnabled)
        } header: {
            SettingsSectionHeader("Sync")
        } footer: {
            footer(
                model.state.ltcOutputEnabled
                    ? "Timecode out is on, so the beep is off: the camera records the board’s timecode instead."
                    : "The screen flashes white for one frame and the beep starts on that same frame. To check this device, record a test clap with sound and step through it: if the beep lands after the white frame, move it earlier; if before, later."
            )
        }
        .listRowBackground(Theme.card)
    }

    private var frameMs: Int { Int((1000 / model.state.frameRate.actual).rounded()) }

    private var offsetLabel: String {
        let ms = model.state.syncOffsetMs
        guard ms != 0 else { return "0 ms" }
        let frames = Double(ms) / (1000 / model.state.frameRate.actual)
        return String(format: "%@%d ms (%@%.1f fr)", ms > 0 ? "+" : "", ms, ms > 0 ? "+" : "", frames)
    }

    private func offsetButton(_ title: String, delta: Int) -> some View {
        Button {
            model.update { $0.syncOffsetMs = max(-500, min(500, $0.syncOffsetMs + delta)) }
            Haptics.selectionChanged()
        } label: {
            Text(title)
                .font(.footnote.weight(.semibold).monospacedDigit())
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(Theme.elevated, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: Rows

    private func textRow(
        _ label: String,
        text: Binding<String>,
        placeholder: String,
        caps: TextInputAutocapitalization
    ) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .foregroundStyle(Theme.textPrimary)
            TextField(placeholder, text: text)
                .multilineTextAlignment(.trailing)
                .foregroundStyle(Theme.textSecondary)
                .textInputAutocapitalization(caps)
                .autocorrectionDisabled()
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private func rollRow(_ label: String, text: Binding<String>) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .foregroundStyle(Theme.textPrimary)
            TextField("A001", text: text)
                .multilineTextAlignment(.trailing)
                .font(.body.monospaced())
                .foregroundStyle(Theme.textSecondary)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
            Button {
                text.wrappedValue = SlateViewModel.increment(text.wrappedValue)
                Haptics.tap()
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.accent)
                    .tappableArea(36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Next \(label.lowercased())")
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private func footer(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(Theme.textTertiary)
    }

    // MARK: Draft

    private func load() {
        guard !hasLoaded else { return }
        hasLoaded = true
        let state = model.state
        production = state.production
        director = state.director
        camera = state.camera
        cameraLetter = Self.cameraLetters.contains(state.cameraLetter) ? state.cameraLetter : "A"
        roll = state.roll
        soundRoll = state.soundRoll
        lens = state.lens
    }

    private func apply() {
        func clean(_ value: String) -> String { value.trimmingCharacters(in: .whitespacesAndNewlines) }
        model.update { state in
            state.production = clean(production)
            state.director = clean(director)
            state.camera = clean(camera)
            state.cameraLetter = cameraLetter
            state.roll = clean(roll).nonEmpty ?? state.roll
            state.soundRoll = clean(soundRoll).nonEmpty ?? state.soundRoll
            state.lens = clean(lens)
        }
    }
}

// MARK: - What's being slated

/// Points the slate at a shot, a whole scene, or a scene and setup typed in.
struct SlateShotPicker: View {

    @ObservedObject var model: SlateViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""
    @State private var manualScene = ""
    @State private var manualSetup = ""
    @State private var hidesFinished = false

    private struct SceneGroup: Identifiable {
        let id: String
        let scene: ProductionScene?
        let shots: [Shot]
    }

    private var groups: [SceneGroup] {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return model.shotsByScene.compactMap { group -> SceneGroup? in
            var shots = group.shots
            if hidesFinished { shots = shots.filter { !$0.done } }
            if !term.isEmpty {
                let sceneMatches = [group.scene?.sceneNumber, group.scene?.displayHeading]
                    .compactMap { $0?.lowercased() }
                    .contains { $0.contains(term) }
                if !sceneMatches {
                    shots = shots.filter { shot in
                        [shot.shotNumber, shot.description, shot.techSummary]
                            .compactMap { $0?.lowercased() }
                            .contains { $0.contains(term) }
                    }
                    if shots.isEmpty { return nil }
                }
            }
            if hidesFinished, shots.isEmpty, group.scene?.done ?? true { return nil }
            return SceneGroup(id: group.scene?.id ?? "unassigned", scene: group.scene, shots: shots)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if searchText.isEmpty { manualSection }

                if model.shots.isEmpty && model.scenes.isEmpty {
                    Section {
                        EmptyStateView(
                            symbol: "camera",
                            title: "No shot list yet",
                            message: "Type the scene and setup above, or add scenes and shots to the project and every take will log against them."
                        )
                        .listRowBackground(Color.clear)
                    }
                } else if groups.isEmpty {
                    Section {
                        EmptyStateView(symbol: "magnifyingglass", title: "Nothing matches", message: "Try a scene or shot number.")
                            .listRowBackground(Color.clear)
                    }
                }

                ForEach(groups) { group in
                    Section {
                        if let scene = group.scene {
                            sceneRow(scene)
                        }
                        ForEach(group.shots) { shot in
                            shotRow(shot)
                        }
                    } header: {
                        SettingsSectionHeader(group.scene.map { "Scene \($0.sceneNumber ?? "–")" } ?? "No scene")
                    }
                    .listRowBackground(Theme.card)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .searchable(text: $searchText, prompt: "Scene or shot")
            .navigationTitle("What are we shooting?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Toggle("Hide finished shots", isOn: $hidesFinished)
                        if model.state.linkedShotID != nil || model.state.linkedSceneID != nil {
                            Button {
                                model.unlink()
                                dismiss()
                            } label: {
                                Label("Unlink from the shot list", systemImage: "xmark.circle")
                            }
                        }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle").tappableArea()
                    }
                    .accessibilityLabel("Options")
                }
            }
            .task { await model.loadContext() }
        }
        .tint(Theme.accent)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onAppear {
            manualScene = model.state.scene
            manualSetup = model.state.setup
        }
    }

    // MARK: Manual

    private var manualSection: some View {
        Section {
            HStack(spacing: 10) {
                compactField("Scene", text: $manualScene)
                compactField("Setup", text: $manualSetup)
                Button {
                    let scene = manualScene.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !scene.isEmpty else { return }
                    model.slate(scene: scene, setup: manualSetup.trimmingCharacters(in: .whitespacesAndNewlines))
                    dismiss()
                } label: {
                    Text("Slate")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 40)
                        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(manualScene.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.vertical, 4)
        } header: {
            SettingsSectionHeader("Type it in")
        } footer: {
            Text("For pickups, inserts or anything not on the shot list.")
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
        }
        .listRowBackground(Theme.card)
    }

    private func compactField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(Theme.textTertiary)
            TextField(label, text: text)
                .font(.title3.weight(.bold).monospaced())
                .foregroundStyle(Theme.textPrimary)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
        }
    }

    // MARK: Rows

    private func sceneRow(_ scene: ProductionScene) -> some View {
        let isCurrent = model.state.linkedShotID == nil && model.state.linkedSceneID == scene.id
        return Button {
            model.link(to: scene)
            dismiss()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: scene.done ? "checkmark.seal.fill" : "film")
                    .foregroundStyle(scene.done ? Theme.success : Theme.textTertiary)
                    .frame(width: 28)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(scene.displayHeading)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(2)
                    Text("Slate the whole scene")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }
                Spacer(minLength: 0)
                if isCurrent { currentMark }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Scene \(scene.sceneNumber ?? ""), \(scene.displayHeading)")
    }

    private func shotRow(_ shot: Shot) -> some View {
        let isCurrent = model.state.linkedShotID == shot.id
        let logged = model.takeCount(for: shot)
        return Button {
            model.link(to: shot)
            dismiss()
        } label: {
            HStack(spacing: 12) {
                Text(shot.displayNumber)
                    .font(.caption.weight(.bold).monospaced())
                    .foregroundStyle(isCurrent ? Theme.accent.readableForeground : Theme.accent)
                    .frame(minWidth: 40, minHeight: 30)
                    .padding(.horizontal, 4)
                    .background(isCurrent ? Theme.accent : Theme.accentSoft, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(shot.description?.nonEmpty ?? shot.techSummary.nonEmpty ?? "Shot \(shot.displayNumber)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(shot.done ? Theme.textTertiary : Theme.textPrimary)
                        .strikethrough(shot.done, color: Theme.textTertiary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        if !shot.techSummary.isEmpty, shot.description?.nonEmpty != nil {
                            Text(shot.techSummary)
                        }
                        if logged.total > 0 {
                            Text("\(logged.total) take\(logged.total == 1 ? "" : "s")\(logged.circled > 0 ? " · \(logged.circled) circled" : "")")
                        } else if let takes = shot.takesLabel {
                            Text(takes)
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .lineLimit(1)
                }
                Spacer(minLength: 0)
                if shot.done {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                        .accessibilityLabel("Done")
                }
                if isCurrent { currentMark }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    private var currentMark: some View {
        Chip(text: "On the board", tint: Theme.accent, prominent: true)
    }
}

// MARK: - Jam

/// Sets the board's timecode: from a recorder's LTC, by hand, or time of day.
struct JamSheet: View {

    @ObservedObject var model: SlateViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var digits = ""

    private var rate: FrameRate { model.state.frameRate }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    clock
                        .listRowBackground(Color.black)
                    HStack(spacing: 8) {
                        nudgeButton("−1 frame", frames: -1)
                        nudgeButton("+1 frame", frames: 1)
                    }
                    .listRowBackground(Theme.card)
                } footer: {
                    footer("Nudge to line the board up with a recorder’s display by eye.")
                }

                Section {
                    Picker("Frame rate", selection: Binding(get: { rate }, set: { model.setFrameRate($0) })) {
                        ForEach(FrameRate.allCases) { Text($0.label).tag($0) }
                    }
                    .foregroundStyle(Theme.textPrimary)

                    if model.isListeningForLTC {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text("Listening…")
                                .foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Button("Stop") { model.stopListening() }
                                .font(.body.weight(.semibold))
                        }
                        .frame(minHeight: Theme.minTouchTarget)
                    } else {
                        Button {
                            Haptics.tap()
                            model.listenForLTC()
                        } label: {
                            Label("Jam from the recorder’s timecode", systemImage: "waveform.and.mic")
                                .font(.body.weight(.semibold))
                        }
                        .frame(minHeight: Theme.minTouchTarget)
                    }
                    if let message = model.ltcMessage {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                } header: {
                    SettingsSectionHeader("From the sound recorder")
                } footer: {
                    footer("Plug the recorder’s timecode out into this device’s audio input, through a TRRS adapter or a USB-C or Lightning audio interface. The slate reads LTC, checks the frame rate and jams to the frame. Re-jam at lunch, as with any timecode box.")
                }
                .listRowBackground(Theme.card)

                Section {
                    HStack(spacing: 12) {
                        TextField(rate.isDropFrame ? "00:00:00;00" : "00:00:00:00", text: digitBinding)
                            .keyboardType(.numberPad)
                            .font(.title2.weight(.bold).monospaced())
                            .foregroundStyle(parsed == nil && digits.count == 8 ? Theme.danger : Theme.textPrimary)
                        PressDownButton(title: "Jam", isEnabled: parsed != nil) { touchAge in
                            guard let tc = parsed else { return }
                            model.jamManually(to: tc, at: SlateClock.now() - touchAge)
                            digits = ""
                        }
                    }
                    .frame(minHeight: Theme.minTouchTarget + 8)
                } header: {
                    SettingsSectionHeader("Type it in")
                } footer: {
                    footer("Type a timecode a few seconds ahead of the recorder, then press Jam the moment it shows that time. It jams as your finger touches, but by hand it’s good to a few frames: use the recorder’s timecode for frame-accurate sync.")
                }
                .listRowBackground(Theme.card)

                Section {
                    Button {
                        model.jamToTimeOfDay()
                    } label: {
                        Label("Run from time of day", systemImage: "clock")
                            .font(.body.weight(.semibold))
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                } footer: {
                    footer("Follows this device’s clock, which is set from the network. Matches a recorder on time-of-day timecode as closely as their clocks agree.")
                }
                .listRowBackground(Theme.card)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Timecode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.body.weight(.semibold))
                }
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onDisappear { model.stopListening() }
    }

    private var clock: some View {
        TimelineView(.animation) { _ in
            let tc = model.timecode(at: SlateClock.now())
            VStack(spacing: 4) {
                LEDTimecode(text: tc.formatted(rate))
                    .frame(height: 60)
                Text("\(rate.label) fps · \(model.timecodeSourceLabel)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
    }

    private func nudgeButton(_ title: String, frames: Int) -> some View {
        Button {
            model.nudgeJam(by: frames)
        } label: {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 38)
                .background(Theme.elevated, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    /// Digits typed, shown as HH:MM:SS:FF as they fill in.
    private var digitBinding: Binding<String> {
        Binding(
            get: { Self.format(digits, dropFrame: rate.isDropFrame) },
            set: { digits = String($0.filter(\.isNumber).prefix(8)) }
        )
    }

    private var parsed: Timecode? {
        guard digits.count == 8 else { return nil }
        return Timecode(parsing: Self.format(digits, dropFrame: rate.isDropFrame), rate: rate)
    }

    static func format(_ digits: String, dropFrame: Bool) -> String {
        var pairs: [String] = []
        var rest = Substring(digits)
        while !rest.isEmpty {
            pairs.append(String(rest.prefix(2)))
            rest = rest.dropFirst(2)
        }
        guard pairs.count == 4 else { return pairs.joined(separator: ":") }
        return pairs[0...2].joined(separator: ":") + (dropFrame ? ";" : ":") + pairs[3]
    }

    private func footer(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(Theme.textTertiary)
    }
}

/// A button that acts the instant it's touched, not when the finger lifts —
/// for jamming by hand, where a release lag is a frame or two of error.
///
/// The action gets how long ago the finger landed: a scrolling list holds a
/// touch back briefly before delivering it, and that wait is taken off.
private struct PressDownButton: View {
    let title: String
    let isEnabled: Bool
    let action: (_ touchAge: TimeInterval) -> Void

    @State private var isPressed = false

    var body: some View {
        Text(title)
            .font(.headline)
            .foregroundStyle(.white)
            .padding(.horizontal, 22)
            .frame(minHeight: 44)
            .background(isEnabled ? Theme.accent : Theme.textTertiary.opacity(0.4), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .scaleEffect(isPressed ? 0.94 : 1)
            .animation(.easeOut(duration: 0.1), value: isPressed)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard !isPressed else { return }
                        isPressed = true
                        let age = min(max(Date().timeIntervalSince(value.time), 0), 0.5)
                        if isEnabled { action(age) }
                    }
                    .onEnded { _ in isPressed = false }
            )
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(title)
            .accessibilityAction { if isEnabled { action(0) } }
    }
}

// MARK: - Take log

/// Every take on this device, by day, newest first.
struct SlateLogView: View {

    @ObservedObject var model: SlateViewModel
    @Environment(\.dismiss) private var dismiss

    enum Filter: String, CaseIterable, Identifiable {
        case all, circled, today
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: return "All"
            case .circled: return "Circled"
            case .today: return "Today"
            }
        }
    }

    @State private var filter: Filter = .all
    @State private var searchText = ""
    @State private var editingTake: SlateTake?
    @State private var sharedFile: SharedFile?
    @State private var isConfirmingClear = false
    @State private var exportError: String?

    private var filtered: [SlateTake] {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return model.takes.filter { take in
            switch filter {
            case .all: break
            case .circled: if take.rating != .circled { return false }
            case .today: if !Calendar.current.isDateInToday(take.markedAt) { return false }
            }
            guard !term.isEmpty else { return true }
            return [take.label, take.scene, take.setup, take.roll, take.soundRoll, take.timecode ?? "", take.note ?? ""]
                .contains { $0.lowercased().contains(term) }
        }
    }

    private struct Day: Identifiable {
        let day: Date
        let takes: [SlateTake]
        var id: Date { day }
    }

    private var days: [Day] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: filtered) { calendar.startOfDay(for: $0.markedAt) }
        return grouped.keys.sorted(by: >).map { day in
            Day(day: day, takes: grouped[day, default: []].sorted { $0.markedAt > $1.markedAt })
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    summary
                    Picker("Show", selection: $filter) {
                        ForEach(Filter.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

                if filtered.isEmpty {
                    Section {
                        EmptyStateView(
                            symbol: "list.bullet.rectangle",
                            title: model.takes.isEmpty ? "No takes yet" : "Nothing here",
                            message: model.takes.isEmpty
                                ? "Every mark is logged with its timecode, roll and rating, and written to the camera and sound reports."
                                : "No takes match."
                        )
                        .listRowBackground(Color.clear)
                    }
                }

                ForEach(days) { day in
                    Section {
                        ForEach(day.takes) { take in
                            LogRow(take: take, isCurrent: model.currentTake?.id == take.id)
                                .contentShape(.rect)
                                .onTapGesture { editingTake = take }
                                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                    Button {
                                        model.setRating(.circled, for: take)
                                    } label: {
                                        Label(take.rating == .circled ? "Uncircle" : "Circle", systemImage: "circle.circle")
                                    }
                                    .tint(Theme.success)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        model.delete(take)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                    Button {
                                        model.setRating(.ng, for: take)
                                    } label: {
                                        Label("NG", systemImage: "xmark.circle")
                                    }
                                    .tint(Theme.warning)
                                }
                        }
                    } header: {
                        SettingsSectionHeader(dayTitle(day.day, count: day.takes.count))
                    }
                    .listRowBackground(Theme.card)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .searchable(text: $searchText, prompt: "Scene, roll, timecode, note")
            .navigationTitle("Take log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button {
                            do {
                                sharedFile = SharedFile(url: try model.exportCSV())
                            } catch {
                                // The slate's own alert is under this sheet.
                                exportError = error.localizedDescription
                            }
                        } label: {
                            Label("Export CSV…", systemImage: "square.and.arrow.up")
                        }
                        Button {
                            Task { await model.syncReports() }
                        } label: {
                            Label("Update reports now", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Divider()
                        Button(role: .destructive) {
                            isConfirmingClear = true
                        } label: {
                            Label("Clear log…", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").tappableArea()
                    }
                    .disabled(model.takes.isEmpty)
                    .accessibilityLabel("Log options")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.body.weight(.semibold))
                }
            }
            .confirmationDialog("Clear the take log?", isPresented: $isConfirmingClear, titleVisibility: .visible) {
                Button("Clear \(model.takes.count) takes", role: .destructive) {
                    model.clearLog()
                }
            } message: {
                Text("The takes are removed from this device and from the camera and sound reports. Export the log first to keep a copy.")
            }
            .alert(
                "Couldn’t export the log",
                isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } }),
                actions: { Button("OK", role: .cancel) { exportError = nil } },
                message: { Text(exportError ?? "") }
            )
            .sheet(item: $editingTake) { take in
                TakeEditSheet(model: model, take: take)
            }
            .sheet(item: $sharedFile) { file in
                ActivityView(items: [file.url])
                    .presentationDetents([.medium, .large])
                    .ignoresSafeArea()
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var summary: some View {
        let today = model.todaysTakes
        let rolls = Set(today.filter(\.kind.hasCamera).map(\.roll)).sorted()
        return Card(padding: 12) {
            HStack(spacing: 0) {
                stat("\(today.count)", "Takes today")
                stat("\(today.filter { $0.rating == .circled }.count)", "Circled")
                stat("\(Set(today.map { $0.shotID ?? "\($0.scene)|\($0.setup)" }).count)", "Setups")
                stat(rolls.last ?? model.state.roll, rolls.count > 1 ? "\(rolls.count) rolls" : "Roll")
            }
        }
        .listRowInsets(EdgeInsets())
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func dayTitle(_ day: Date, count: Int) -> String {
        let name = Calendar.current.isDateInToday(day) ? "Today"
            : Calendar.current.isDateInYesterday(day) ? "Yesterday"
            : day.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
        return "\(name) · \(count) take\(count == 1 ? "" : "s")"
    }
}

/// One line of the full log: which take, when, on what roll, how it went.
private struct LogRow: View {
    let take: SlateTake
    let isCurrent: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: take.rating.symbol)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(take.label)
                        .font(.subheadline.weight(.bold).monospaced())
                        .foregroundStyle(Theme.textPrimary)
                    if take.kind != .sync { Chip(text: take.kind.label, tint: Theme.warning) }
                    if take.isTailSlate { Chip(text: "TAIL", tint: Theme.textTertiary) }
                    if isCurrent { Chip(text: "Now", tint: Theme.accent, prominent: true) }
                }
                HStack(spacing: 8) {
                    Text(take.timecode ?? take.timeLabel).monospacedDigit()
                    Text(take.kind.hasCamera ? "\(take.cameraLetter) · \(take.roll)" : take.soundRoll)
                    if let duration = take.duration {
                        Text(String(format: "%d:%02d", Int(duration) / 60, Int(duration) % 60)).monospacedDigit()
                    }
                }
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
                if let note = take.note?.nonEmpty {
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(take.label), \(take.rating.label)\(take.timecode.map { ", timecode \($0)" } ?? "")")
    }

    private var tint: Color {
        switch take.rating {
        case .circled: return Theme.success
        case .good: return Color(hex: 0x3B82F6)
        case .ng, .falseStart: return Theme.danger
        case .none: return Theme.textTertiary
        }
    }
}

// MARK: - Edit a take

/// Fixes a take after the fact: the rating and note, mostly, and anything the
/// board had wrong.
struct TakeEditSheet: View {

    @ObservedObject var model: SlateViewModel
    let take: SlateTake

    @Environment(\.dismiss) private var dismiss
    @State private var draft: SlateTake
    @State private var isConfirmingDelete = false

    init(model: SlateViewModel, take: SlateTake) {
        self.model = model
        self.take = take
        _draft = State(initialValue: take)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    header
                }
                .listRowBackground(Theme.card)

                Section {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                        ForEach(TakeRating.allCases) { rating in
                            ratingChip(rating)
                        }
                    }
                    .padding(.vertical, 4)
                    TextField("Note — performance, focus, a plane overhead…", text: Binding(
                        get: { draft.note ?? "" },
                        set: { draft.note = $0.isEmpty ? nil : $0 }
                    ), axis: .vertical)
                    .lineLimit(2...6)
                    .foregroundStyle(Theme.textPrimary)
                } header: {
                    SettingsSectionHeader("How it went")
                }
                .listRowBackground(Theme.card)

                Section {
                    field("Scene", text: $draft.scene)
                    field("Setup", text: $draft.setup)
                    Stepper(value: $draft.take, in: 1...999) {
                        HStack {
                            Text("Take").foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Text("\(draft.take)")
                                .font(.body.monospacedDigit())
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    Picker("Type", selection: $draft.kind) {
                        ForEach(TakeKind.allCases) { Text($0.label).tag($0) }
                    }
                    .foregroundStyle(Theme.textPrimary)
                    Toggle("Interior", isOn: $draft.isInterior)
                    Toggle("Day", isOn: $draft.isDay)
                } header: {
                    SettingsSectionHeader("Slate")
                }
                .listRowBackground(Theme.card)

                Section {
                    field("Camera roll", text: $draft.roll)
                    field("Sound roll", text: $draft.soundRoll)
                    field("Camera", text: $draft.cameraLetter)
                    field("Lens", text: Binding(
                        get: { draft.lens ?? "" },
                        set: { draft.lens = $0.isEmpty ? nil : $0 }
                    ))
                } header: {
                    SettingsSectionHeader("Rolls")
                } footer: {
                    Text("Changing a roll moves the take to that roll’s report.")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }
                .listRowBackground(Theme.card)

                Section {
                    Button(role: .destructive) {
                        isConfirmingDelete = true
                    } label: {
                        Label("Delete take", systemImage: "trash")
                    }
                }
                .listRowBackground(Theme.card)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("Take \(draft.take)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        var cleaned = draft
                        cleaned.scene = cleaned.scene.trimmingCharacters(in: .whitespacesAndNewlines)
                        cleaned.setup = cleaned.setup.trimmingCharacters(in: .whitespacesAndNewlines)
                        cleaned.note = cleaned.note?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
                        model.update(take: cleaned)
                        Haptics.success()
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                    .disabled(draft == take || draft.scene.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog("Delete this take?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
                Button("Delete take", role: .destructive) {
                    model.delete(take)
                    dismiss()
                }
            } message: {
                Text("It’s removed from the log and from the camera and sound reports.")
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(draft != take)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(draft.label)
                .font(.title2.weight(.heavy).monospaced())
                .foregroundStyle(Theme.textPrimary)
            Group {
                if let tc = take.timecode {
                    Text("TC \(tc) · \(FrameRate(rawValue: take.frameRate)?.label ?? take.frameRate) fps")
                }
                if let tail = take.tailTimecode, take.isTailSlate {
                    Text("Tail slate at \(tail)")
                }
                Text(take.markedAt.formatted(date: .abbreviated, time: .standard)
                     + (take.duration.map { String(format: " · %d:%02d long", Int($0) / 60, Int($0) % 60) } ?? ""))
            }
            .font(.footnote.monospacedDigit())
            .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private func ratingChip(_ rating: TakeRating) -> some View {
        let isSelected = draft.rating == rating
        return Button {
            draft.rating = rating
            Haptics.selectionChanged()
        } label: {
            Label(rating.label, systemImage: rating.symbol)
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(isSelected ? Theme.accent.readableForeground : Theme.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(isSelected ? Theme.accent : Theme.elevated, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func field(_ label: String, text: Binding<String>) -> some View {
        HStack(spacing: 12) {
            Text(label).foregroundStyle(Theme.textPrimary)
            TextField(label, text: text)
                .multilineTextAlignment(.trailing)
                .font(.body.monospaced())
                .foregroundStyle(Theme.textSecondary)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
        }
    }
}
