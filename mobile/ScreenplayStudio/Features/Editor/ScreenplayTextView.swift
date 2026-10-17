import SwiftUI
import UIKit

/// A single screenplay element's text field.
///
/// Wraps `UITextView` rather than using SwiftUI's `TextField`/`TextEditor`
/// because a screenplay editor needs three things SwiftUI doesn't expose:
///
///  * Return creates the *next* element rather than a newline.
///  * Backspace at position zero merges into the previous element.
///  * The view has to self-size to its content inside a scrolling stack.
struct ScreenplayTextView: UIViewRepresentable {

    @Binding var text: String
    let elementType: ScriptElementType
    let fontSize: CGFloat
    /// Extra leading as a fraction of the font size (Settings → Writing).
    var lineSpacingFactor: CGFloat = 0.18
    var isFocused: Bool

    /// Reports intrinsic height back so the row can lay out.
    let onHeightChange: (CGFloat) -> Void
    let onReturn: () -> Void
    /// Backspace pressed with the caret at the very start.
    let onBackspaceAtStart: () -> Void
    let onFocusChange: (Bool) -> Void
    /// Hardware keyboard: Tab (true) / ⇧Tab (false) cycles the element type.
    var onCycleType: (Bool) -> Void = { _ in }
    /// Hardware keyboard: ⌥⌘1…8 picks a type directly.
    var onSetType: (ScriptElementType) -> Void = { _ in }
    /// Hardware keyboard: Esc puts the keyboard away.
    var onEscape: () -> Void = {}

    func makeUIView(context: Context) -> UITextView {
        let textView = SelfSizingTextView()
        textView.delegate = context.coordinator
        let coordinator = context.coordinator
        textView.onCycleType = { [weak coordinator] forward in coordinator?.parent.onCycleType(forward) }
        textView.onSetType = { [weak coordinator] type in coordinator?.parent.onSetType(type) }
        textView.onEscape = { [weak coordinator] in coordinator?.parent.onEscape() }
        textView.isScrollEnabled = false
        textView.backgroundColor = .clear
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.textColor = UIColor(Theme.textPrimary)
        textView.tintColor = UIColor(Theme.accent)
        // Follows the app's light / dark appearance.
        textView.keyboardAppearance = .default
        textView.keyboardDismissMode = .interactive
        textView.spellCheckingType = .yes
        textView.smartQuotesType = .yes
        textView.smartDashesType = .yes
        // Autocorrect fights ALL-CAPS slug lines and character names.
        textView.autocorrectionType = elementType.isUppercased ? .no : .default
        textView.returnKeyType = .default
        textView.adjustsFontForContentSizeCategory = false
        textView.accessibilityLabel = elementType.label

        textView.text = text
        apply(style: textView)
        return textView
    }

    func updateUIView(_ textView: UITextView, context: Context) {
        context.coordinator.parent = self

        if textView.text != text {
            // Preserve the caret across an external text change (undo, autosave
            // normalisation) instead of dumping it at the end.
            let selected = textView.selectedRange
            textView.text = text
            let maxLocation = (textView.text as NSString).length
            textView.selectedRange = NSRange(
                location: min(selected.location, maxLocation),
                length: 0
            )
        }

        apply(style: textView)

        if isFocused, !textView.isFirstResponder {
            textView.becomeFirstResponder()
        } else if !isFocused, textView.isFirstResponder {
            textView.resignFirstResponder()
        }

        context.coordinator.reportHeight(of: textView)
    }

    /// The full attribute set for this element's type and size.
    ///
    /// `UITextView` has no `defaultTextAttributes` the way `UITextField` does,
    /// so the paragraph style has to be carried on the attributed string as well
    /// as on `typingAttributes` — otherwise alignment and leading only apply to
    /// text typed after the view appears.
    private func attributes() -> [NSAttributedString.Key: Any] {
        var font = Self.screenplayFont(size: fontSize, bold: elementType.isBold)

        // Apply italic trait for parenthetical, notes, synopsis.
        if elementType.isItalic {
            if let descriptor = font.fontDescriptor.withSymbolicTraits(
                font.fontDescriptor.symbolicTraits.union(.traitItalic)
            ) {
                font = UIFont(descriptor: descriptor, size: 0)
            }
        }

        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = Self.nsAlignment(for: elementType.alignment)
        // Courier at 12pt sets 12pt leading in the web app (`line-height: 1`);
        // that's too tight to read on a phone, so it opens up by a little (or a
        // lot — Settings → Writing → Line spacing).
        paragraph.lineSpacing = fontSize * lineSpacingFactor

        return [
            .font: font,
            .foregroundColor: UIColor(elementType.textColor),
            .paragraphStyle: paragraph,
        ]
    }

