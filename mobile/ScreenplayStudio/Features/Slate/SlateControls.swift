import SwiftUI
import UniformTypeIdentifiers

/// Everything beside (or below) the board: the clap, the numbers that change
/// through the day, timecode status and the take log.
struct SlateControlPanel: View {

    @ObservedObject var model: SlateViewModel
    @ObservedObject var ltc: LTCReader
    let onEditBoard: () -> Void
    let onPickShot: () -> Void
    let onTimecode: () -> Void

    @State private var editingNote: SlateTake?
    @State private var noteText = ""

    var body: some View {
        VStack(spacing: 12) {
            markButton
            numbers
            conditions
            timecodeCard
            linkRow
            SlateTakeLog(
                model: model,
                onEditNote: { take in
                    noteText = take.note ?? ""
                    editingNote = take
                }
            )
        }
        .alert(
            "Take note",
            isPresented: Binding(get: { editingNote != nil }, set: { if !$0 { editingNote = nil } }),
            presenting: editingNote
        ) { take in
            TextField("Soft focus, plane overhead…", text: $noteText)
            Button("Save") { model.setNote(noteText, for: take) }
            Button("Cancel", role: .cancel) {}
        } message: { take in
            Text(take.label)
        }
    }

    // MARK: - Mark

    private var markButton: some View {
        Button {
            model.mark()
        } label: {
            VStack(spacing: 2) {
                HStack(spacing: 10) {
                    Image(systemName: model.isClosed ? "checkmark" : (model.state.isMOS ? "speaker.slash.fill" : "hand.tap.fill"))
                    Text(markTitle)
                }
                .font(.title3.weight(.bold))
                if let held = model.heldReading {
                    Text(held.timecode.description)
                        .font(.footnote.weight(.semibold).monospacedDigit())
                        .opacity(0.85)
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 76)
            .background(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .fill(model.isClosed ? Theme.success : Theme.accent)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(model.isClosed)
        .animation(.easeOut(duration: 0.18), value: model.isClosed)
        .accessibilityLabel(model.isClosed ? "Take marked" : markTitle)
        .accessibilityHint("Space or Return on a keyboard also marks")
    }

    private var markTitle: String {
        if model.isClosed { return "Marked" }
        if model.state.isTail { return "Mark tail slate" }
        if model.state.isMOS { return "Log MOS take" }
        return "Mark it"
    }

    // MARK: - Numbers

    private var numbers: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                stepper(
                    title: "Take",
                    value: "\(model.state.take)",
                    down: { model.adjustTake(by: -1) },
                    up: { model.adjustTake(by: 1) }
                )
                actionTile(title: "Next setup", value: "\(model.state.scene)\(SlateViewModel.nextSetupLabel(after: model.state.shot))") {
                    model.nextSetup()
                }
            }
            HStack(spacing: 10) {
                actionTile(title: "Scene · roll", value: "\(model.state.sceneAndShot) · \(model.state.roll)", symbol: "square.and.pencil") {
                    Haptics.tap()
                    onEditBoard()
                }
                actionTile(title: "Next roll", value: SlateViewModel.incremented(model.state.roll)) {
                    model.nextRoll()
                }
            }
        }
    }

