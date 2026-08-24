import SwiftUI

/// Every draft on a project, so a script that exists is never invisible.
///
/// The hub opens the active draft, which is right most of the time — but a
/// project with several versions had no way to reach the others, and a script
/// you can't reach may as well not have synced.
struct DraftsSheet: View {

    let scripts: [Script]
    let currentScriptID: String?
    let onSelect: (Script) -> Void
    let onCreate: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var sorted: [Script] {
        scripts.sorted { ($0.version ?? 0) > ($1.version ?? 0) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(sorted) { script in
                        Button {
                            Haptics.tap()
                            onSelect(script)
                            dismiss()
                        } label: {
                            DraftRow(script: script, isCurrent: script.id == currentScriptID)
                        }
                        .buttonStyle(.plain)
                    }

                    if scripts.isEmpty {
                        EmptyStateView(
                            symbol: "doc.text",
                            title: "No drafts yet",
                            message: "Create the first draft for this project.",
                            actionTitle: "New draft"
                        ) {
                            onCreate()
                            dismiss()
                        }
                        .padding(.top, 30)
                    }
                }
                .screenPadding()
                .padding(.vertical, 8)
            }
            .background(Theme.background)
            .navigationTitle("Drafts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                if !scripts.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            Haptics.tap()
                            onCreate()
                            dismiss()
                        } label: {
                            Image(systemName: "plus").tappableArea()
                        }
                        .accessibilityLabel("New draft")
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct DraftRow: View {
    let script: Script
    let isCurrent: Bool

    var body: some View {
        Card(padding: 12) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(script.revisionColor?.swatch ?? Color.white)
                    Text(script.versionLabel)
                        .font(.caption2.weight(.black))
                        .foregroundStyle(Theme.Surface.s950)
                }
                .frame(width: 40, height: 40)
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text(script.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        if script.isActive == true {
                            Chip(text: "Active", symbol: "checkmark", tint: Theme.success)
                        }
                        if script.isLocked {
                            Chip(text: "Locked", symbol: "lock.fill", tint: Theme.warning)
                        }
                        if let colour = script.revisionColor, colour != .white {
                            Chip(text: colour.label, tint: Theme.textTertiary)
                        }
                        if let updated = script.updatedAt {
                            Text(Self.relative(updated))
                                .font(.caption2)
                                .foregroundStyle(Theme.textTertiary)
                        }
                    }
                }

                Spacer(minLength: 0)

                if isCurrent {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.body)
                        .foregroundStyle(Theme.accent)
                }
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(script.title), \(script.versionLabel)\(isCurrent ? ", currently open" : "")")
        .accessibilityAddTraits(isCurrent ? [.isButton, .isSelected] : .isButton)
    }

    private static func relative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
