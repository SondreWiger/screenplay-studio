import SwiftUI

/// Edits one breakdown list — props, costumes, vehicles and so on.
///
/// Built around a single always-focused input at the top: on a phone the fast
/// path is type-return-type-return, and nothing should require a second tap
/// between items.
struct ListEditorSheet: View {

    let title: String
    let symbol: String
    let tint: Color
    let initialItems: [String]
    let onSave: ([String]) async -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var items: [String]
    @State private var draft = ""
    @State private var isSaving = false
    @FocusState private var isInputFocused: Bool

    init(
        title: String,
        symbol: String,
        tint: Color,
        items: [String],
        onSave: @escaping ([String]) async -> Void
    ) {
        self.title = title
        self.symbol = symbol
        self.tint = tint
        self.initialItems = items
        self.onSave = onSave
        _items = State(initialValue: items)
    }

    private var hasChanges: Bool { items != initialItems }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                inputBar

                if items.isEmpty {
                    EmptyStateView(
                        symbol: symbol,
                        title: "Nothing listed",
                        message: "Type an item above and press return. Add as many as you need."
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    List {
                        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                            HStack(spacing: 10) {
                                Image(systemName: symbol)
                                    .font(.caption)
                                    .foregroundStyle(tint)
                                    .frame(width: 22)
                                    .accessibilityHidden(true)

                                Text(item)
                                    .font(.body)
                                    .foregroundStyle(Theme.textPrimary)

                                Spacer(minLength: 0)
                            }
                            .frame(minHeight: Theme.minTouchTarget - 8)
                            .listRowBackground(Theme.card)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    remove(at: index)
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
                        .onMove { source, destination in
                            items.move(fromOffsets: source, toOffset: destination)
                            Haptics.tap()
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .environment(\.editMode, .constant(.active))
                }
            }
            .background(Theme.background)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        commit()
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
            .onAppear { isInputFocused = true }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.body)
                .foregroundStyle(tint)
                .frame(width: 22)
                .accessibilityHidden(true)

            TextField("Add \(title.lowercased())", text: $draft)
                .font(.body)
                .foregroundStyle(Theme.textPrimary)
                .submitLabel(.next)
                .focused($isInputFocused)
                .onSubmit { addDraft() }
                .accessibilityLabel("New \(title.lowercased()) item")

            if !draft.isEmpty {
                Button {
                    addDraft()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(tint)
                        .tappableArea(36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add item")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: Theme.minTouchTarget + 8)
        .background(Theme.elevated)
        .overlay(alignment: .bottom) {
            Divider().overlay(Theme.border)
        }
    }

    private func addDraft() {
        let value = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        // Don't add the same thing twice — a duplicated prop is a breakdown bug.
        guard !items.contains(where: { $0.caseInsensitiveCompare(value) == .orderedSame }) else {
            draft = ""
            Haptics.warning()
            return
        }
        items.append(value)
        draft = ""
        Haptics.tap()
        isInputFocused = true
    }

    private func remove(at index: Int) {
        guard items.indices.contains(index) else { return }
        items.remove(at: index)
        Haptics.tap()
    }

    private func commit() {
        // A half-typed item shouldn't be lost just because Save was tapped first.
        addDraft()
        guard hasChanges else {
            dismiss()
            return
        }
        isSaving = true
        Task {
            await onSave(items)
            isSaving = false
            dismiss()
        }
    }
}