    private func stepper(title: String, value: String, down: @escaping () -> Void, up: @escaping () -> Void) -> some View {
        HStack(spacing: 0) {
            Button(action: down) {
                Image(systemName: "minus")
                    .font(.body.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget + 12)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Previous \(title.lowercased())")

            VStack(spacing: 0) {
                Text(title.uppercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.textTertiary)
                Text(value)
                    .font(.title3.weight(.heavy).monospacedDigit())
                    .foregroundStyle(Theme.textPrimary)
            }
            .frame(minWidth: 56)
            .accessibilityElement(children: .combine)

            Button(action: up) {
                Image(systemName: "plus")
                    .font(.body.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget + 12)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Next \(title.lowercased())")
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.textSecondary)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .strokeBorder(Theme.border, lineWidth: 1)
        )
    }

    private func actionTile(title: String, value: String, symbol: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title.uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.textTertiary)
                    Text(value)
                        .font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
                Image(systemName: symbol ?? "arrow.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget + 12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
    }

    // MARK: - Conditions

    private var conditions: some View {
        HStack(spacing: 8) {
            toggle("INT / EXT", isOn: model.state.isInterior, on: "INT", off: "EXT") {
                model.state.isInterior.toggle()
            }
            toggle("DAY / NIGHT", isOn: model.state.isDay, on: "DAY", off: "NIGHT") {
                model.state.isDay.toggle()
            }
            toggle("Sound", isOn: !model.state.isMOS, on: "SYNC", off: "MOS") {
                model.state.isMOS.toggle()
            }
            toggle("Tail slate", isOn: !model.state.isTail, on: "HEAD", off: "TAIL") {
                model.state.isTail.toggle()
            }
        }
    }

    private func toggle(_ name: String, isOn: Bool, on: String, off: String, action: @escaping () -> Void) -> some View {
        Button {
            action()
            model.persist()
            Haptics.selectionChanged()
        } label: {
            Text(isOn ? on : off)
                .font(.footnote.weight(.bold))
                .foregroundStyle(isOn ? Theme.textPrimary : Theme.Brand.b400)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
                .frame(height: Theme.minTouchTarget)
                .background(
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .fill(isOn ? Theme.card : Theme.accentSoft)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .strokeBorder(isOn ? Theme.border : Theme.accent.opacity(0.5), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(name): \(isOn ? on : off)")
    }

    // MARK: - Timecode

    private var timecodeCard: some View {
        Button {
            Haptics.tap()
            onTimecode()
        } label: {
            Card(padding: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        Image(systemName: timecodeSymbol)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(timecodeTint)
                            .frame(width: 30, height: 30)
                            .background(timecodeTint.opacity(0.16), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .accessibilityHidden(true)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Timecode · \(model.state.frameRate.label) fps")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.textPrimary)
                            Text(model.timecodeStatus)
                                .font(.caption)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                    }

                    if model.jamIsStale {
                        warning("Free-running for hours — jam again so the board stays on the frame.")
                    }
                    if let rate = model.ltcRateMismatch {
                        warning("The sync box is sending \(rate.label) fps; the board is set to \(model.state.frameRate.label).")
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Frame rate, jam and LTC input")
    }

    private var timecodeSymbol: String {
        switch model.state.timecodeSource {
        case .timeOfDay: return "clock"
        case .jam: return "timer"
        case .ltc: return ltc.status == .locked ? "waveform" : "waveform.slash"
        }
    }

    private var timecodeTint: Color {
        if model.jamIsStale || model.ltcRateMismatch != nil { return Theme.warning }
        switch model.state.timecodeSource {
        case .ltc: return ltc.status == .locked ? Theme.success : Theme.warning
        default: return SevenSegmentDisplay.lit
        }
    }

    private func warning(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.caption)
            Text(text)
                .font(.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(Theme.warning)
    }

    // MARK: - Shot link

    @ViewBuilder
    private var linkRow: some View {
        if let shot = model.linkedShot {
            Card(padding: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "link")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 30, height: 30)
                        .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Logging to shot \(shot.displayNumber)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                        Text(shot.takesLabel ?? shot.description?.nonEmpty ?? shot.techSummary)
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)

                    Button("Change") { onPickShot() }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.accent)
                        .frame(minHeight: Theme.minTouchTarget)
                    Button("Unlink") { model.unlink() }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.textSecondary)
                        .frame(minHeight: Theme.minTouchTarget)
                }
            }
        } else {
            Button {
                Haptics.tap()
                onPickShot()
            } label: {
                ToolRow(
                    symbol: "camera",
                    tint: Color(hex: 0x06B6D4),
                    title: "Link to a shot",
                    subtitle: model.shots.isEmpty
                        ? "No shots in this project yet"
                        : "Each clap logs a take on the shot list"
                )
            }
            .buttonStyle(.plain)
            .disabled(model.shots.isEmpty)
            .opacity(model.shots.isEmpty ? 0.5 : 1)
        }
    }
}

// MARK: - Take log

struct SlateTakeLog: View {

    @ObservedObject var model: SlateViewModel
    let onEditNote: (SlateTake) -> Void

    @State private var showsAll = false
    private let collapsedCount = 25

