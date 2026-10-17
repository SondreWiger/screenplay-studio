import SwiftUI

/// Edits the marks on the board and how the slate behaves.
struct SlateEditSheet: View {

    @ObservedObject var model: SlateViewModel
    let projectTitle: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    LabelledField(
                        label: "Production",
                        placeholder: projectTitle,
                        text: $model.state.production,
                        symbol: "film",
                        autocapitalisation: .words
                    )
                    HStack(spacing: 10) {
                        LabelledField(
                            label: "Director",
                            placeholder: "Name",
                            text: $model.state.director,
                            symbol: "person",
                            textContent: .name,
                            autocapitalisation: .words
                        )
                        LabelledField(
                            label: "Camera (DOP)",
                            placeholder: "Name",
                            text: $model.state.camera,
                            symbol: "camera",
                            autocapitalisation: .words
                        )
                    }

                    HStack(spacing: 10) {
                        LabelledField(label: "Roll", placeholder: "A001", text: $model.state.roll, autocapitalisation: .characters)
                        LabelledField(label: "Cam", placeholder: "A", text: $model.state.cameraUnit, autocapitalisation: .characters)
                            .frame(maxWidth: 110)
                    }

                    HStack(spacing: 10) {
                        LabelledField(label: "Scene", placeholder: "12", text: $model.state.scene, autocapitalisation: .characters)
                        LabelledField(label: "Setup", placeholder: "A", text: $model.state.shot, autocapitalisation: .characters)
                        takeStepper
                    }

                    Card {
                        VStack(spacing: 4) {
                            row("Interior", isOn: $model.state.isInterior)
                            Divider().overlay(Theme.border)
                            row("Day", isOn: $model.state.isDay)
                            Divider().overlay(Theme.border)
                            row("MOS (no sync sound)", isOn: $model.state.isMOS)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Behaviour")
                        Card {
                            VStack(spacing: 4) {
                                row("Full brightness", detail: "While the slate is open.", isOn: $model.state.maxBrightness)
                                Divider().overlay(Theme.border)
                                row("Advance take after clap", isOn: $model.state.autoAdvanceTake)
                                Divider().overlay(Theme.border)
                                row(
                                    "Log to camera report",
                                    detail: "Writes each take, with its timecode, to this project's Camera Reports.",
                                    isOn: Binding(
                                        get: { model.state.logToCameraReport },
                                        set: { model.setLogsToCameraReport($0) }
                                    )
                                )
                            }
                        }
                    }
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("Board")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        model.persist()
                        Haptics.success()
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onDisappear { model.persist() }
    }

    private var takeStepper: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Take")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .textCase(.uppercase)
                .tracking(0.4)
            Stepper(value: $model.state.take, in: 1...999) {
                Text("\(model.state.take)")
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Theme.textPrimary)
            }
            .padding(.horizontal, 12)
            .frame(minHeight: Theme.minTouchTarget + 6)
            .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
        .frame(maxWidth: 190)
    }

    private func row(_ title: String, detail: String? = nil, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                if let detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(minHeight: Theme.minTouchTarget)
        .tint(Theme.accent)
        .foregroundStyle(Theme.textPrimary)
    }
}

// MARK: - Timecode

/// Frame rate, where the timecode comes from, jamming, and the LTC input.
struct TimecodeSettingsSheet: View {

    @ObservedObject var model: SlateViewModel
    @ObservedObject var ltc: LTCReader

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    /// Digits as typed, filled from the right like a recorder's keypad.
    @State private var jamDigits = ""
    @FocusState private var isJamFieldFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TimelineView(.animation(minimumInterval: 1.0 / 60, paused: model.heldReading != nil)) { _ in
                        SevenSegmentDisplay(text: model.reading().timecode.description)
                            .frame(height: 64)
                    }
                    .listRowBackground(Color.black)
                    .accessibilityLabel("Running timecode")

