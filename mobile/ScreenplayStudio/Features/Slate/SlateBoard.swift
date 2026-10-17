import SwiftUI

/// The clapperboard itself, sized to whatever space it's given — a card on
/// a phone, most of an iPad, or the whole screen in front of a lens.
///
/// Laid out like a smart slate: hinged sticks, the identifying marks in a
/// ruled grid, and running timecode in red LED digits that freeze on the
/// frame the sticks close.
struct SlateBoard: View {

    @ObservedObject var model: SlateViewModel
    let projectTitle: String
    /// Swipe down on the board to clap. Off where the board sits inside a
    /// scroll view, which needs the drag for itself.
    var allowsSwipeToClap = false

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let stickThickness = min(max(size.height * 0.075, 18), 64)
            let rise = stickThickness * 1.6

            VStack(spacing: 0) {
                ClapperSticks(
                    isClosed: model.isClosed || model.state.isMOS,
                    thickness: stickThickness,
                    rise: rise
                )
                .frame(height: stickThickness * 2 + rise)
                .accessibilityHidden(true)

                body(in: CGSize(width: size.width, height: size.height - stickThickness * 2 - rise))
            }
            .rotationEffect(.degrees(model.state.isTail ? 180 : 0))
            .animation(.spring(duration: 0.45), value: model.state.isTail)
        }
        .contentShape(Rectangle())
        .onTapGesture { model.mark() }
        .gesture(swipe)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityHint("Double tap to mark the take")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { model.mark() }
    }

    private var swipe: some Gesture {
        DragGesture(minimumDistance: 24)
            .onEnded { value in
                guard allowsSwipeToClap, value.translation.height > 40,
                      abs(value.translation.width) < value.translation.height else { return }
                model.mark()
            }
    }

    private var accessibilityDescription: String {
        let state = model.state
        var parts = ["Slate", state.spokenIdentifier, state.slugLine]
        if state.isMOS { parts.append("M.O.S.") }
        if state.isTail { parts.append("Tail slate") }
        parts.append("Timecode \(model.reading().timecode.description)")
        return parts.joined(separator: ". ")
    }

    // MARK: - Body grid

    private func body(in size: CGSize) -> some View {
        let state = model.state
        let height = max(size.height, 120)
        let header = height * 0.13
        let marks = height * 0.27
        let timecode = height * 0.31
        let crew = height * 0.15
        let conditions = height - header - marks - timecode - crew

        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                BoardCell(label: "Production", value: state.production.nonEmpty ?? projectTitle, height: header, alignment: .leading)
                rule(vertical: true)
                BoardCell(label: "Date", value: Self.dateLabel, height: header, alignment: .leading)
                    .frame(width: size.width * 0.3)
            }
            rule()
            HStack(spacing: 0) {
                BoardCell(label: "Roll", value: state.roll, height: marks, emphasis: .large)
                rule(vertical: true)
                BoardCell(label: "Scene", value: state.sceneAndShot.nonEmpty ?? "—", height: marks, emphasis: .large)
                    .frame(width: size.width * 0.36)
                rule(vertical: true)
                BoardCell(label: "Take", value: "\(state.take)", height: marks, emphasis: .take)
            }
            rule()
            TimecodeCell(model: model, height: timecode)
            rule()
            HStack(spacing: 0) {
                BoardCell(label: "Director", value: state.director.nonEmpty ?? "—", height: crew, alignment: .leading)
                rule(vertical: true)
                BoardCell(label: "Camera", value: state.camera.nonEmpty ?? "—", height: crew, alignment: .leading)
                rule(vertical: true)
                BoardCell(label: "Cam", value: state.cameraUnit.nonEmpty ?? "—", height: crew)
                    .frame(width: max(54, size.width * 0.11))
            }
            rule()
            HStack(spacing: 6) {
                ConditionChip(text: "INT", isOn: state.isInterior, height: conditions)
                ConditionChip(text: "EXT", isOn: !state.isInterior, height: conditions)
                ConditionChip(text: "DAY", isOn: state.isDay, height: conditions)
                ConditionChip(text: "NIGHT", isOn: !state.isDay, height: conditions)
                ConditionChip(text: state.isMOS ? "MOS" : "SYNC", isOn: true, height: conditions, tint: state.isMOS ? Theme.warning : nil)
            }
            .padding(.horizontal, 8)
            .frame(height: conditions)
        }
        .frame(width: size.width, height: height)
        .background(Self.boardColor)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: Theme.cornerRadius, bottomTrailingRadius: Theme.cornerRadius, style: .continuous))
        .overlay(
            UnevenRoundedRectangle(bottomLeadingRadius: Theme.cornerRadius, bottomTrailingRadius: Theme.cornerRadius, style: .continuous)
                .strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
        )
        .overlay { FlashOverlay(trigger: model.flashCount) }
    }

    private func rule(vertical: Bool = false) -> some View {
        Rectangle()
            .fill(Color.white.opacity(0.2))
            .frame(width: vertical ? 1 : nil, height: vertical ? nil : 1)
    }

    static let boardColor = Color(hex: 0x0B0B0F)

    private static var dateLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yy"
        return formatter.string(from: Date()).uppercased()
    }
}

