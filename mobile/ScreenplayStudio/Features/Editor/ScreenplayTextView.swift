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
    var isFocused: Bool

    let onReturn: () -> Void
    /// Backspace pressed with the caret at the very start.
    let onBackspaceAtStart: () -> Void
    let onFocusChange: (Bool) -> Void
    /// A hardware keyboard asked for a different element type — Tab,
    /// Shift-Tab, or ⌘1…⌘8, the way desktop screenwriting apps work.
    var onSetType: ((ScriptElementType) -> Void)?

    func makeUIView(context: Context) -> UITextView {
        let textView = ElementTextView()
        textView.delegate = context.coordinator
        textView.onKeyCommand = { [weak coordinator = context.coordinator] command in
            coordinator?.handle(command)
        }
        textView.isScrollEnabled = false
        textView.backgroundColor = .clear
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.textColor = UIColor(Theme.textPrimary)
        textView.tintColor = UIColor(Theme.accent)
        textView.keyboardAppearance = .dark
        textView.keyboardDismissMode = .interactive
        textView.spellCheckingType = .yes
        textView.smartQuotesType = .yes
        textView.smartDashesType = .yes
        textView.returnKeyType = .default
        textView.adjustsFontForContentSizeCategory = false
        textView.accessibilityLabel = elementType.label

        restyle(textView, coordinator: context.coordinator)
        return textView
    }

    func updateUIView(_ textView: UITextView, context: Context) {
        let coordinator = context.coordinator
        coordinator.parent = self

        // Restyling re-lays out all of the text, so it happens only when the
        // type or size changed — not every time the editor around it redraws.
        if coordinator.styledType != elementType || coordinator.styledFontSize != fontSize {
            restyle(textView, coordinator: coordinator)
        } else if textView.text != text {
            // An external change (merge, remote edit): keep the caret where it was.
            Self.stamp(text, on: textView, attributes: coordinator.attributes)
        }

        if isFocused, !textView.isFirstResponder {
            textView.becomeFirstResponder()
        } else if !isFocused, textView.isFirstResponder {
            textView.resignFirstResponder()
        }
    }

    /// The height this line needs at the proposed width. Measuring here, where
    /// SwiftUI asks, replaces reporting each height back through view state —
    /// which redrew the whole editor once per line as a script opened.
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width.isFinite, width > 0 else { return nil }
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: max(ceil(fitted.height), fontSize * 1.4))
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
        // that's too tight to read on a phone, so open it up slightly.
        paragraph.lineSpacing = fontSize * 0.18

        return [
            .font: font,
            .foregroundColor: UIColor(elementType.textColor),
            .paragraphStyle: paragraph,
        ]
    }

    /// Applies this type's look and keyboard behaviour, and re-stamps the text
    /// so a type change re-lays out what's already there, not just what comes next.
    private func restyle(_ textView: UITextView, coordinator: Coordinator) {
        let attrs = attributes()
        coordinator.attributes = attrs
        coordinator.styledType = elementType
        coordinator.styledFontSize = fontSize

        textView.font = attrs[.font] as? UIFont
        textView.textAlignment = Self.nsAlignment(for: elementType.alignment)
        textView.autocapitalizationType = elementType.isUppercased ? .allCharacters : .sentences
        // Autocorrect fights ALL-CAPS slug lines and character names.
        textView.autocorrectionType = elementType.isUppercased ? .no : .default
        Self.stamp(text, on: textView, attributes: attrs)
    }

    /// Replaces the text with `string` in `attributes`, keeping the selection.
    fileprivate static func stamp(
        _ string: String,
        on textView: UITextView,
        attributes: [NSAttributedString.Key: Any]
    ) {
        let selected = textView.selectedRange
        textView.attributedText = NSAttributedString(string: string, attributes: attributes)
        // An empty attributed string takes the typing attributes with it.
        textView.typingAttributes = attributes
        let length = (string as NSString).length
        let location = min(selected.location, length)
        textView.selectedRange = NSRange(location: location, length: min(selected.length, length - location))
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

        /// What the text view was last styled with, so redraws that change
        /// neither can skip restyling.
        var styledType: ScriptElementType?
        var styledFontSize: CGFloat = 0
        var attributes: [NSAttributedString.Key: Any] = [:]

        init(parent: ScreenplayTextView) {
            self.parent = parent
        }

        func handle(_ command: ElementTextView.Command) {
            let current = parent.elementType
            switch command {
            case .nextType:     parent.onSetType?(current.nextInCycle)
            case .previousType: parent.onSetType?(current.previousInCycle)
            case .type(let type): if type != current { parent.onSetType?(type) }
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
                    ScreenplayTextView.stamp(uppercased, on: textView, attributes: attributes)
                    value = uppercased
                }
            }

            parent.text = value
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            parent.onFocusChange(true)
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            parent.onFocusChange(false)
        }
    }
}

/// Reports no intrinsic size. The height comes from `sizeThatFits`, and a
/// natural width would let one long line push its row past the page edge.
///
/// Also carries the hardware-keyboard commands. They take priority over the
/// system's Tab handling only while a script line is being edited, and show
/// up in the ⌘-hold shortcut overlay on iPad.
final class ElementTextView: UITextView {

    enum Command {
        case nextType, previousType
        case type(ScriptElementType)
    }

    var onKeyCommand: ((Command) -> Void)?

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: UIView.noIntrinsicMetric)
    }

    private static let commands: [UIKeyCommand] = {
        let next = UIKeyCommand(title: "Next element type", action: #selector(nextType), input: "\t")
        let previous = UIKeyCommand(title: "Previous element type", action: #selector(previousType), input: "\t", modifierFlags: .shift)
        var commands = [next, previous]
        for (index, type) in ScriptElementType.standardCycle.prefix(9).enumerated() {
            commands.append(UIKeyCommand(
                title: type.label,
                action: #selector(setType(_:)),
                input: String(index + 1),
                modifierFlags: .command,
                propertyList: index
            ))
        }
        for command in commands { command.wantsPriorityOverSystemBehavior = true }
        return commands
    }()

    override var keyCommands: [UIKeyCommand]? {
        isFirstResponder ? Self.commands : nil
    }

    @objc private func nextType() { onKeyCommand?(.nextType) }
    @objc private func previousType() { onKeyCommand?(.previousType) }

    @objc private func setType(_ sender: UIKeyCommand) {
        guard let index = sender.propertyList as? Int,
              ScriptElementType.standardCycle.indices.contains(index) else { return }
        onKeyCommand?(.type(ScriptElementType.standardCycle[index]))
    }
}
