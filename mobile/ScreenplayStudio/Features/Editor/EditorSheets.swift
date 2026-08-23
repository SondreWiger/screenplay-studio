import SwiftUI

/// Jump-to-scene list. On a phone, scrolling a 110-page script by thumb is not
/// navigation — this is.
struct SceneJumpSheet: View {

    let scenes: [(index: Int, element: ScriptElement)]
    let onSelect: (ScriptElement) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filtered: [(index: Int, element: ScriptElement)] {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return scenes }
        return scenes.filter { $0.element.content.lowercased().contains(term) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(Array(filtered.enumerated()), id: \.element.element.id) { position, entry in
                        Button {
                            Haptics.tap()
                            onSelect(entry.element)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Text("\(position + 1)")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 30, height: 30)
                                    .background(Theme.accentSoft, in: Circle())

                                Text(entry.element.content.isEmpty
                                     ? "Untitled scene"
                                     : entry.element.content.uppercased())
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.textPrimary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)

                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .frame(minHeight: Theme.minTouchTarget + 8)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }

                    if filtered.isEmpty {
                        EmptyStateView(
                            symbol: "magnifyingglass",
                            title: "No scenes match",
                            message: "Try a different search."
                        )
                        .padding(.top, 40)
                    }
                }
                .screenPadding()
                .padding(.vertical, 8)
            }
            .background(Theme.background)
            .searchable(text: $searchText, prompt: "Search scene headings")
            .navigationTitle("Scenes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

/// Word count, page estimate and the cast list, in one glance.
struct ScriptStatsSheet: View {

    let pages: Double
    let words: Int
    let elements: Int
    let scenes: Int
    let characters: [String]

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Card {
                        HStack(spacing: 0) {
                            StatBlock(value: String(format: "%.1f", pages), label: "Pages")
                            StatBlock(value: "\(scenes)", label: "Scenes")
                            StatBlock(value: "\(words)", label: "Words")
                            StatBlock(value: "\(elements)", label: "Lines")
                        }
                    }

                    Text("Page count is an estimate from line counts, not a paginated render — export from the web app for a exact figure.")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    if !characters.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader(title: "Characters", subtitle: "\(characters.count) speaking")
                            FlowChips(items: characters)
                        }
                    }
                }
                .screenPadding()
                .padding(.vertical, 12)
            }
            .background(Theme.background)
            .navigationTitle("Statistics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct StatBlock: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}

/// Chips that wrap onto as many lines as they need.
struct FlowChips: View {
    let items: [String]
    var tint: Color = Theme.textSecondary

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 90, maximum: 200), spacing: 6, alignment: .leading)],
            alignment: .leading,
            spacing: 6
        ) {
            ForEach(items, id: \.self) { item in
                Chip(text: item, tint: tint)
            }
        }
    }
}