// MARK: - Cells

private struct BoardCell: View {
    enum Emphasis { case normal, large, take }

    let label: String
    let value: String
    let height: CGFloat
    var alignment: HorizontalAlignment = .center
    var emphasis: Emphasis = .normal

    var body: some View {
        let labelSize = min(max(height * 0.17, 8), 14)
        let valueSize: CGFloat = {
            switch emphasis {
            case .normal: return height * 0.42
            case .large:  return height * 0.5
            case .take:   return height * 0.62
            }
        }()

        VStack(alignment: alignment, spacing: 0) {
            Text(label.uppercased())
                .font(.system(size: labelSize, weight: .bold))
                .tracking(labelSize * 0.1)
                .foregroundStyle(Color.white.opacity(0.5))
            Spacer(minLength: 0)
            Text(value)
                .font(.system(size: max(valueSize, 12), weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(emphasis == .take ? Theme.Brand.b400 : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.3)
                .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .center)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, max(8, height * 0.12))
        .padding(.vertical, max(4, height * 0.08))
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .center)
        .frame(height: height)
    }
}

private struct ConditionChip: View {
    let text: String
    let isOn: Bool
    let height: CGFloat
    var tint: Color?

    var body: some View {
        Text(text)
            .font(.system(size: min(max(height * 0.34, 9), 22), weight: .heavy, design: .rounded))
            .foregroundStyle(isOn ? Theme.Surface.s950 : Color.white.opacity(0.28))
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .frame(maxWidth: .infinity)
            .frame(height: max(16, height * 0.62))
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isOn ? (tint ?? .white) : Color.white.opacity(0.06))
            )
    }
}

/// The running timecode, redrawn every display refresh while the sticks are
/// open and frozen on the clap frame while they're closed.
private struct TimecodeCell: View {
    @ObservedObject var model: SlateViewModel
    let height: CGFloat

    var body: some View {
        let labelSize = min(max(height * 0.11, 8), 14)
        let held = model.heldReading != nil

        VStack(spacing: 0) {
            HStack {
                Text("TIMECODE")
                Spacer()
                if held {
                    Text("HOLD")
                        .foregroundStyle(SevenSegmentDisplay.lit)
                }
                Text("\(model.state.timecodeSource.shortLabel) · \(model.state.frameRate.label)")
            }
            .font(.system(size: labelSize, weight: .bold))
            .tracking(labelSize * 0.1)
            .foregroundStyle(Color.white.opacity(0.5))
            .padding(.horizontal, max(8, height * 0.06))
            .padding(.top, max(4, height * 0.05))

            TimelineView(.animation(minimumInterval: 1.0 / 60, paused: held)) { context in
                let reading = model.reading()
                SevenSegmentDisplay(text: reading.timecode.description)
                    .padding(.horizontal, max(10, height * 0.1))
                    .padding(.vertical, height * 0.06)
            }
        }
        .frame(height: height)
        .background(Color.black)
    }
}

// MARK: - Seven-segment digits

/// LED-style digits, with the unlit segments faintly visible behind the lit
/// ones the way they are on real hardware. Readable from across a set.
struct SevenSegmentDisplay: View {

    let text: String
    var litColor: Color = Self.lit

    static let lit = Color(hex: 0xFF2B2B)

