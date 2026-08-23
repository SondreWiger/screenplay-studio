import SwiftUI

struct NewSceneSheet: View {

    let onCreate: (String, SceneLocationType, String?, SceneTime) async -> ProductionScene?

    @Environment(\.dismiss) private var dismiss

    @State private var locationType: SceneLocationType = .interior
    @State private var locationName = ""
    @State private var timeOfDay: SceneTime = .day
    @State private var isSaving = false
    @FocusState private var isNameFocused: Bool

    /// The slug line assembled from the pickers, shown live so what you get is
    /// never a surprise.
    private var heading: String {
        let name = locationName.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !name.isEmpty else { return "" }
        return "\(locationType.label) \(name) - \(timeOfDay.label)"
    }

    private var canSave: Bool {
        !locationName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Card {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Slug line")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.textTertiary)
                                .textCase(.uppercase)
                                .tracking(0.4)
                            Text(heading.isEmpty ? "INT. LOCATION - DAY" : heading)
                                .font(Font(ScreenplayTextView.screenplayFont(size: 14, bold: true)))
                                .foregroundStyle(heading.isEmpty ? Theme.textTertiary : Theme.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Slug line preview: \(heading.isEmpty ? "not set" : heading)")

                    segmented(
                        label: "Interior / exterior",
                        options: SceneLocationType.allCases,
                        selection: $locationType,
                        title: \.shortLabel
                    )

                    LabelledField(
                        label: "Location",
                        placeholder: "Kitchen, rooftop, car…",
                        text: $locationName,
                        symbol: "mappin",
                        autocapitalisation: .characters,
                        submitLabel: .done
                    ) { save() }
                    .focused($isNameFocused)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Time of day")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.4)

                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 96), spacing: 8)],
                            spacing: 8
                        ) {
                            ForEach(SceneTime.allCases) { option in
                                Button {
                                    Haptics.selectionChanged()
                                    timeOfDay = option
                                } label: {
                                    Text(option.label)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(timeOfDay == option ? .white : Theme.textSecondary)
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.8)
                                        .frame(maxWidth: .infinity)
                                        .frame(minHeight: Theme.minTouchTarget)
                                        .background(
                                            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                                .fill(timeOfDay == option ? Theme.accent : Theme.elevated)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                                .strokeBorder(timeOfDay == option ? .clear : Theme.border, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(timeOfDay == option ? [.isButton, .isSelected] : .isButton)
                            }
                        }
                    }
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("New scene")
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

    private func segmented<T: Identifiable & Hashable & CaseIterable>(
        label: String,
        options: T.AllCases,
        selection: Binding<T>,
        title: KeyPath<T, String>
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .textCase(.uppercase)
                .tracking(0.4)

            HStack(spacing: 6) {
                ForEach(Array(options)) { option in
                    Button {
                        Haptics.selectionChanged()
                        selection.wrappedValue = option
                    } label: {
                        Text(option[keyPath: title])
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selection.wrappedValue == option ? .white : Theme.textSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: Theme.minTouchTarget)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                    .fill(selection.wrappedValue == option ? Theme.accent : Theme.elevated)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                    .strokeBorder(selection.wrappedValue == option ? .clear : Theme.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selection.wrappedValue == option ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }

    private func save() {
        guard canSave else { return }
        isSaving = true
        isNameFocused = false
        Task {
            let created = await onCreate(
                heading,
                locationType,
                locationName.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
                timeOfDay
            )
            isSaving = false
            if created != nil { dismiss() }
        }
    }
}
