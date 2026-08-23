import SwiftUI

/// Create-project sheet.
///
/// Deliberately short: title, format, optional logline. Anything else is easier
/// to fill in later on a bigger screen, and a long form is the fastest way to
/// stop someone starting a project on their phone.
struct NewProjectSheet: View {

    /// Returns the created project, or nil if it failed.
    let onCreate: (String, ProjectFormat, String?) async -> Project?

    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var format: ProjectFormat = .feature
    @State private var logline = ""
    @State private var isSaving = false
    @FocusState private var titleFocused: Bool

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    LabelledField(
                        label: "Title",
                        placeholder: "Untitled",
                        text: $title,
                        symbol: "textformat",
                        autocapitalisation: .words,
                        submitLabel: .done
                    ) { save() }
                    .focused($titleFocused)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Format")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.4)

                        // A wrapping grid rather than a Picker: five options are
                        // one tap each here, versus two taps and a modal there.
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 104), spacing: 8)],
                            spacing: 8
                        ) {
                            ForEach(ProjectFormat.allCases) { option in
                                Button {
                                    Haptics.selectionChanged()
                                    format = option
                                } label: {
                                    Text(option.label)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(format == option ? .white : Theme.textSecondary)
                                        .frame(maxWidth: .infinity)
                                        .frame(minHeight: Theme.minTouchTarget)
                                        .background(
                                            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                                .fill(format == option ? Theme.accent : Theme.elevated)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                                .strokeBorder(format == option ? .clear : Theme.border, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(format == option ? [.isButton, .isSelected] : .isButton)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Logline")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.4)

                        TextEditor(text: $logline)
                            .font(.body)
                            .foregroundStyle(Theme.textPrimary)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 90)
                            .padding(10)
                            .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                    .strokeBorder(Theme.border, lineWidth: 1)
                            )
                            .overlay(alignment: .topLeading) {
                                if logline.isEmpty {
                                    Text("One sentence: who wants what, and what's in the way.")
                                        .font(.body)
                                        .foregroundStyle(Theme.textTertiary)
                                        .padding(.horizontal, 15)
                                        .padding(.vertical, 18)
                                        .allowsHitTesting(false)
                                }
                            }
                            .accessibilityLabel("Logline")
                    }
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("New project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        save()
                    } label: {
                        if isSaving {
                            ProgressView().tint(Theme.accent)
                        } else {
                            Text("Create").font(.body.weight(.semibold))
                        }
                    }
                    .disabled(!canSave)
                }
            }
            .onAppear { titleFocused = true }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func save() {
        guard canSave else { return }
        isSaving = true
        titleFocused = false

        Task {
            let created = await onCreate(
                title.trimmingCharacters(in: .whitespacesAndNewlines),
                format,
                logline.nonEmpty
            )
            isSaving = false
            if created != nil { dismiss() }
        }
    }
}