    var body: some View {
        Canvas { context, size in
            let characters = Array(text)
            let digitCount = CGFloat(characters.filter(\.isNumber).count)
            let separatorCount = CGFloat(characters.count) - digitCount
            // Width budget: digits at 0.56 of their height, separators at
            // 0.3, gaps between everything, and room for the forward lean
            // so the last digit isn't clipped.
            let lean: CGFloat = 0.12
            let units = digitCount * 0.56 + separatorCount * 0.3 + CGFloat(characters.count - 1) * 0.1 + lean
            let digitHeight = min(size.height, size.width / max(units, 1))
            let digitWidth = digitHeight * 0.56
            let gap = digitHeight * 0.1
            let totalWidth = units * digitHeight
            var x = (size.width - totalWidth) / 2 + digitHeight * lean / 2
            let y = (size.height - digitHeight) / 2

            for character in characters {
                if let digit = character.wholeNumberValue {
                    let rect = CGRect(x: x, y: y, width: digitWidth, height: digitHeight)
                    draw(digit: digit, in: rect, context: &context)
                    x += digitWidth + gap
                } else {
                    let rect = CGRect(x: x, y: y, width: digitHeight * 0.3, height: digitHeight)
                    drawSeparator(character, in: rect, context: &context)
                    x += digitHeight * 0.3 + gap
                }
            }
        }
        .accessibilityLabel(text)
    }

    private static let segmentsForDigit: [[Int]] = [
        [0, 1, 2, 3, 4, 5],       // 0
        [1, 2],                   // 1
        [0, 1, 6, 4, 3],          // 2
        [0, 1, 6, 2, 3],          // 3
        [5, 6, 1, 2],             // 4
        [0, 5, 6, 2, 3],          // 5
        [0, 5, 6, 4, 3, 2],       // 6
        [0, 1, 2],                // 7
        [0, 1, 2, 3, 4, 5, 6],    // 8
        [0, 1, 2, 3, 5, 6],       // 9
    ]

    private func draw(digit: Int, in rect: CGRect, context: inout GraphicsContext) {
        let lit = Set(Self.segmentsForDigit[digit])
        var ghost = Path()
        var on = Path()
        for segment in 0..<7 {
            let path = Self.segment(segment, in: rect)
            if lit.contains(segment) { on.addPath(path) } else { ghost.addPath(path) }
        }
        context.fill(ghost, with: .color(litColor.opacity(0.09)))
        var glow = context
        glow.addFilter(.shadow(color: litColor.opacity(0.75), radius: rect.height * 0.06))
        glow.fill(on, with: .color(litColor))
    }

    private func drawSeparator(_ character: Character, in rect: CGRect, context: inout GraphicsContext) {
        let dot = rect.height * 0.11
        let top = CGRect(x: rect.midX - dot / 2, y: rect.minY + rect.height * 0.28, width: dot, height: dot)
        var path = Path(roundedRect: top, cornerRadius: dot * 0.2)
        if character == ";" {
            // Drop-frame: the lower dot trails into a comma.
            var comma = Path()
            let x = rect.midX - dot / 2, y = rect.minY + rect.height * 0.62
            comma.move(to: CGPoint(x: x, y: y))
            comma.addLine(to: CGPoint(x: x + dot, y: y))
            comma.addLine(to: CGPoint(x: x + dot * 0.4, y: y + dot * 2))
            comma.addLine(to: CGPoint(x: x - dot * 0.3, y: y + dot * 2))
            comma.closeSubpath()
            path.addPath(comma)
        } else {
            path.addRoundedRect(
                in: CGRect(x: top.minX, y: rect.minY + rect.height * 0.62, width: dot, height: dot),
                cornerSize: CGSize(width: dot * 0.2, height: dot * 0.2)
            )
        }
        var glow = context
        glow.addFilter(.shadow(color: litColor.opacity(0.75), radius: rect.height * 0.06))
        glow.fill(path, with: .color(litColor))
    }

