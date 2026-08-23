import SwiftUI

struct NewShotSheet: View {

    let scenes: [ProductionScene]
    let suggestedNumber: (String?) -> String
    let onCreate: (String?, String?, ShotType, ShotMovement, String?, String?) async -> Shot?

    @Environment(\.dismiss) private var dismiss

    @State private var sceneID: String?
    @State private var shotNumber = ""
    @State private var shotType: ShotType = .medium
    @State private var movement: ShotMovement = .static
    @State private var shotDescription = ""
    @State private var lens = ""
    @State private var isSaving = false
    /// True once the user edits the number themselves, so changing scene stops
    /// overwriting their choice.
    @State private var numberIsManual = false
    @FocusState private var isDescriptionFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    if !scenes.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            fieldLabel("Scene")

                            Menu {
                                Button("No scene") { select(sceneID: nil) }
                                Divider()
                                ForEach(scenes) { scene in
                                    Button {
                                        select(sceneID: scene.id)
                                    } label: {
                                        Text(scene.displayHeading)
                                    }
                                }
                            } label: {
                                HStack {
                                    Text(selectedSceneLabel)
                                        .font(.body)
                                        .foregroundStyle(sceneID == nil ? Theme.textTertiary : Theme.textPrimary)
                                        .lineLimit(1)
                                    Spacer()
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.caption)
                                        .foregroundStyle(Theme.textTertiary)
                                }
                                .padding(.horizontal, 14)
                                .frame(minHeight: Theme.minTouchTarget + 6)
                                .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                        .strokeBorder(Theme.border, lineWidth: 1)
                                )
                            }
                            .accessibilityLabel("Scene: \(selectedSceneLabel)")
                        }
                    }

                    HStack(alignment: .top, spacing: 10) {
                        LabelledField(
                            label: "Shot no.",
                            placeholder: "1A",
                            text: $shotNumber,
                            autocapitalisation: .characters
                        )
                        .onChange(of: shotNumber) { _, _ in numberIsManual = true }

                        LabelledField(
                            label: "Lens",
                            placeholder: "35mm",
                            text: $lens,
                            autocapitalisation: .never
                        )
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        fieldLabel("Description")
                        TextEditor(text: $shotDescription)
                            .font(.body)
                            .foregroundStyle(Theme.textPrimary)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 84)
                            .padding(10)
                            .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                    .strokeBorder(Theme.border, lineWidth: 1)
                            )
                            .focused($isDescriptionFocused)
                            .overlay(alignment: .topLeading) {
                                if shotDescription.isEmpty {
                                    Text("What the camera sees.")
                                        .font(.body)
                                        .foregroundStyle(Theme.textTertiary)
                                        .padding(.horizontal, 15)
                                        .padding(.vertical, 18)
                                        .allowsHitTesting(false)
                                }
                            }
                            .accessibilityLabel("Shot description")
                    }

                    pickerGrid(
                        label: "Shot type",
                        options: ShotType.allCases,
                        selection: $shotType,
                        title: { $0.abbreviation },
                        accessibilityTitle: { $0.label },
                        minimum: 62
                    )

                    pickerGrid(
                        label: "Movement",
                        options: ShotMovement.allCases,
                        selection: $movement,
                        title: { $0.label },
                        accessibilityTitle: { $0.label },
                        minimum: 104
                    )
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("New shot")
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
                            Text("Add").font(.body.weight(.semibold))
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .onAppear {
                if shotNumber.isEmpty { shotNumber = suggestedNumber(sceneID) }
                numberIsManual = false
                isDescriptionFocused = true
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var selectedSceneLabel: String {
        guard let sceneID, let scene = scenes.first(where: { $0.id == sceneID }) else {
            return "No scene"
        }
        return scene.displayHeading
    }

    private func select(sceneID newValue: String?) {
        Haptics.selectionChanged()
        sceneID = newValue
        if !numberIsManual {
            shotNumber = suggestedNumber(newValue)
            // `onChange` above fires from this assignment too, so undo the flag.
            numberIsManual = false
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.textTertiary)
            .textCase(.uppercase)
            .tracking(0.4)
    }

    private func pickerGrid<T: Identifiable & Hashable>(
        label: String,
        options: [T],
        selection: Binding<T>,
        title: @escaping (T) -> String,
        accessibilityTitle: @escaping (T) -> String,
        minimum: CGFloat
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel(label)

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: minimum), spacing: 6)],
                spacing: 6
            ) {
                ForEach(options) { option in
                    let isOn = selection.wrappedValue == option
                    Button {
                        Haptics.selectionChanged()
                        selection.wrappedValue = option
                    } label: {
                        Text(title(option))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(isOn ? .white : Theme.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: Theme.minTouchTarget)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                    .fill(isOn ? Theme.accent : Theme.elevated)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                    .strokeBorder(isOn ? .clear : Theme.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(accessibilityTitle(option))
                    .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }

    private func save() {
        guard !isSaving else { return }
        isSaving = true
        isDescriptionFocused = false

        Task {
            let created = await onCreate(
                sceneID,
                shotNumber.nonEmpty,
                shotType,
                movement,
                shotDescription.nonEmpty,
                lens.nonEmpty
            )
            isSaving = false
            if created != nil { dismiss() }
        }
    }
}