                    LabeledContent("Status", value: model.timecodeStatus)
                } footer: {
                    if model.jamIsStale {
                        Text("A tablet's clock can wander a frame every few hours. Jam again from the sound recorder or sync box.")
                            .foregroundStyle(Theme.warning)
                    }
                }

                Section {
                    Picker("Frame rate", selection: Binding(get: { model.state.frameRate }, set: { model.setFrameRate($0) })) {
                        ForEach(FrameRate.allCases) { rate in
                            Text("\(rate.label) fps").tag(rate)
                        }
                    }
                    Picker("Source", selection: Binding(get: { model.state.timecodeSource }, set: { model.setSource($0) })) {
                        ForEach(TimecodeSource.allCases) { source in
                            Text(source.label).tag(source)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                } header: {
                    Text("Timecode")
                } footer: {
                    Text(sourceExplanation)
                }

                switch model.state.timecodeSource {
                case .timeOfDay:
                    Section {
                        Button("Jam to time of day and free-run") { model.jamToTimeOfDay() }
                    } footer: {
                        Text("Locks the board to the clock now and runs on its own from there, so a network-time correction can't move it mid-take.")
                    }
                case .jam:
                    jamSection
                case .ltc:
                    ltcSection
                }

                Section("Clap") {
                    Picker("Hold clap frame", selection: $model.state.holdSeconds) {
                        ForEach([0.5, 1.0, 1.5, 2.0, 3.0, 5.0], id: \.self) { seconds in
                            Text(seconds.formatted(.number.precision(.fractionLength(0...1))) + " s").tag(seconds)
                        }
                    }
                    Toggle("Flash board on clap", isOn: $model.state.flashOnClap)
                    Toggle("Clap sound", isOn: Binding(
                        get: { AppSettings.shared.slateSoundEnabled },
                        set: { AppSettings.shared.slateSoundEnabled = $0 }
                    ))
                }
            }
            .tint(Theme.accent)
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Timecode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        model.persist()
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onDisappear { model.persist() }
    }

    private var sourceExplanation: String {
        switch model.state.timecodeSource {
        case .timeOfDay:
            return "The device clock, kept on network time. Matches other devices on time of day to within a frame or two."
        case .jam:
            return "Runs on its own from a timecode you set — type in what the sound recorder or camera shows and jam on the frame."
        case .ltc:
            return "Reads LTC from a sync box (Tentacle, Deity, Ambient…) plugged into the headset jack or a USB audio interface, and keeps running if the cable comes out."
        }
    }

    // MARK: - Jam

    private var jamText: Binding<String> {
        Binding(
            get: { jamDigits.isEmpty ? "" : Self.formatted(jamDigits, dropFrame: model.state.frameRate.isDropFrame) },
            set: { newValue in
                let digits = newValue.filter(\.isNumber).drop { $0 == "0" }
                jamDigits = String(digits.suffix(8))
            }
        )
    }

    private var parsedJam: Timecode? {
        guard !jamDigits.isEmpty else { return nil }
        return Timecode.parse(jamDigits, rate: model.state.frameRate)
    }

    private var jamSection: some View {
        Section {
            HStack {
                TextField(model.state.frameRate.isDropFrame ? "HH:MM:SS;FF" : "HH:MM:SS:FF", text: jamText)
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .keyboardType(.numberPad)
                    .focused($isJamFieldFocused)
                Button("Now") {
                    jamDigits = String(model.reading().timecode.digits.drop { $0 == "0" })
                }
                .buttonStyle(.borderless)
            }

            Button {
                guard let timecode = parsedJam else { return }
                model.jam(to: timecode)
                isJamFieldFocused = false
                jamDigits = ""
            } label: {
                Label("Jam on this frame", systemImage: "timer")
                    .font(.body.weight(.semibold))
            }
            .disabled(parsedJam == nil)
            .keyboardShortcut(.return, modifiers: .command)

            Button("Jam to time of day") { model.jamToTimeOfDay() }

            if let jam = model.state.jam {
                LabeledContent("Last jam", value: "\(Self.originLabel(jam.origin)) · \(SlateViewModel.ageLabel(jam.age))")
            }
        } header: {
            Text("Jam")
        } footer: {
            if !jamDigits.isEmpty, parsedJam == nil {
                Text("That isn't a valid timecode at \(model.state.frameRate.label) fps.")
                    .foregroundStyle(Theme.danger)
            } else {
                Text("Type the timecode you'll jam to, then press Jam the moment the source shows it. The board free-runs from there.")
            }
        }
    }

    // MARK: - LTC

    @ViewBuilder
    private var ltcSection: some View {
        Section {
            LabeledContent("Status", value: ltcStatusLabel)
            LabeledContent("Input", value: ltc.inputName ?? "—")
            HStack {
                Text("Signal")
                Spacer()
                LevelMeter(level: ltc.level)
                    .frame(width: 140, height: 8)
            }
            .accessibilityElement(children: .combine)
            .accessibilityValue(ltc.level > 0.001 ? "\(Int(20 * log10(Double(ltc.level)))) dB" : "Silent")

            LabeledContent("Reading") {
                Text(ltc.timecode?.description ?? "—")
                    .font(.body.monospacedDigit())
                    .foregroundStyle(ltc.status == .locked ? SevenSegmentDisplay.lit : Theme.textSecondary)
            }
            if let rate = ltc.detectedRate {
                LabeledContent("Detected rate", value: "\(rate.label) fps")
            }
            if ltc.userBits != 0 {
                LabeledContent("User bits", value: String(format: "%08X", ltc.userBits))
            }

            if let mismatch = model.ltcRateMismatch {
                Button("Set board to \(mismatch.label) fps") { model.setFrameRate(mismatch) }
            }

            Button {
                model.jamFromLTC()
            } label: {
                Label("Jam once and free-run", systemImage: "timer")
            }
            .disabled(ltc.status != .locked)

            if ltc.status == .denied {
                Button("Allow microphone access in Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
            } else if !ltc.isRunning {
                Button("Start listening") { Task { await ltc.start() } }
            }
        } header: {
            Text("LTC input")
        } footer: {
            if ltc.isUsingBuiltInMic {
                Text("Listening on the built-in microphone. Connect the sync box's output to a headset or USB audio input for a reliable lock.")
                    .foregroundStyle(Theme.warning)
            } else {
                Text("Audio is only analysed for timecode on this device; nothing is recorded or sent anywhere.")
            }
        }
    }

    private var ltcStatusLabel: String {
        switch ltc.status {
        case .off:            return "Off"
        case .denied:         return "Microphone access denied"
        case .starting:       return "Starting…"
        case .noSignal:       return "No LTC signal"
        case .acquiring:      return "Reading…"
        case .locked:         return "Locked"
        case .failed(let why): return why
        }
    }

    private static func originLabel(_ origin: JamReference.Origin) -> String {
        switch origin {
        case .manual:    return "Typed in"
        case .ltc:       return "From LTC"
        case .timeOfDay: return "Time of day"
        }
    }

    static func formatted(_ digits: String, dropFrame: Bool) -> String {
        let padded = String(repeating: "0", count: max(0, 8 - digits.count)) + digits.suffix(8)
        let characters = Array(padded)
        return "\(String(characters[0...1])):\(String(characters[2...3])):\(String(characters[4...5]))\(dropFrame ? ";" : ":")\(String(characters[6...7]))"
    }
}

