import SwiftUI

struct NewEventSheet: View {

    let onCreate: (String, ScheduleEventType, Date, Date, Bool, String?) async -> ScheduleEvent?

    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var type: ScheduleEventType = .shooting
    @State private var start = NewEventSheet.defaultStart()
    @State private var end = NewEventSheet.defaultStart().addingTimeInterval(8 * 3600)
    @State private var allDay = false
    @State private var notes = ""
    @State private var isSaving = false
    @FocusState private var isTitleFocused: Bool

    /// Next sensible slot: tomorrow at 8am, the standard crew call.
    private static func defaultStart() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return calendar.date(bySettingHour: 8, minute: 0, second: 0, of: tomorrow) ?? tomorrow
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving && end > start
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    LabelledField(
                        label: "Title",
                        placeholder: "Day 1 — interiors",
                        text: $title,
                        symbol: "textformat",
                        autocapitalisation: .sentences,
                        submitLabel: .done
                    ) { isTitleFocused = false }
                    .focused($isTitleFocused)

                    VStack(alignment: .leading, spacing: 8) {
                        fieldLabel("Type")
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 106), spacing: 8)],
                            spacing: 8
                        ) {
                            ForEach(ScheduleEventType.allCases) { option in
                                Button {
                                    Haptics.selectionChanged()
                                    type = option
                                } label: {
                                    HStack(spacing: 5) {
                                        Image(systemName: option.symbol)
                                            .font(.caption2)
                                        Text(option.label)
                                            .font(.caption.weight(.semibold))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.85)
                                    }
                                    .foregroundStyle(type == option ? .white : Theme.textSecondary)
                                    .frame(maxWidth: .infinity)
                                    .frame(minHeight: Theme.minTouchTarget)
                                    .background(
                                        RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                            .fill(type == option ? option.tint : Theme.elevated)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                            .strokeBorder(type == option ? .clear : Theme.border, lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(option.label)
                                .accessibilityAddTraits(type == option ? [.isButton, .isSelected] : .isButton)
                            }
                        }
                    }

                    Card {
                        VStack(spacing: 4) {
                            Toggle(isOn: $allDay) {
                                Text("All day")
                                    .font(.body)
                                    .foregroundStyle(Theme.textPrimary)
                            }
                            .tint(Theme.accent)
                            .frame(minHeight: Theme.minTouchTarget)
                            .onChange(of: allDay) { _, _ in Haptics.selectionChanged() }

                            Divider().overlay(Theme.border)

                            DatePicker(
                                "Starts",
                                selection: $start,
                                displayedComponents: allDay ? [.date] : [.date, .hourAndMinute]
                            )
                            .datePickerStyle(.compact)
                            .tint(Theme.accent)
                            .frame(minHeight: Theme.minTouchTarget)
                            .onChange(of: start) { _, newValue in
                                // Keep the window valid without arguing with the user.
                                if end <= newValue {
                                    end = newValue.addingTimeInterval(8 * 3600)
                                }
                            }

                            Divider().overlay(Theme.border)

                            DatePicker(
                                "Ends",
                                selection: $end,
                                in: start...,
                                displayedComponents: allDay ? [.date] : [.date, .hourAndMinute]
                            )
                            .datePickerStyle(.compact)
                            .tint(Theme.accent)
                            .frame(minHeight: Theme.minTouchTarget)
                        }
                        .foregroundStyle(Theme.textPrimary)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        fieldLabel("Notes")
                        TextEditor(text: $notes)
                            .font(.body)
                            .foregroundStyle(Theme.textPrimary)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 80)
                            .padding(10)
                            .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                    .strokeBorder(Theme.border, lineWidth: 1)
                            )
                            .accessibilityLabel("Event notes")
                    }
                }
                .screenPadding()
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("New event")
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
            .onAppear { isTitleFocused = true }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.textTertiary)
            .textCase(.uppercase)
            .tracking(0.4)
    }

    private func save() {
        guard canSave else { return }
        isSaving = true
        isTitleFocused = false

        // An all-day event spans the whole calendar day, not the picked instant.
        let calendar = Calendar.current
        let resolvedStart = allDay ? calendar.startOfDay(for: start) : start
        let resolvedEnd: Date = {
            guard allDay else { return end }
            let dayStart = calendar.startOfDay(for: end)
            return calendar.date(byAdding: .day, value: 1, to: dayStart)?
                .addingTimeInterval(-1) ?? end
        }()

        Task {
            let created = await onCreate(
                title.trimmingCharacters(in: .whitespacesAndNewlines),
                type,
                resolvedStart,
                resolvedEnd,
                allDay,
                notes.nonEmpty
            )
            isSaving = false
            if created != nil { dismiss() }
        }
    }
}
