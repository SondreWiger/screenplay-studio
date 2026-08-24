import SwiftUI

/// A working digital clapperboard.
///
/// Built to be used at arm's length in front of a lens: high contrast, big
/// numerals, and one enormous target for the clap itself. Point it at a shot
/// and each clap logs a take against that shot in the shot list, so the board
/// is part of the production record rather than a prop.
struct SlateView: View {

    let projectID: String
    let projectTitle: String

    @StateObject private var model: SlateViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var isEditingBoard = false
    @State private var isPickingShot = false

    init(projectID: String, projectTitle: String) {
        self.projectID = projectID
        self.projectTitle = projectTitle
        _model = StateObject(wrappedValue: SlateViewModel(projectID: projectID, projectTitle: projectTitle))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                board
                linkRow
                controls
                if !model.takes.isEmpty { takeLog }
            }
            .screenPadding()
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Slate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        isEditingBoard = true
                    } label: {
                        Label("Edit board", systemImage: "square.and.pencil")
                    }
                    Button {
                        model.nextRoll()
                    } label: {
                        Label("Next roll", systemImage: "arrow.triangle.2.circlepath")
                    }
                    Toggle(isOn: Binding(
                        get: { AppSettings.shared.slateSoundEnabled },
                        set: { AppSettings.shared.slateSoundEnabled = $0 }
                    )) {
                        Label("Clap sound", systemImage: "speaker.wave.2")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle").tappableArea()
                }
                .accessibilityLabel("Slate options")
            }
        }
        .sheet(isPresented: $isEditingBoard) {
            SlateEditSheet(state: $model.state) { model.persist() }
        }
        .sheet(isPresented: $isPickingShot) {
            SlateShotPicker(shots: model.shots, scenes: model.scenes) { shot in
                model.link(to: shot)
            }
        }
        .task { await model.loadContext() }
        // Marking takes is the whole job of this screen; the phone must not
        // dim halfway through a setup.
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }

    // MARK: - The board

    private var board: some View {
        VStack(spacing: 0) {
            ClapperSticks(isClosed: model.isClosed)
                .frame(height: 78)
                .accessibilityHidden(true)

            VStack(spacing: 10) {
                HStack(spacing: 8) {
                    SlateField(label: "Roll", value: model.state.roll)
                    SlateField(label: "Scene", value: model.state.scene)
                    SlateField(label: "Take", value: "\(model.state.take)", isPrimary: true)
                }

                HStack(spacing: 8) {
                    SlateField(label: "Production", value: model.state.production.isEmpty ? projectTitle : model.state.production, alignment: .leading)
                }

                HStack(spacing: 8) {
                    SlateField(label: "Director", value: model.state.director.nonEmpty ?? "—", alignment: .leading)
                    SlateField(label: "Camera", value: model.state.camera.nonEmpty ?? "—", alignment: .leading)
                }

                HStack(spacing: 8) {
                    SlateToggleField(label: "INT", isOn: model.state.isInterior)
                    SlateToggleField(label: "EXT", isOn: !model.state.isInterior)
                    SlateToggleField(label: "DAY", isOn: model.state.isDay)
                    SlateToggleField(label: "NIGHT", isOn: !model.state.isDay)
                    SlateToggleField(label: "MOS", isOn: model.state.isMOS)
                }

                SlateField(label: "Date", value: Self.dateLabel, alignment: .leading)
            }
            .padding(14)
            .background(Color(hex: 0x101014))
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .strokeBorder(Color.white.opacity(0.14), lineWidth: 1)
        )
        .contentShape(.rect)
        .onTapGesture { model.mark() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Slate. \(model.state.spokenIdentifier). \(model.state.slugLine)\(model.state.isMOS ? ". M.O.S." : "")")
        .accessibilityHint("Double tap to mark the take")
        .accessibilityAddTraits(.isButton)
    }

    private static var dateLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: Date())
    }

    // MARK: - Shot link

    private var linkRow: some View {
        Group {
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
                            Text(shot.description?.nonEmpty ?? shot.techSummary)
                                .font(.caption)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(1)
                        }

                        Spacer(minLength: 0)

                        Button("Unlink") { model.unlink() }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(minHeight: Theme.minTouchTarget)
                    }
                }
            } else {
                Button {
                    Haptics.tap()
                    isPickingShot = true
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

    // MARK: - Controls

    private var controls: some View {
        VStack(spacing: 10) {
            Button {
                model.mark()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: model.isClosed ? "checkmark" : "hand.tap.fill")
                        .font(.title3.weight(.bold))
                    Text(model.isClosed ? "Marked" : "Mark it")
                        .font(.title3.weight(.bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 76)
                .background(
                    RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                        .fill(model.isClosed ? Theme.success : Theme.accent)
                )
            }
            .buttonStyle(.plain)
            .disabled(model.isClosed)
            .animation(.easeOut(duration: 0.18), value: model.isClosed)
            .accessibilityLabel(model.isClosed ? "Take marked" : "Mark the take")

            HStack(spacing: 10) {
                stepper("Take", down: { model.adjustTake(by: -1) }, up: { model.adjustTake(by: 1) })
                Button {
                    model.nextRoll()
                } label: {
                    VStack(spacing: 1) {
                        Text("Next roll")
                            .font(.caption.weight(.semibold))
                        Text(model.state.roll)
                            .font(.footnote.weight(.bold))
                            .monospacedDigit()
                    }
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: Theme.minTouchTarget + 8)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 10) {
                slateToggle("INT / EXT", isOn: model.state.isInterior, onLabel: "INT", offLabel: "EXT") {
                    model.state.isInterior.toggle(); model.persist(); Haptics.selectionChanged()
                }
                slateToggle("DAY / NIGHT", isOn: model.state.isDay, onLabel: "DAY", offLabel: "NIGHT") {
                    model.state.isDay.toggle(); model.persist(); Haptics.selectionChanged()
                }
                slateToggle("SOUND", isOn: !model.state.isMOS, onLabel: "SYNC", offLabel: "MOS") {
                    model.state.isMOS.toggle(); model.persist(); Haptics.selectionChanged()
                }
            }
        }
    }

    private func stepper(_ label: String, down: @escaping () -> Void, up: @escaping () -> Void) -> some View {
        HStack(spacing: 0) {
            Button(action: down) {
                Image(systemName: "minus")
                    .font(.body.weight(.bold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: Theme.minTouchTarget + 8)
                    .contentShape(.rect)
            }
            .accessibilityLabel("Decrease take")

            Divider().frame(height: 24).overlay(Theme.border)

            Button(action: up) {
                Image(systemName: "plus")
                    .font(.body.weight(.bold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: Theme.minTouchTarget + 8)
                    .contentShape(.rect)
            }
            .accessibilityLabel("Increase take")
        }
        .buttonStyle(.plain)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .strokeBorder(Theme.border, lineWidth: 1)
        )
    }

    private func slateToggle(
        _ accessibilityName: String,
        isOn: Bool,
        onLabel: String,
        offLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(isOn ? onLabel : offLabel)
                .font(.footnote.weight(.bold))
                .foregroundStyle(isOn ? Theme.textPrimary : Theme.Brand.b400)
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
        .accessibilityLabel("\(accessibilityName): \(isOn ? onLabel : offLabel)")
    }

    // MARK: - Take log

    private var takeLog: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: "Marked takes",
                subtitle: "\(model.takes.count) today · swipe to remove"
            )

            VStack(spacing: 6) {
                ForEach(model.takes.prefix(12)) { take in
                    HStack(spacing: 10) {
                        Button {
                            model.toggleCircle(take)
                        } label: {
                            Image(systemName: take.isCircled ? "circle.circle.fill" : "circle")
                                .font(.body)
                                .foregroundStyle(take.isCircled ? Theme.success : Theme.textTertiary)
                                .tappableArea(34)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(take.isCircled ? "Uncircle take" : "Circle this take as a print")

                        Text(take.label)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                            .monospacedDigit()

                        if take.isMOS {
                            Chip(text: "MOS", tint: Theme.warning)
                        }

                        Spacer(minLength: 0)

                        Text(take.timeLabel)
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                            .monospacedDigit()

                        Button {
                            model.deleteTake(take)
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.textTertiary)
                                .tappableArea(34)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove take \(take.label)")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                    .accessibilityElement(children: .contain)
                }
            }
        }
    }
}

// MARK: - Sticks

/// The hinged clapper bar.
///
/// The stripes are drawn as skewed parallelograms in a single `Canvas` rather
/// than as rotated rectangles in a stack — rotating each stripe on its own
/// leaves wedge-shaped gaps between them and clips away most of the bar.
private struct ClapperSticks: View {

    let isClosed: Bool

    private let barHeight: CGFloat = 32

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Color(hex: 0x101014)

            // Fixed lower bar — the top edge of the board itself.
            StripeBar()
                .frame(height: barHeight)

            // Hinged upper stick, pivoting on the left end the way real sticks do.
            StripeBar()
                .frame(height: barHeight)
                .offset(y: -barHeight)
                .rotationEffect(.degrees(isClosed ? 0 : -19), anchor: .bottomLeading)
                .animation(
                    isClosed
                        // Snaps shut and settles. Sticks do not ease.
                        ? .interpolatingSpring(stiffness: 900, damping: 14)
                        : .easeOut(duration: 0.45),
                    value: isClosed
                )
        }
        .clipped()
    }
}

