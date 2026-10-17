import SwiftUI

/// The board itself, full screen, for holding up in front of the lens.
///
/// Turn an iPhone sideways for the classic landscape board. The running
/// timecode is drawn as LED digits; on the clap it freezes on the sync frame
/// while the whole screen flashes white for that frame, and the sync beep
/// sounds — picture, sound and timecode all mark the same instant.
struct SlateBoardView: View {

    @ObservedObject var model: SlateViewModel
    let onClose: () -> Void

    @Environment(\.verticalSizeClass) private var verticalSizeClass

    private var isLandscape: Bool { verticalSizeClass == .compact }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            board
                .rotationEffect(.degrees(model.isTailMode ? 180 : 0))
                .animation(.easeInOut(duration: 0.35), value: model.isTailMode)

            controls

            // The sync flash: one displayed frame of white over everything.
            if model.isFlashing {
                Color.white.ignoresSafeArea().allowsHitTesting(false)
            }
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onAppear {
            ScreenBrightness.boost()
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear {
            ScreenBrightness.restore()
        }
    }

    // MARK: - Board

    private var board: some View {
        VStack(spacing: 0) {
            BoardSticks(isClosed: model.sticksClosed || model.state.kind == .mos)
                .frame(height: isLandscape ? 54 : 72)

            Group {
                if isLandscape {
                    HStack(alignment: .top, spacing: 14) {
                        fields
                        VStack(spacing: 12) {
                            timecode
                            takeBlock
                        }
                        .frame(maxWidth: 360)
                    }
                } else {
                    VStack(spacing: 12) {
                        timecode
                        takeBlock
                        fields
                    }
                }
            }
            .padding(14)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Color(hex: 0x0B0B0F))
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 84)
        .contentShape(.rect)
        .onTapGesture {
            // The whole board is the clap target while it's waiting for one.
            if model.phase == .ready || model.isTailMode { model.mark() }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Slate board. \(model.state.spokenIdentifier)")
        .accessibilityHint(model.phase == .ready ? "Double tap to mark" : "")
        .accessibilityAddTraits(.isButton)
    }