    var body: some View {
        if !model.takes.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Take log")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(reportTint)
                    }
                    Spacer(minLength: 8)
                    ShareLink(
                        item: TakeLogFile(takes: model.takes, state: model.state, name: exportName),
                        preview: SharePreview(exportName, image: Image(systemName: "tablecells"))
                    ) {
                        Label("Export", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                            .frame(minHeight: Theme.minTouchTarget)
                    }
                    .accessibilityHint("Shares the take log as a CSV file")
                }

                LazyVStack(spacing: 6) {
                    ForEach(visibleTakes) { take in
                        TakeRow(
                            take: take,
                            onCircle: { model.toggleCircle(take) },
                            onNote: { onEditNote(take) },
                            onDelete: { model.deleteTake(take) }
                        )
                    }
                }

                if model.takes.count > collapsedCount {
                    Button(showsAll ? "Show fewer" : "Show all \(model.takes.count) takes") {
                        withAnimation(.easeOut(duration: 0.2)) { showsAll.toggle() }
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.accent)
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
                }
            }
        }
    }

    private var visibleTakes: [SlateTake] {
        showsAll ? model.takes : Array(model.takes.prefix(collapsedCount))
    }

    private var todayCount: Int {
        let today = SlateTake.dayFormatter.string(from: Date())
        return model.takes.filter { $0.reportDate == today }.count
    }

    private var subtitle: String {
        let count = "\(todayCount) today"
        switch model.reportStatus {
        case .off:              return "\(count) · camera report off"
        case .idle:             return count
        case .syncing:          return "\(count) · updating camera report…"
        case .synced:           return "\(count) · camera report up to date"
        case .waiting:          return "\(count) · camera report syncs when online"
        case .failed(let why):  return "\(count) · camera report: \(why)"
        }
    }

    private var reportTint: Color {
        switch model.reportStatus {
        case .failed: return Theme.danger
        case .waiting: return Theme.warning
        default: return Theme.textTertiary
        }
    }

    private var exportName: String {
        let production = model.state.production.nonEmpty ?? "Slate"
        return "\(production) take log \(SlateTake.dayFormatter.string(from: Date())).csv"
    }
}

private struct TakeRow: View {
    let take: SlateTake
    let onCircle: () -> Void
    let onNote: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onCircle) {
                Image(systemName: take.isCircled ? "circle.circle.fill" : "circle")
                    .font(.body)
                    .foregroundStyle(take.isCircled ? Theme.success : Theme.textTertiary)
                    .tappableArea(36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(take.isCircled ? "Uncircle take" : "Circle this take as a print")

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(take.label)
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(Theme.textPrimary)
                    if take.isMOS { Chip(text: "MOS", tint: Theme.warning) }
                    if take.isTail { Chip(text: "TAIL", tint: Theme.textSecondary) }
                }
                if let note = take.note?.nonEmpty {
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 0)

            VStack(alignment: .trailing, spacing: 2) {
                Text(take.timecode ?? take.timeLabel)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(take.timecode == nil ? Theme.textTertiary : SevenSegmentDisplay.lit)
                Text(take.timeLabel)
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .contentShape(Rectangle())
        .onTapGesture(perform: onNote)
        .contextMenu {
            Button(action: onCircle) {
                Label(take.isCircled ? "Uncircle" : "Circle take", systemImage: "circle.circle")
            }
            Button(action: onNote) {
                Label(take.note == nil ? "Add note" : "Edit note", systemImage: "note.text")
            }
            Divider()
            Button(role: .destructive, action: onDelete) {
                Label("Delete take", systemImage: "trash")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(take.isCircled ? "Circled. " : "")Take \(take.label), timecode \(take.timecode ?? "none")\(take.note.map { ". \($0)" } ?? "")")
        .accessibilityAction(named: "Edit note", onNote)
        .accessibilityAction(named: "Delete take", onDelete)
    }
}

/// The take log as a file for the share sheet. Built only when someone
/// actually shares it.
struct TakeLogFile: Transferable {
    let takes: [SlateTake]
    let state: SlateState
    let name: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { file in
            let safeName = file.name.replacingOccurrences(of: "/", with: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            let csv = SlateViewModel.csv(takes: file.takes, state: file.state)
            // A byte-order mark so Excel reads the UTF-8 correctly.
            try Data(("\u{FEFF}" + csv).utf8).write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}
