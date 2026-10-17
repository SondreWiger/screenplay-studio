import SwiftUI
import UIKit

/// Turns the editor's elements into a Fountain screenplay
/// (https://fountain.io/syntax), the plain-text format Final Draft, Highland,
/// WriterDuet and the Screenplay Studio web app all import.
enum FountainExporter {

    static func fountain(title: String, author: String?, elements: [ScriptElement]) -> String {
        var lines: [String] = []

        // Title page
        lines.append("Title: \(title)")
        if let author = author?.nonEmpty {
            lines.append("Credit: Written by")
            lines.append("Author: \(author)")
        }
        let date = DateFormatter.localizedString(from: Date(), dateStyle: .long, timeStyle: .none)
        lines.append("Draft date: \(date)")
        lines.append("")

        var previous: ScriptElementType?
        for element in elements.sorted(by: { $0.sortOrder < $1.sortOrder }) {
            if element.isOmitted == true { continue }
            let text = element.content.trimmingCharacters(in: .whitespacesAndNewlines)
            let type = element.elementType

            if type == .pageBreak {
                lines.append("")
                lines.append("===")
                previous = type
                continue
            }
            guard !text.isEmpty else { continue }

            // Dialogue and parentheticals hang directly under their cue; every
            // other block is separated by a blank line.
            let cueOrSpeech: [ScriptElementType] = [.character, .dialogue, .parenthetical, .announcer]
            let joinsPrevious = (type == .dialogue || type == .parenthetical)
                && (previous.map { cueOrSpeech.contains($0) } ?? false)
            if !joinsPrevious, !(lines.last?.isEmpty ?? true) {
                lines.append("")
            }

            lines.append(block(for: type, text: text, sceneNumber: element.sceneNumber))
            previous = type
        }

        return lines.joined(separator: "\n") + "\n"
    }

    private static func block(for type: ScriptElementType, text: String, sceneNumber: String?) -> String {
        switch type {
        case .sceneHeading:
            let heading = text.uppercased()
            let looksLikeHeading = ["INT", "EXT", "EST", "I/E", "INT./EXT", "EXT./INT"].contains {
                heading.hasPrefix($0 + ".") || heading.hasPrefix($0 + " ")
            }
            let number = sceneNumber?.nonEmpty.map { " #\($0)#" } ?? ""
            return (looksLikeHeading ? heading : ".\(heading)") + number
        case .character, .announcer:
            let cue = text.uppercased()
            // A cue with no letters (or lowercase in the source) needs forcing.
            return cue.rangeOfCharacter(from: .letters) == nil ? "@\(cue)" : cue
        case .parenthetical:
            return text.hasPrefix("(") ? text : "(\(text))"
        case .transition:
            let upper = text.uppercased()
            return upper.hasSuffix("TO:") ? upper : "> \(upper)"
        case .centered, .songTitle, .actBreak:
            return "> \(text) <"
        case .note:
            return "[[\(text)]]"
        case .synopsis:
            return "= \(text)"
        case .section, .act, .sequence:
            return "# \(text)"
        case .lyrics, .lyric:
            return text.split(separator: "\n", omittingEmptySubsequences: false).map { "~\($0)" }.joined(separator: "\n")
        case .shot:
            return "!\(text.uppercased())"
        default:
            return text
        }
    }

    /// Writes the script to a temporary `.fountain` file for sharing.
    static func temporaryFile(title: String, author: String?, elements: [ScriptElement]) throws -> URL {
        let safeName = title
            .components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>"))
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespaces)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(safeName.isEmpty ? "Script" : safeName)
            .appendingPathExtension("fountain")
        try fountain(title: title, author: author, elements: elements)
            .write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}

/// A file ready to hand to the share sheet.
struct SharedFile: Identifiable {
    let url: URL
    var id: URL { url }
}

/// `UIActivityViewController` for SwiftUI — AirDrop, Files, Mail, Messages and
/// any app that opens Fountain.
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