private struct StripeBar: View {
    var body: some View {
        Canvas { context, size in
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(Color(hex: 0x0A0A0C))
            )

            let stripeWidth = max(20, size.width / 11)
            // How far the top edge leads the bottom edge — the classic lean.
            let skew = size.height * 0.42

            var x = -skew - stripeWidth
            while x < size.width + skew {
                var stripe = Path()
                stripe.move(to: CGPoint(x: x, y: size.height))
                stripe.addLine(to: CGPoint(x: x + skew, y: 0))
                stripe.addLine(to: CGPoint(x: x + skew + stripeWidth, y: 0))
                stripe.addLine(to: CGPoint(x: x + stripeWidth, y: size.height))
                stripe.closeSubpath()
                context.fill(stripe, with: .color(.white))

                x += stripeWidth * 2
            }
        }
        .drawingGroup()
    }
}

// MARK: - Board fields

private struct SlateField: View {
    let label: String
    let value: String
    var isPrimary = false
    var alignment: HorizontalAlignment = .center

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.45))
                .tracking(0.8)
            Text(value)
                .font(.system(size: isPrimary ? 34 : 20, weight: .heavy, design: .monospaced))
                .foregroundStyle(isPrimary ? Theme.Brand.b400 : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .center)
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

private struct SlateToggleField: View {
    let label: String
    let isOn: Bool

    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .heavy, design: .monospaced))
            .foregroundStyle(isOn ? Theme.Surface.s950 : Color.white.opacity(0.3))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isOn ? Color.white : Color.white.opacity(0.06))
            )
    }
}