    private var timecode: some View {
        TimelineView(.animation) { _ in
            let live = model.timecode(at: SlateClock.now())
            let shown = model.frozenTimecode ?? live
            VStack(spacing: 4) {
                LEDTimecode(text: shown.formatted(model.state.frameRate), frozen: model.frozenTimecode != nil)
                HStack(spacing: 8) {
                    Text(model.state.frameRate.label + " fps")
                    Text("·")
                    Text(model.frozenTimecode != nil ? "SYNC" : model.jam.source == .ltc ? "LTC JAM" : model.jam.source == .manual ? "JAM" : "TOD")
                        .foregroundStyle(model.frozenTimecode != nil ? Color(hex: 0xFF3B30) : .white.opacity(0.5))
                }
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Color.black, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.white.opacity(0.08)))
        }
    }

    private var takeBlock: some View {
        HStack(spacing: 10) {
            BoardField(label: "Scene", value: model.state.scene, size: 40)
            if !model.state.setup.isEmpty {
                BoardField(label: "Shot", value: model.state.setup, size: 40)
            }
            BoardField(label: "Take", value: "\(model.state.take)", size: 48, accent: true)
        }
    }

    private var fields: some View {
        VStack(spacing: 10) {
            BoardField(label: "Production", value: model.state.production.nonEmpty ?? model.projectTitle, size: 20, alignment: .leading)
            HStack(spacing: 10) {
                BoardField(label: "Roll", value: model.state.roll, size: 20)
                BoardField(label: "Sound", value: model.state.soundRoll, size: 20)
                BoardField(label: "Cam", value: model.state.cameraLetter, size: 20)
            }
            HStack(spacing: 10) {
                BoardField(label: "Director", value: model.state.director.nonEmpty ?? "—", size: 16, alignment: .leading)
                BoardField(label: "Camera", value: model.state.camera.nonEmpty ?? "—", size: 16, alignment: .leading)
            }
            HStack(spacing: 6) {
                BoardFlag(label: "INT", on: model.state.isInterior)
                BoardFlag(label: "EXT", on: !model.state.isInterior)
                BoardFlag(label: "DAY", on: model.state.isDay)
                BoardFlag(label: "NIGHT", on: !model.state.isDay)
                BoardFlag(label: model.state.kind.label, on: model.state.kind != .sync, warning: model.state.kind == .mos)
                if model.isTailMode { BoardFlag(label: "TAIL", on: true, warning: true) }
            }
            HStack(spacing: 10) {
                BoardField(label: "Date", value: Self.dateLabel, size: 16, alignment: .leading)
                if !model.state.lens.isEmpty {
                    BoardField(label: "Lens", value: model.state.lens, size: 16)
                }
            }
        }
    }

    private static var dateLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: Date())
    }

    // MARK: - Controls

    /// Kept small and to the bottom edge so the board fills the frame.
    private var controls: some View {
        VStack {
            Spacer()
            HStack(spacing: 10) {
                circleButton("xmark", label: "Close board") { onClose() }

                if model.phase == .ready {
                    circleButton("minus", label: "Previous take") { model.adjustTake(by: -1) }
                    circleButton("plus", label: "Next take") { model.adjustTake(by: 1) }
                }

                Spacer(minLength: 0)

                SlateActionBar(model: model, compact: true)
                    .frame(maxWidth: 420)
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 12)
        }
    }

    private func circleButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(Color.white.opacity(0.12), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - Action bar (shared with the slate screen)

/// The one control that matters on set, which changes with the take:
/// **Mark** → **Cut** → rate it.
struct SlateActionBar: View {

    @ObservedObject var model: SlateViewModel
    /// The board's version: always on black. Otherwise it follows the app.
    var compact = false

    private var neutralFill: Color { compact ? Color.white.opacity(0.14) : Theme.elevated }
    private var neutralText: Color { compact ? .white : Theme.textPrimary }

    var body: some View {
        Group {
            switch model.phase {
            case .ready:
                bigButton(
                    model.isTailMode ? "Tail slate" : (model.state.kind == .mos ? "Mark MOS" : "Mark"),
                    symbol: model.isTailMode ? "arrow.uturn.down" : "hand.tap.fill",
                    tint: compact ? Theme.Brand.b500 : Theme.accent
                ) { model.mark() }

            case .rolling:
                HStack(spacing: 8) {
                    if !compact || !model.isTailMode {
                        Button {
                            Haptics.selectionChanged()
                            model.isTailMode.toggle()
                        } label: {
                            Label("Tail", systemImage: "arrow.uturn.down")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(model.isTailMode ? Color.white : neutralText)
                                .padding(.horizontal, 14)
                                .frame(height: compact ? 56 : 64)
                                .background(model.isTailMode ? Color(hex: 0xD97706) : neutralFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(model.isTailMode ? "Cancel tail slate" : "Tail slate this take")
                    }
                    if model.isTailMode {
                        bigButton("Clap tail", symbol: "hand.tap.fill", tint: Theme.Brand.b500) { model.mark() }
                    } else {
                        RollingCutButton(model: model, compact: compact)
                    }
                }

            case .cut:
                HStack(spacing: 6) {
                    ratingButton(.circled, "Circle", tint: Color(hex: 0x22C55E))
                    ratingButton(.good, "Good", tint: Color(hex: 0x3B82F6))
                    ratingButton(.ng, "NG", tint: Color(hex: 0xEF4444))
                    Button {
                        Haptics.tap()
                        model.nextTake()
                    } label: {
                        Image(systemName: "arrow.right")
                            .font(.body.weight(.bold))
                            .foregroundStyle(neutralText)
                            .frame(width: compact ? 52 : 60, height: compact ? 56 : 64)
                            .background(neutralFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Next take without rating")
                }
            }
        }
        .animation(.easeOut(duration: 0.18), value: model.phase)
    }

    private func bigButton(_ title: String, symbol: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.title3.weight(.heavy))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: compact ? 56 : 72)
                .background(tint, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .keyboardShortcut(.space, modifiers: [])
    }

    private func ratingButton(_ rating: TakeRating, _ title: String, tint: Color) -> some View {
        Button {
            model.rate(rating)
        } label: {
            VStack(spacing: 2) {
                Image(systemName: rating.symbol)
                    .font(.body.weight(.bold))
                Text(title)
                    .font(.caption.weight(.bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: compact ? 56 : 64)
            .background(tint, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title) take \(model.currentTake?.take ?? 0)")
    }
}

/// "Cut" with the time since the clap running in it.
private struct RollingCutButton: View {
    @ObservedObject var model: SlateViewModel
    let compact: Bool

    var body: some View {
        Button {
            model.cut()
        } label: {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                HStack(spacing: 10) {
                    Circle().fill(Color(hex: 0xFF3B30)).frame(width: 10, height: 10)
                    Text("Cut")
                        .font(.title3.weight(.heavy))
                    if let take = model.currentTake {
                        Text(Self.elapsed(since: take.markedAt))
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: compact ? 56 : 72)
                .background(Color(hex: 0x2A2A33), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0xFF3B30).opacity(0.6), lineWidth: 1.5))
            }
        }
        .buttonStyle(.plain)
        .keyboardShortcut(.space, modifiers: [])
        .accessibilityLabel("Cut take \(model.currentTake?.take ?? 0)")
    }

    private static func elapsed(since date: Date) -> String {
        let seconds = max(0, Int(Date().timeIntervalSince(date)))
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

// MARK: - Pieces

/// Red seven-segment-style digits, as on a timecode slate.
struct LEDTimecode: View {
    let text: String
    var frozen = false

    var body: some View {
        Text(text)
            .font(.system(size: 64, weight: .bold, design: .monospaced))
            .minimumScaleFactor(0.3)
            .lineLimit(1)
            .foregroundStyle(Color(hex: 0xFF2D2D))
            .shadow(color: Color(hex: 0xFF2D2D).opacity(0.65), radius: frozen ? 14 : 8)
            .padding(.horizontal, 10)
            .accessibilityLabel("Timecode \(text)")
    }
}

private struct BoardField: View {
    let label: String
    let value: String
    var size: CGFloat = 20
    var alignment: HorizontalAlignment = .center
    var accent = false

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.45))
                .tracking(0.8)
            Text(value)
                .font(.system(size: size, weight: .heavy, design: .monospaced))
                .foregroundStyle(accent ? Theme.Brand.b400 : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.4)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .center)
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct BoardFlag: View {
    let label: String
    let on: Bool
    var warning = false

    var body: some View {
        Text(label)
            .font(.system(size: 12, weight: .heavy, design: .monospaced))
            .foregroundStyle(on ? (warning ? .white : Theme.Surface.s950) : Color.white.opacity(0.28))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(on ? (warning ? Color(hex: 0xD97706) : Color.white) : Color.white.opacity(0.06))
            )
    }
}

/// The hinged clapper bar. Closed is closed instantly — the frame the sticks
/// meet is the frame that flashes — and opens with a little ease.
struct BoardSticks: View {
    let isClosed: Bool

    var body: some View {
        GeometryReader { geometry in
            let barHeight = geometry.size.height * 0.44
            ZStack(alignment: .bottomLeading) {
                Color(hex: 0x0B0B0F)
                StickStripes()
                    .frame(height: barHeight)
                StickStripes()
                    .frame(height: barHeight)
                    .offset(y: -barHeight)
                    .rotationEffect(.degrees(isClosed ? 0 : -16), anchor: .bottomLeading)
                    .animation(isClosed ? nil : .easeOut(duration: 0.4), value: isClosed)
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// Diagonal black-and-white stripes, drawn as skewed parallelograms in one
/// `Canvas` so there are no gaps between them.
private struct StickStripes: View {
    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: 0x0A0A0C)))
            let stripeWidth = max(20, size.width / 11)
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