    private func apply(style textView: UITextView) {
        let attrs = attributes()
        textView.font = attrs[.font] as? UIFont
        textView.typingAttributes = attrs
        textView.textAlignment = Self.nsAlignment(for: elementType.alignment)

        // Re-stamp the existing text so a type change re-lays out what's already
        // there, not just what comes next.
        if let existing = textView.text, !existing.isEmpty {
            let selected = textView.selectedRange
            textView.attributedText = NSAttributedString(string: existing, attributes: attrs)
            textView.selectedRange = selected
        }

        textView.autocapitalizationType = elementType.isUppercased ? .allCharacters : .sentences
        textView.autocorrectionType = elementType.isUppercased ? .no : .default
    }

    /// Courier New ships with iOS and is the closest match to the Courier Prime
    /// the web app uses. Sized through `UIFontMetrics` so Dynamic Type still
    /// scales the page.
    static func screenplayFont(size: CGFloat, bold: Bool) -> UIFont {
        let name = bold ? "CourierNewPS-BoldMT" : "CourierNewPSMT"
        let base = UIFont(name: name, size: size)
            ?? UIFont.monospacedSystemFont(ofSize: size, weight: bold ? .bold : .regular)
        return UIFontMetrics(forTextStyle: .body).scaledFont(for: base)
    }

    private static func nsAlignment(for alignment: TextAlignment) -> NSTextAlignment {
        switch alignment {
        case .leading:  return .left
        case .center:   return .center
        case .trailing: return .right
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ScreenplayTextView
        private var lastReportedHeight: CGFloat = 0

        init(parent: ScreenplayTextView) {
            self.parent = parent
        }

        func reportHeight(of textView: UITextView) {
            let width = textView.bounds.width
            guard width > 0 else { return }
            let size = textView.sizeThatFits(
                CGSize(width: width, height: .greatestFiniteMagnitude)
            )
            let height = max(size.height, parent.fontSize * 1.4)
            guard abs(height - lastReportedHeight) > 0.5 else { return }
            lastReportedHeight = height
            // Bounce out of the layout pass before mutating SwiftUI state.
            DispatchQueue.main.async { [onHeightChange = parent.onHeightChange] in
                onHeightChange(height)
            }
        }

        func textView(
            _ textView: UITextView,
            shouldChangeTextIn range: NSRange,
            replacementText text: String
        ) -> Bool {
            // Return → new element of the appropriate type.
            if text == "\n" {
                parent.onReturn()
                return false
            }

            // Backspace with the caret at the very start → merge upward.
            if text.isEmpty, range.location == 0, range.length == 0 {
                parent.onBackspaceAtStart()
                return false
            }

            return true
        }

        func textViewDidChange(_ textView: UITextView) {
            var value = textView.text ?? ""

            // Keep the stored value in the casing the format demands, even when
            // text arrives by paste or dictation and bypasses the keyboard's
            // all-caps mode.
            if parent.elementType.isUppercased {
                let uppercased = value.uppercased()
                if uppercased != value {
                    let selected = textView.selectedRange
                    textView.text = uppercased
                    textView.selectedRange = selected
                    value = uppercased
                }
            }

            parent.text = value
            reportHeight(of: textView)
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            parent.onFocusChange(true)
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            parent.onFocusChange(false)
        }
    }
}

/// `UITextView` reports a zero intrinsic size when scrolling is off; overriding
/// it lets the row size itself without a layout pass round-trip.
///
/// It also carries the editor's hardware-keyboard commands, which only make
/// sense while a line is being edited.
private final class SelfSizingTextView: UITextView {

    var onCycleType: ((Bool) -> Void)?
    var onSetType: ((ScriptElementType) -> Void)?
    var onEscape: (() -> Void)?

    override var keyCommands: [UIKeyCommand]? {
        var commands: [UIKeyCommand] = [
            UIKeyCommand(title: "Next Element Type", action: #selector(cycleForward), input: "\t"),
            UIKeyCommand(title: "Previous Element Type", action: #selector(cycleBackward), input: "\t", modifierFlags: .shift),
            UIKeyCommand(title: "Hide Keyboard", action: #selector(escape), input: UIKeyCommand.inputEscape),
        ]
        for (index, type) in ScriptElementType.standardCycle.prefix(8).enumerated() {
            commands.append(UIKeyCommand(
                title: type.label,
                action: #selector(setType(_:)),
                input: "\(index + 1)",
                modifierFlags: [.command, .alternate],
                propertyList: index
            ))
        }
        // Tab would otherwise move focus to the next control.
        commands.forEach { $0.wantsPriorityOverSystemBehavior = true }
        return commands
    }

    @objc private func cycleForward() { onCycleType?(true) }
    @objc private func cycleBackward() { onCycleType?(false) }
    @objc private func escape() { onEscape?() }

    @objc private func setType(_ sender: UIKeyCommand) {
        guard let index = sender.propertyList as? Int,
              index < ScriptElementType.standardCycle.count else { return }
        onSetType?(ScriptElementType.standardCycle[index])
    }

    override var intrinsicContentSize: CGSize {
        guard bounds.width > 0 else { return super.intrinsicContentSize }
        let size = sizeThatFits(CGSize(width: bounds.width, height: .greatestFiniteMagnitude))
        return CGSize(width: UIView.noIntrinsicMetric, height: size.height)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        invalidateIntrinsicContentSize()
    }
}
