import SwiftUI

/// Edits the marks that stay the same all day.
struct SlateEditSheet: View {

    @Binding var state: SlateState
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    LabelledField(
                        label: "Production",
                        placeholder: "Title on the board",
                        text: $state.production,
                        symbol: "film",
                        autocapitalisation: .words
                    )
                    LabelledField(
                        label: "Director",
                        placeholder: "Name",
                        text: $state.director,
                        symbol: "person",
                        textContent: .name,
                        autocapitalisation: .words
                    )
                    LabelledField(
                        label: "Camera",
                        placeholder: "DP or operator",
                        text: $state.camera,
                        symbol: "camera",
                        autocapitalisation: .words
                    )

                    HStack(spacing: 10) {
                        LabelledField(
                            label: "Roll",
                            placeholder: "A001",
                            text: $state.roll,
                            autocapitalisation: .characters
                        )
                        LabelledField(
                            label: "Scene",
                            placeholder: "12A",
                            text: $state.scene,
                            autocapitalisation: .characters
                        )
                    }

                    Card {
                        VStack(spacing: 4) {
                            Toggle("Interior", isOn: $state.isInterior)
                                .frame(minHeight: Theme.minTouchTarget)
                            Divider().overlay(Theme.border)
                            Toggle("Day", isOn: $state.isDay)
                                .frame(minHeight: Theme.minTouchTarget)
                            Divider().overlay(Theme.border)
                            Toggle("MOS (no sync sound)", isOn: $state.isMOS)
                                .frame(minHeight: Theme.minTouchTarget)
                        }
                        .tint(Theme.accent)
                        .foregroundStyle(Theme.textPrimary)
                    }
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("Board")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        onSave()
                        Haptics.success()
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

/// Chooses which shot the slate is marking.
struct SlateShotPicker: View {

    let shots: [Shot]
    let scenes: [ProductionScene]
    let onSelect: (Shot) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filtered: [Shot] {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return shots }
        return shots.filter {
            ($0.shotNumber?.lowercased().contains(term) ?? false)
                || ($0.description?.lowercased().contains(term) ?? false)
        }
    }

    private func sceneHeading(for shot: Shot) -> String? {
        guard let id = shot.sceneID else { return nil }
        return scenes.first { $0.id == id }?.displayHeading
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filtered) { shot in
                        Button {
                            onSelect(shot)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Text(shot.displayNumber)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 44, height: 32)
                                    .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 7, style: .continuous))

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(shot.description?.nonEmpty ?? shot.techSummary)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Theme.textPrimary)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                    if let heading = sceneHeading(for: shot) {
                                        Text(heading)
                                            .font(.caption)
                                            .foregroundStyle(Theme.textTertiary)
                                            .lineLimit(1)
                                    }
                                    if let takes = shot.takesLabel {
                                        Text(takes)
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textTertiary)
                                    }
                                }

                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .frame(minHeight: Theme.minTouchTarget + 12)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }

                    if filtered.isEmpty {
                        EmptyStateView(
                            symbol: "camera",
                            title: "No shots match",
                            message: "Add shots on the shot list, then point the slate at one."
                        )
                        .padding(.top, 40)
                    }
                }
                .screenPadding()
                .padding(.vertical, 8)
            }
            .background(Theme.background)
            .searchable(text: $searchText, prompt: "Search shots")
            .navigationTitle("Link to shot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