private struct LevelMeter: View {
    let level: Float

    var body: some View {
        GeometryReader { geometry in
            // -60 dBFS to 0 across the bar; LTC usually sits around -20 to -10.
            let db = level > 0 ? 20 * log10(Double(level)) : -60
            let fraction = min(max((db + 60) / 60, 0), 1)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.08))
                Capsule()
                    .fill(db > -3 ? Theme.danger : (db > -40 ? Theme.success : Theme.warning))
                    .frame(width: geometry.size.width * fraction)
            }
        }
        .animation(.linear(duration: 0.08), value: level)
    }
}

// MARK: - Shot picker

/// Chooses which shot the slate is marking.
struct SlateShotPicker: View {

    let shots: [Shot]
    let scenes: [ProductionScene]
    let onSelect: (Shot) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filtered: [Shot] {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return shots }
        return shots.filter {
            ($0.shotNumber?.lowercased().contains(term) ?? false)
                || ($0.description?.lowercased().contains(term) ?? false)
                || (sceneHeading(for: $0)?.lowercased().contains(term) ?? false)
        }
    }

    private func sceneHeading(for shot: Shot) -> String? {
        guard let id = shot.sceneID else { return nil }
        return scenes.first { $0.id == id }?.displayHeading
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filtered) { shot in
                        Button {
                            onSelect(shot)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Text(shot.displayNumber)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 44, height: 32)
                                    .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 7, style: .continuous))

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(shot.description?.nonEmpty ?? shot.techSummary)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Theme.textPrimary)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                    if let heading = sceneHeading(for: shot) {
                                        Text(heading)
                                            .font(.caption)
                                            .foregroundStyle(Theme.textTertiary)
                                            .lineLimit(1)
                                    }
                                    if let takes = shot.takesLabel {
                                        Text(takes)
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textTertiary)
                                    }
                                }

                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .frame(minHeight: Theme.minTouchTarget + 12)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .hoverEffect(.highlight)
                    }

                    if filtered.isEmpty {
                        EmptyStateView(
                            symbol: "camera",
                            title: "No shots match",
                            message: "Add shots on the shot list, then point the slate at one."
                        )
                        .padding(.top, 40)
                    }
                }
                .screenPadding()
                .padding(.vertical, 8)
            }
            .background(Theme.background)
            .searchable(text: $searchText, prompt: "Search shots")
            .navigationTitle("Link to shot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
