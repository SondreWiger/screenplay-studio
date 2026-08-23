import SwiftUI

struct NewCharacterSheet: View {

    let onCreate: (String, String?, Bool) async -> ProjectCharacter?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var description = ""
    @State private var isMain = false
    @State private var isSaving = false
    @FocusState private var isNameFocused: Bool

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    LabelledField(
                        label: "Name",
                        placeholder: "MARGOT",
                        text: $name,
                        symbol: "person",
                        autocapitalisation: .characters,
                        submitLabel: .done
                    ) { isNameFocused = false }
                    .focused($isNameFocused)

                    Card {
                        Toggle(isOn: $isMain) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Lead role")
                                    .font(.body)
                                    .foregroundStyle(Theme.textPrimary)
                                Text("Leads sort to the top of the cast list.")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textTertiary)
                            }
                        }
                        .tint(Theme.accent)
                        .frame(minHeight: Theme.minTouchTarget)
                        .onChange(of: isMain) { _, _ in Haptics.selectionChanged() }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.4)

                        TextEditor(text: $description)
                            .font(.body)
                            .foregroundStyle(Theme.textPrimary)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 100)
                            .padding(10)
                            .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                    .strokeBorder(Theme.border, lineWidth: 1)
                            )
                            .overlay(alignment: .topLeading) {
                                if description.isEmpty {
                                    Text("Who they are, what they want.")
                                        .font(.body)
                                        .foregroundStyle(Theme.textTertiary)
                                        .padding(.horizontal, 15)
                                        .padding(.vertical, 18)
                                        .allowsHitTesting(false)
                                }
                            }
                            .accessibilityLabel("Character description")
                    }
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("New character")
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
                    .disabled(!canSave)
                }
            }
            .onAppear { isNameFocused = true }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func save() {
        guard canSave else { return }
        isSaving = true
        isNameFocused = false
        Task {
            let created = await onCreate(
                name.trimmingCharacters(in: .whitespacesAndNewlines),
                description.nonEmpty,
                isMain
            )
            isSaving = false
            if created != nil { dismiss() }
        }
    }
}

/// Attaches an actor to a character. A medium detent, because it is one field.
struct CastingSheet: View {

    let character: ProjectCharacter
    let onSave: (String?) async -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var actor: String
    @State private var isSaving = false
    @FocusState private var isFocused: Bool

    init(character: ProjectCharacter, onSave: @escaping (String?) async -> Void) {
        self.character = character
        self.onSave = onSave
        _actor = State(initialValue: character.castActor ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                HStack(spacing: 12) {
                    Text(character.initials)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color(webHex: character.color).readableForeground)
                        .frame(width: 44, height: 44)
                        .background(Color(webHex: character.color), in: Circle())
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(character.name)
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        if let subtitle = character.description?.nonEmpty {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }

                LabelledField(
                    label: "Cast",
                    placeholder: "Actor's name",
                    text: $actor,
                    symbol: "person.crop.circle",
                    textContent: .name,
                    autocapitalisation: .words,
                    submitLabel: .done
                ) { save() }
                .focused($isFocused)

                if !(character.castActor ?? "").isEmpty {
                    Button("Remove casting", role: .destructive) {
                        actor = ""
                        save()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }

                Spacer(minLength: 0)
            }
            .screenPadding()
            .padding(.top, 16)
            .background(Theme.background)
            .navigationTitle("Casting")
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
                            Text("Save").font(.body.weight(.semibold))
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .onAppear { isFocused = true }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private func save() {
        guard !isSaving else { return }
        isSaving = true
        isFocused = false
        Task {
            await onSave(actor.nonEmpty)
            isSaving = false
            dismiss()
        }
    }
}
