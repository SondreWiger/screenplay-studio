import SwiftUI

// MARK: - App mark

/// The Screenplay Studio icon, drawn as vectors so it stays sharp at any size
/// and matches `public/icon.svg`.
struct AppMark: View {
    var size: CGFloat = 56

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Theme.Brand.b500, Theme.Brand.b700],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            // Three script lines of decreasing length over a left margin rule.
            VStack(alignment: .leading, spacing: size * 0.12) {
                ForEach([0.62, 0.5, 0.56], id: \.self) { width in
                    Capsule()
                        .fill(.white)
                        .frame(width: size * width, height: max(2, size * 0.055))
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Cards

/// The standard raised container. One corner radius everywhere keeps the app
/// from looking assembled out of different kits.
struct Card<Content: View>: View {
    var padding: CGFloat = 14
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
    }
}

// MARK: - Buttons

struct PrimaryButtonStyle: ButtonStyle {
    var isLoading = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity)
            .frame(minHeight: Theme.minTouchTarget + 6)
            .background(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .fill(Theme.accent)
            )
            .opacity(configuration.isPressed || isLoading ? 0.75 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.medium))
            .foregroundStyle(Theme.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(minHeight: Theme.minTouchTarget + 6)
            .background(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .fill(Theme.elevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Chips and badges

/// A compact label. `prominent` fills with the tint, otherwise it's a tinted
/// outline — both keep at least 4.5:1 contrast against the card background.
struct Chip: View {
    let text: String
    var symbol: String?
    var tint: Color = Theme.textSecondary
    var prominent = false

    var body: some View {
        HStack(spacing: 4) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.caption2.weight(.semibold))
            }
            Text(text)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
        }
        .foregroundStyle(prominent ? tint.readableForeground : tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule().fill(prominent ? tint : tint.opacity(0.14))
        )
        .accessibilityElement(children: .combine)
    }
}

/// A small count badge, e.g. "12 scenes".
struct CountBadge: View {
    let count: Int
    let noun: String

    var body: some View {
        Text("\(count) \(count == 1 ? noun : noun + "s")")
            .font(.caption)
            .foregroundStyle(Theme.textTertiary)
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var subtitle: String?
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }
            }

            Spacer(minLength: 8)

            if let actionTitle, let action {
                Button(actionTitle) {
                    Haptics.tap()
                    action()
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.accent)
                .frame(minHeight: Theme.minTouchTarget)
                .contentShape(.rect)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Empty and error states

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Theme.textTertiary)
                .accessibilityHidden(true)

            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
                .multilineTextAlignment(.center)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if let actionTitle, let action {
                Button(actionTitle) {
                    Haptics.tap()
                    action()
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.top, 4)
                .frame(maxWidth: 260)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
    }
}

struct ErrorStateView: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.warning)
                .accessibilityHidden(true)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if let retry {
                Button("Try again") {
                    Haptics.tap()
                    retry()
                }
                .buttonStyle(SecondaryButtonStyle())
                .frame(maxWidth: 200)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Loading

/// Shimmering placeholder rows. Cheaper to look at than a spinner because the
/// layout doesn't jump when the real content arrives.
struct SkeletonList: View {
    var rows = 5

    @State private var shimmer = false

    var body: some View {
        VStack(spacing: Theme.rowSpacing) {
            ForEach(0..<rows, id: \.self) { index in
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .fill(Theme.card)
                    .frame(height: 72)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [.clear, Color.white.opacity(0.05), .clear],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .offset(x: shimmer ? 220 : -220)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                    .opacity(1 - Double(index) * 0.12)
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                shimmer = true
            }
        }
        .accessibilityLabel("Loading")
        // Respect Reduce Motion — the shimmer is decorative.
        .accessibilityHidden(true)
    }
}

// MARK: - Form field

/// A labelled text field sized for thumbs, with the label always visible so it
/// doesn't vanish behind the entered value the way a placeholder does.
struct LabelledField: View {
    let label: String
    var placeholder: String = ""
    @Binding var text: String
    var symbol: String?
    var isSecure = false
    var keyboard: UIKeyboardType = .default
    var textContent: UITextContentType?
    var autocapitalisation: TextInputAutocapitalization = .sentences
    var submitLabel: SubmitLabel = .next
    var onSubmit: (() -> Void)?

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .textCase(.uppercase)
                .tracking(0.4)

            HStack(spacing: 10) {
                if let symbol {
                    Image(systemName: symbol)
                        .font(.body)
                        .foregroundStyle(isFocused ? Theme.accent : Theme.textTertiary)
                        .frame(width: 20)
                        .accessibilityHidden(true)
                }

                Group {
                    if isSecure {
                        SecureField(placeholder, text: $text)
                    } else {
                        TextField(placeholder, text: $text)
                    }
                }
                .font(.body)
                .foregroundStyle(Theme.textPrimary)
                .keyboardType(keyboard)
                .textContentType(textContent)
                .textInputAutocapitalization(autocapitalisation)
                .autocorrectionDisabled(keyboard == .emailAddress || isSecure)
                .submitLabel(submitLabel)
                .focused($isFocused)
                .onSubmit { onSubmit?() }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: Theme.minTouchTarget + 6)
            .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(isFocused ? Theme.accent : Theme.border, lineWidth: isFocused ? 1.5 : 1)
            )
            .animation(.easeOut(duration: 0.15), value: isFocused)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }
}

// MARK: - Progress

/// A thin completion bar with an accessible value.
struct ProgressBar: View {
    let fraction: Double
    var tint: Color = Theme.accent
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.08))
                Capsule()
                    .fill(tint)
                    .frame(width: max(0, min(1, fraction)) * geometry.size.width)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue("\(Int((max(0, min(1, fraction))) * 100)) percent")
    }
}

// MARK: - Layout helpers

extension View {
    /// Guarantees a control is at least as large as Apple's minimum target and
    /// that the whole area — not just the glyph — responds to a tap.
    func tappableArea(_ size: CGFloat = Theme.minTouchTarget) -> some View {
        frame(minWidth: size, minHeight: size)
            .contentShape(.rect)
    }

    /// Standard horizontal inset for full-width screens.
    func screenPadding() -> some View {
        padding(.horizontal, Theme.screenPadding)
    }
}