    /// Segment 0 is the top bar, then clockwise: 1 top right, 2 bottom right,
    /// 3 bottom, 4 bottom left, 5 top left; 6 is the middle bar. Each is a
    /// hexagon, and the digit leans slightly forward like hardware LEDs.
    private static func segment(_ index: Int, in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        let t = w * 0.19
        let g = t * 0.14
        let half = t / 2

        func horizontal(_ y: CGFloat) -> [CGPoint] {
            let x0 = half + g, x1 = w - half - g
            return [
                CGPoint(x: x0, y: y), CGPoint(x: x0 + half, y: y - half),
                CGPoint(x: x1 - half, y: y - half), CGPoint(x: x1, y: y),
                CGPoint(x: x1 - half, y: y + half), CGPoint(x: x0 + half, y: y + half),
            ]
        }
        func vertical(_ x: CGFloat, _ y0: CGFloat, _ y1: CGFloat) -> [CGPoint] {
            [
                CGPoint(x: x, y: y0), CGPoint(x: x + half, y: y0 + half),
                CGPoint(x: x + half, y: y1 - half), CGPoint(x: x, y: y1),
                CGPoint(x: x - half, y: y1 - half), CGPoint(x: x - half, y: y0 + half),
            ]
        }

        let points: [CGPoint]
        switch index {
        case 0: points = horizontal(half)
        case 1: points = vertical(w - half, half + g, h / 2 - g)
        case 2: points = vertical(w - half, h / 2 + g, h - half - g)
        case 3: points = horizontal(h - half)
        case 4: points = vertical(half, h / 2 + g, h - half - g)
        case 5: points = vertical(half, half + g, h / 2 - g)
        default: points = horizontal(h / 2)
        }

        let lean = tan(6 * CGFloat.pi / 180)
        var path = Path()
        path.addLines(points.map { CGPoint(x: rect.minX + $0.x + (h - $0.y) * lean - h * lean / 2, y: rect.minY + $0.y) })
        path.closeSubpath()
        return path
    }
}

// MARK: - Sticks

/// The hinged clapper bar. The lower stick is fixed to the board; the upper
/// one pivots on its left end and snaps shut on the clap.
private struct ClapperSticks: View {

    let isClosed: Bool
    let thickness: CGFloat
    /// Room above the sticks for the open one to swing into.
    let rise: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            // Open to whatever angle lifts the far end by `rise`.
            let openAngle = -min(atan(rise / max(width, 1)) * 180 / .pi, 24)

            VStack(spacing: 0) {
                Spacer(minLength: 0)

                StripeBar(phase: 0.5)
                    .frame(width: width, height: thickness)
                    .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                    .shadow(color: .black.opacity(0.5), radius: 3, y: 2)
                    .rotationEffect(.degrees(isClosed ? 0 : openAngle), anchor: .bottomLeading)
                    .animation(
                        reduceMotion
                            ? .linear(duration: 0.05)
                            : (isClosed
                                // Snaps shut and settles. Sticks do not ease.
                                ? .interpolatingSpring(stiffness: 1400, damping: 22)
                                : .easeOut(duration: 0.4)),
                        value: isClosed
                    )
                    .zIndex(1)

                StripeBar(phase: 0)
                    .frame(width: width, height: thickness)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 3, topTrailingRadius: 3, style: .continuous))
            }
            .overlay(alignment: .bottomLeading) {
                // The hinge pin.
                Circle()
                    .fill(Color(hex: 0x9A9AA8))
                    .frame(width: thickness * 0.34, height: thickness * 0.34)
                    .offset(x: thickness * 0.33, y: -thickness * 0.83)
            }
            .frame(width: width, height: geometry.size.height, alignment: .bottomLeading)
        }
    }
}

private struct StripeBar: View {
    /// Shifts the stripes along the bar so the two sticks don't line up,
    /// the way real ones are painted.
    let phase: CGFloat

    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: 0x0A0A0C)))

            let stripeWidth = max(size.height * 1.1, size.width / 14)
            let skew = size.height * 0.9
            var x = -skew - stripeWidth * 2 + stripeWidth * 2 * phase
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
    }
}

// MARK: - Flash

/// A one-frame white flash on the clap — a visual sync point that survives
/// even when the clap itself is out of focus.
private struct FlashOverlay: View {
    let trigger: Int
    @State private var opacity: Double = 0

    var body: some View {
        Color.white
            .opacity(opacity)
            .allowsHitTesting(false)
            .onChange(of: trigger) { _ in
                opacity = 1
                withAnimation(.easeOut(duration: 0.28).delay(0.06)) { opacity = 0 }
            }
    }
}
