import SwiftUI

/// The bar that sits directly above the keyboard.
///
/// This is the single most important control in the app: on a laptop you change
/// element type with Tab, and there is no Tab key on an iPhone. Without a
/// persistent type switcher within thumb reach, writing a formatted screenplay
/// on a phone is not realistic.
struct EditorToolbar: View {

    let focusedElement: ScriptElement?
    let characterSuggestions: [String]
    let onSelectType: (ScriptElementType) -> Void
    let onSelectCharacter: (String) -> Void
    let onDismissKeyboard: () -> Void

    private var currentType: ScriptElementType? {
        focusedElement?.elementType
    }

    var body: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.border)

            if !characterSuggestions.isEmpty {
                suggestionRow
                Divider().overlay(Theme.border.opacity(0.6))
            }

            typeRow
        }
        .background(.ultraThinMaterial)
        .background(Theme.elevated.opacity(0.85))
        // Only claim space when there's something to act on.
        .opacity(focusedElement == nil ? 0 : 1)
        .frame(height: focusedElement == nil ? 0 : nil)
        .clipped()
        .animation(.easeOut(duration: 0.18), value: focusedElement?.id)
        .animation(.easeOut(duration: 0.18), value: characterSuggestions)
    }

    // MARK: - Character autocomplete

    private var suggestionRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(characterSuggestions, id: \.self) { name in
                    Button {
                        Haptics.tap()
                        onSelectCharacter(name)
                    } label: {
                        Text(name)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                            .lineLimit(1)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 34)
                            .background(Theme.accentSoft, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Use this character name and start a dialogue line")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
        }
    }

    // MARK: - Element types

    private var typeRow: some View {
        HStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(ScriptElementType.standardCycle, id: \.self) { type in
                        typeButton(type)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }

            Divider()
                .overlay(Theme.border)
                .frame(height: 30)

            Button {
                onDismissKeyboard()
            } label: {
                Image(systemName: "keyboard.chevron.compact.down")
                    .font(.body)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 52, height: Theme.minTouchTarget)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Hide keyboard")
        }
    }

    private func typeButton(_ type: ScriptElementType) -> some View {
        let isCurrent = currentType == type

        return Button {
            Haptics.selectionChanged()
            onSelectType(type)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: type.symbol)
                    .font(.caption.weight(.semibold))
                Text(type.shortLabel)
                    .font(.footnote.weight(.semibold))
            }
            .foregroundStyle(isCurrent ? .white : Theme.textSecondary)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(
                Capsule().fill(isCurrent ? Theme.accent : Theme.card)
            )
            .overlay(
                Capsule().strokeBorder(isCurrent ? .clear : Theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(type.label)
        .accessibilityAddTraits(isCurrent ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Save status

/// The small line under the script title. Deliberately quiet — it should be
/// glanceable, never attention-grabbing, except when something failed.
struct SaveStatusLabel: View {
    let state: EditorViewModel.SaveState

    var body: some View {
        Group {
            switch state {
            case .idle:
                EmptyView()
            case .pending:
                label("Unsaved changes", symbol: "circle.dotted", tint: Theme.textTertiary)
            case .saving:
                label("Saving…", symbol: "arrow.triangle.2.circlepath", tint: Theme.textTertiary)
            case .saved(let date):
                label("Saved \(Self.relative(date))", symbol: "checkmark.circle", tint: Theme.textTertiary)
            case .queuedOffline(let count):
                label(
                    count > 0 ? "Offline · \(count) queued" : "Offline · saved on device",
                    symbol: "wifi.slash",
                    tint: Theme.warning
                )
            case .failed:
                label("Save failed", symbol: "exclamationmark.triangle", tint: Theme.danger)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: state)
    }

    private func label(_ text: String, symbol: String, tint: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: symbol)
                .font(.system(size: 9))
            Text(text)
                .font(.caption2)
        }
        .foregroundStyle(tint)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }

    private static func relative(_ date: Date) -> String {
        let seconds = Date().timeIntervalSince(date)
        if seconds < 5 { return "just now" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
