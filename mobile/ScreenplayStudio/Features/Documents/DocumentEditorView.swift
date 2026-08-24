import SwiftUI

/// Full-screen document editor with autosave.
struct DocumentEditorView: View {

    let document: ProjectDocument
    let projectID: String
    @ObservedObject var viewModel: DocumentsViewModel

    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var content: String = ""
    @State private var title: String = ""
    @State private var saveState: SaveState = .idle
    @State private var isEditingTitle = false
    @FocusState private var isContentFocused: Bool

    private var flushTask: Task<Void, Never>?

    enum SaveState {
        case idle, pending, saving, saved(Date), failed
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Document title
                titleBar

                Divider().overlay(Theme.border)

                // Word count bar
                wordCountBar

                // Editor
                TextEditor(text: $content)
                    .scrollContentBackground(.hidden)
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
                    .tint(Theme.accent)
                    .focused($isContentFocused)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.footnote.weight(.semibold))
                            Text("Documents")
                                .font(.subheadline)
                        }
                        .foregroundStyle(Theme.accent)
                    }
                }

                ToolbarItem(placement: .principal) {
                    VStack(spacing: 1) {
                        Text(title.isEmpty ? "Untitled" : title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                            .lineLimit(1)
                        saveStatusLabel
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            isEditingTitle = true
                        } label: {
                            Label("Rename", systemImage: "pencil")
                        }

                        Button {
                            isContentFocused = false
                        } label: {
                            Label("Done editing", systemImage: "keyboard.chevron.compact.down")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").tappableArea()
                    }
                }
            }
            .alert("Rename Document", isPresented: $isEditingTitle) {
                TextField("Title", text: $title)
                Button("Save") {
                    Task {
                        await viewModel.renameDocument(id: document.id, title: title)
                    }
                }
                Button("Cancel", role: .cancel) {
                    title = document.title
                }
            }
            .onAppear {
                content = document.content ?? ""
                title = document.title
            }
            .onChange(of: content) { _, newValue in
                scheduleSave(newValue)
            }
            .onDisappear {
                // Flush immediately on leave.
                let finalContent = content
                let docID = document.id
                let userID = auth.userID
                Task {
                    await viewModel.saveContent(id: docID, content: finalContent, editedBy: userID)
                }
            }
        }
    }

    // MARK: - Title bar

    private var titleBar: some View {
        HStack(spacing: 12) {
            Image(systemName: document.typeSymbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 34, height: 34)
                .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(title.isEmpty ? "Untitled" : title)
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Text(document.typeLabel)
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Theme.card)
    }

    // MARK: - Word count

    private var wordCountBar: some View {
        HStack {
            let words = content.split(whereSeparator: \.isWhitespace).count
            let chars = content.count
            Text("\(words) words · \(chars) characters")
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(Theme.elevated.opacity(0.5))
    }

    // MARK: - Save status

    @ViewBuilder
    private var saveStatusLabel: some View {
        switch saveState {
        case .idle:
            EmptyView()
        case .pending:
            statusLabel("Unsaved", symbol: "circle.dotted", tint: Theme.textTertiary)
        case .saving:
            statusLabel("Saving…", symbol: "arrow.triangle.2.circlepath", tint: Theme.textTertiary)
        case .saved(let date):
            statusLabel("Saved \(Self.relative(date))", symbol: "checkmark.circle", tint: Theme.textTertiary)
        case .failed:
            statusLabel("Save failed", symbol: "exclamationmark.triangle", tint: Theme.danger)
        }
    }

    private func statusLabel(_ text: String, symbol: String, tint: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: symbol).font(.system(size: 9))
            Text(text).font(.caption2)
        }
        .foregroundStyle(tint)
    }

    // MARK: - Autosave

    @State private var pendingSaveTask: Task<Void, Never>?

    private func scheduleSave(_ newContent: String) {
        saveState = .pending
        pendingSaveTask?.cancel()
        pendingSaveTask = Task {
            try? await Task.sleep(for: .milliseconds(1200))
            guard !Task.isCancelled else { return }
            saveState = .saving
            await viewModel.saveContent(id: document.id, content: newContent, editedBy: auth.userID)
            if viewModel.errorMessage != nil {
                saveState = .failed
            } else {
                saveState = .saved(Date())
            }
        }
    }

    private static func relative(_ date: Date) -> String {
        let seconds = Date().timeIntervalSince(date)
        if seconds < 5 { return "just now" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
