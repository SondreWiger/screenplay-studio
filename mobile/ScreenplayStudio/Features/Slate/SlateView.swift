import SwiftUI

/// The slate: a timecode clapperboard wired to the shot list.
///
/// This screen is the AC's control surface — what's being slated, the take
/// flow, the timecode and the log. "Show board" (or turning an iPhone
/// sideways) puts the board itself up full screen for the camera.
struct SlateView: View {

    let projectID: String
    let projectTitle: String

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var network: NetworkMonitor
    @StateObject private var model: SlateViewModel
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    @State private var isShowingBoard = false
    @State private var isShowingSetup = false
    @State private var isPickingShot = false
    @State private var isShowingJam = false
    @State private var isShowingLog = false
    @State private var editingTake: SlateTake?
    @State private var sharedFile: SharedFile?

    /// Opened from a shot or a scene, the board starts on it.
    init(projectID: String, projectTitle: String, initialShotID: String? = nil, initialSceneID: String? = nil) {
        self.projectID = projectID
        self.projectTitle = projectTitle
        _model = StateObject(wrappedValue: SlateViewModel(
            projectID: projectID,
            projectTitle: projectTitle,
            initialShotID: initialShotID,
            initialSceneID: initialSceneID
        ))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                miniBoard
                nowSlating
                SlateActionBar(model: model)
                conditions
                timecodeCard
                reportRow
                takesSection
            }
            .screenPadding()
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Slate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar(isShowingBoard ? .hidden : .visible, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .toolbar { toolbarContent }
        .overlay {
            if isShowingBoard {
                SlateBoardView(model: model) {
                    withAnimation(.easeOut(duration: 0.2)) { isShowingBoard = false }
                    OrientationLock.requestPortrait()
                }
                .transition(.opacity)
                .zIndex(1)
            }
        }
        // Turning an iPhone sideways is the natural "hold it up" gesture.
        .onChange(of: verticalSizeClass) { _, newValue in
            if newValue == .compact, !isShowingBoard {
                withAnimation(.easeOut(duration: 0.2)) { isShowingBoard = true }
            }
        }
        .sheet(isPresented: $isShowingSetup) {
            SlateSetupSheet(model: model)
        }
        .sheet(isPresented: $isPickingShot) {
            SlateShotPicker(model: model)
        }
        .sheet(isPresented: $isShowingJam) {
            JamSheet(model: model)
        }
        .sheet(isPresented: $isShowingLog) {
            SlateLogView(model: model)
        }
        .sheet(item: $editingTake) { take in
            TakeEditSheet(model: model, take: take)
        }
        .sheet(item: $sharedFile) { file in
            ActivityView(items: [file.url])
                .presentationDetents([.medium, .large])
                .ignoresSafeArea()
        }
        .alert(
            "Slate",
            isPresented: Binding(get: { model.notice != nil }, set: { if !$0 { model.notice = nil } }),
            actions: { Button("OK", role: .cancel) { model.notice = nil } },
            message: { Text(model.notice ?? "") }
        )
        .task {
            model.userID = auth.userID
            await model.onAppear()
        }
        .onAppear {
            // The board has to stay lit through a setup, and an iPhone may
            // turn sideways here to put the board up.
            UIApplication.shared.isIdleTimerDisabled = true
            OrientationLock.allowLandscape(true)
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            OrientationLock.allowLandscape(false)
            model.onDisappear()
        }
        .onChange(of: network.isOnline) { _, online in
            if online { model.syncReportsSoon(after: 0.5) }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Haptics.tap()
                withAnimation(.easeOut(duration: 0.2)) { isShowingBoard = true }
            } label: {
                Label("Show board", systemImage: "rectangle.inset.filled")
            }
            .keyboardShortcut("b", modifiers: .command)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button { isShowingSetup = true } label: {
                    Label("Board & sync setup", systemImage: "slider.horizontal.3")
                }
                Button { isShowingLog = true } label: {
                    Label("Take log", systemImage: "list.bullet.rectangle")
                }
                Button { export() } label: {
                    Label("Export log as CSV…", systemImage: "square.and.arrow.up")
                }
                .disabled(model.takes.isEmpty)
                Divider()
                Button { model.nextRoll() } label: {
                    Label("Next camera roll (\(SlateViewModel.increment(model.state.roll)))", systemImage: "film.stack")
                }
                Button { model.nextSoundRoll() } label: {
                    Label("Next sound roll (\(SlateViewModel.increment(model.state.soundRoll)))", systemImage: "waveform")
                }
                Divider()
                Button {
                    Haptics.selectionChanged()
                    model.isTailMode.toggle()
                } label: {
                    Label(model.isTailMode ? "Cancel tail slate" : "Tail slate the next take", systemImage: "arrow.uturn.down")
                }
                .disabled(model.phase != .ready)
                Button(role: .destructive) { model.undoLastMark() } label: {
                    Label(model.takes.first.map { "Undo last mark (\($0.label))" } ?? "Undo last mark", systemImage: "arrow.uturn.backward")
                }
                .disabled(!model.canUndoMark)
            } label: {
                Image(systemName: "ellipsis.circle").tappableArea()
            }
            .accessibilityLabel("Slate options")
        }
    }

    private func export() {
        do {
            sharedFile = SharedFile(url: try model.exportCSV())
        } catch {
            model.notice = error.localizedDescription
        }
    }

    // MARK: - Mini board

    private var miniBoard: some View {
        Button {
            withAnimation(.easeOut(duration: 0.2)) { isShowingBoard = true }
        } label: {
            VStack(spacing: 0) {
                BoardSticks(isClosed: model.sticksClosed || model.state.kind == .mos)
                    .frame(height: 40)
                VStack(spacing: 8) {
                    // Paused under the full-screen board: no point drawing it
                    // there, and the main thread is what times the clap.
                    TimelineView(.animation(minimumInterval: nil, paused: isShowingBoard)) { _ in
                        let tc = model.frozenTimecode ?? model.timecode(at: SlateClock.now())
                        LEDTimecode(text: tc.formatted(model.state.frameRate), frozen: model.frozenTimecode != nil)
                            .frame(height: 64)
                    }
                    HStack(spacing: 0) {
                        miniField("Scene", model.state.scene)
                        miniField("Shot", model.state.setup.nonEmpty ?? "—")
                        miniField("Take", "\(model.state.take)", accent: true)
                        miniField("Roll", model.state.roll)
                    }
                }
                .padding(12)
                .background(Color(hex: 0x0B0B0F))
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(alignment: .topTrailing) {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.7))
                    .padding(8)
                    .background(.black.opacity(0.5), in: Circle())
                    .padding(8)
            }
            .overlay {
                if model.isFlashing { Color.white.allowsHitTesting(false) }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Board: \(model.state.spokenIdentifier). Opens the full-screen board.")
    }

    private func miniField(_ label: String, _ value: String, accent: Bool = false) -> some View {
        VStack(spacing: 1) {
            Text(label.uppercased())
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(.white.opacity(0.45))
            Text(value)
                .font(.system(size: 20, weight: .heavy, design: .monospaced))
                .foregroundStyle(accent ? Theme.Brand.b400 : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Now slating

    private var nowSlating: some View {
        Card(padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                Button {
                    Haptics.tap()
                    isPickingShot = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: model.linkedShot != nil ? "camera.fill" : "list.bullet.rectangle")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                            .frame(width: 32, height: 32)
                            .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(slatingTitle)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(1)
                            Text(slatingSubtitle)
                                .font(.caption)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Text("Change")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.accent)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)

                if model.linkedShot != nil {
                    HStack(spacing: 8) {
                        smallButton("Shot done", symbol: "checkmark.circle") { model.completeShotAndAdvance() }
                        smallButton(model.nextShot.map { "Next: \($0.displayNumber)" } ?? "Next shot", symbol: "forward.end") {
                            model.moveToNextShot()
                        }
                        .disabled(model.nextShot == nil)
                    }
                }
            }
        }
    }

    private var slatingTitle: String {
        if let shot = model.linkedShot {
            return "Scene \(model.state.scene) · Shot \(shot.displayNumber)"
        }
        if let scene = model.linkedScene {
            return "Scene \(scene.sceneNumber ?? model.state.scene)"
        }
        return model.shots.isEmpty ? "Scene \(model.state.scene)" : "Pick what you're shooting"
    }

    private var slatingSubtitle: String {
        if let shot = model.linkedShot {
            var parts: [String] = []
            if let description = shot.description?.nonEmpty { parts.append(description) }
            if !shot.techSummary.isEmpty { parts.append(shot.techSummary) }
            return parts.joined(separator: " · ").nonEmpty ?? "Takes log against this shot"
        }
        if let scene = model.linkedScene { return scene.displayHeading }
        return model.shots.isEmpty
            ? "Add shots to the shot list to log takes against them."
            : "Choose a shot from the shot list, so every take logs against it."
    }

    private func smallButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 40)
                .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Conditions

    private var conditions: some View {
        VStack(spacing: 10) {
            Picker("Take type", selection: Binding(
                get: { model.state.kind },
                set: { kind in model.update { $0.kind = kind }; Haptics.selectionChanged() }
            )) {
                ForEach(TakeKind.allCases) { kind in
                    Text(kind.label).tag(kind)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 10) {
                takeStepper
                toggleChip(model.state.isInterior ? "INT" : "EXT", accessibility: "Interior or exterior") {
                    model.update { $0.isInterior.toggle() }
                }
                toggleChip(model.state.isDay ? "DAY" : "NIGHT", accessibility: "Day or night") {
                    model.update { $0.isDay.toggle() }
                }
            }
        }
    }

    private var takeStepper: some View {
        HStack(spacing: 0) {
            Button { model.adjustTake(by: -1) } label: {
                Image(systemName: "minus").frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
            }
            .accessibilityLabel("Previous take number")
            Text("T\(model.state.take)")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(Theme.textPrimary)
                .frame(minWidth: 40)
            Button { model.adjustTake(by: 1) } label: {
                Image(systemName: "plus").frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
            }
            .accessibilityLabel("Next take number")
        }
        .font(.body.weight(.bold))
        .foregroundStyle(Theme.textSecondary)
        .buttonStyle(.plain)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous).strokeBorder(Theme.border))
        .disabled(model.phase != .ready)
    }

    private func toggleChip(_ title: String, accessibility: String, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selectionChanged()
            action()
        } label: {
            Text(title)
                .font(.footnote.weight(.bold).monospaced())
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous).strokeBorder(Theme.border))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(accessibility): \(title)")
    }

    // MARK: - Timecode

    private var timecodeCard: some View {
        Card(padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Timecode")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        Text("\(model.state.frameRate.label) fps · \(model.timecodeSourceLabel)")
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                    }
                    Spacer()
                    Button("Jam…") { isShowingJam = true }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(minHeight: Theme.minTouchTarget)
                }

                if let message = model.ltcMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(model.isListeningForLTC ? Theme.textSecondary : Theme.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Toggle(isOn: Binding(get: { model.state.ltcOutputEnabled }, set: { model.setLTCOutput($0) })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Timecode out (LTC)")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textPrimary)
                        Text("Sends the board’s timecode out of the headphone output into a camera’s audio input. The sync beep is off while it runs.")
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .tint(Theme.accent)
            }
        }
    }

    // MARK: - Reports

    private var reportRow: some View {
        HStack(spacing: 10) {
            Image(systemName: reportSymbol)
                .foregroundStyle(reportTint)
                .frame(width: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text("Camera & sound reports")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
                Text(reportText)
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            if case .failed = model.reportStatus {
                Button("Retry") { Task { await model.syncReports() } }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
            } else if case .syncing = model.reportStatus {
                ProgressView().tint(Theme.textTertiary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var reportSymbol: String {
        switch model.reportStatus {
        case .idle, .synced: return "checkmark.icloud"
        case .syncing: return "arrow.triangle.2.circlepath.icloud"
        case .waiting: return "icloud.slash"
        case .failed: return "exclamationmark.icloud"
        }
    }

    private var reportTint: Color {
        switch model.reportStatus {
        case .idle, .synced, .syncing: return Theme.success
        case .waiting: return Theme.warning
        case .failed: return Theme.danger
        }
    }

    private var reportText: String {
        switch model.reportStatus {
        case .idle:
            return model.takes.isEmpty ? "Each take is written to the project’s reports." : "Up to date."
        case .syncing:
            return "Updating…"
        case .waiting(let count):
            return "\(count) report\(count == 1 ? "" : "s") waiting for a connection."
        case .synced(let date):
            return "Up to date · \(date.formatted(date: .omitted, time: .shortened))"
        case .failed(let message):
            return message
        }
    }

    // MARK: - Takes

    private var takesSection: some View {
        let takes = model.takesOnBoard
        return VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: model.linkedShot != nil ? "This shot" : "Scene \(model.state.scene)",
                subtitle: takes.isEmpty ? "No takes yet" : "\(takes.count) take\(takes.count == 1 ? "" : "s") · \(takes.filter { $0.rating == .circled }.count) circled",
                actionTitle: model.takes.isEmpty ? nil : "All takes"
            ) {
                isShowingLog = true
            }

            VStack(spacing: 6) {
                ForEach(takes.prefix(15)) { take in
                    TakeRow(take: take, isCurrent: model.currentTake?.id == take.id) {
                        editingTake = take
                    } onRate: { rating in
                        model.setRating(rating, for: take)
                    }
                }
            }
        }
    }
}

// MARK: - Take row

struct TakeRow: View {
    let take: SlateTake
    var isCurrent = false
    let onOpen: () -> Void
    let onRate: (TakeRating) -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 10) {
                Button {
                    onRate(.circled)
                } label: {
                    Image(systemName: take.rating == .circled ? "circle.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(take.rating == .circled ? Theme.success : Theme.textTertiary)
                        .tappableArea(36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(take.rating == .circled ? "Uncircle take" : "Circle take")

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text("Take \(take.take)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                        if take.kind != .sync { Chip(text: take.kind.label, tint: Theme.warning) }
                        if take.isTailSlate { Chip(text: "TAIL", tint: Theme.textTertiary) }
                        if take.rating == .ng || take.rating == .falseStart {
                            Chip(text: take.rating.label, tint: Theme.danger)
                        } else if take.rating == .good {
                            Chip(text: "Good", tint: Color(hex: 0x3B82F6))
                        }
                        if isCurrent { Chip(text: "Now", tint: Theme.accent, prominent: true) }
                    }
                    HStack(spacing: 8) {
                        if let tc = take.timecode {
                            Text(tc).monospacedDigit()
                        }
                        if let duration = take.duration {
                            Text(String(format: "%d:%02d", Int(duration) / 60, Int(duration) % 60)).monospacedDigit()
                        }
                        if let note = take.note?.nonEmpty {
                            Text(note).lineLimit(1)
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .strokeBorder(isCurrent ? Theme.accent.opacity(0.6) : .clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Take \(take.take), \(take.rating.label)\(take.timecode.map { ", timecode \($0)" } ?? "")")
    }
}
