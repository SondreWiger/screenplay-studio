import SwiftUI

/// Folder browser and document list.
struct DocumentsView: View {

    let projectID: String

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model: DocumentsViewModel

    @State private var currentFolderID: String?
    @State private var isShowingNewDoc = false
    @State private var isShowingNewFolder = false
    @State private var newDocTitle = ""
    @State private var newFolderName = ""
    @State private var searchText = ""
    @State private var selectedDocument: ProjectDocument?

    init(projectID: String) {
        self.projectID = projectID
        _model = StateObject(wrappedValue: DocumentsViewModel(projectID: projectID))
    }

    private var visibleFolders: [ProjectFolder] {
        model.subfolders(of: currentFolderID)
    }

    private var visibleDocuments: [ProjectDocument] {
        let docs = model.documents(in: currentFolderID)
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return docs }
        return docs.filter {
            $0.title.lowercased().contains(term)
            || ($0.content?.lowercased().contains(term) ?? false)
        }
    }

    private var currentFolderName: String {
        if let id = currentFolderID {
            return model.folders.first { $0.id == id }?.name ?? "Folder"
        }
        return "Documents"
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: Theme.rowSpacing) {
                // Pinned documents at root level
                if currentFolderID == nil, !model.pinnedDocuments.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Pinned")
                        ForEach(model.pinnedDocuments) { doc in
                            documentRow(doc)
                        }
                    }
                    .padding(.bottom, 8)
                }

                // Folders
                if !visibleFolders.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Folders")
                        ForEach(visibleFolders) { folder in
                            folderRow(folder)
                        }
                    }
                    .padding(.bottom, 4)
                }

                // Documents
                if !visibleDocuments.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        if !visibleFolders.isEmpty || (currentFolderID == nil && !model.pinnedDocuments.isEmpty) {
                            SectionHeader(title: currentFolderID == nil ? "All Documents" : "Documents")
                        }
                        ForEach(visibleDocuments) { doc in
                            documentRow(doc)
                        }
                    }
                }

                if model.isLoading {
                    SkeletonList(rows: 4)
                } else if visibleDocuments.isEmpty && visibleFolders.isEmpty {
                    EmptyStateView(
                        symbol: "doc.text",
                        title: "No documents yet",
                        message: "Create your first document — treatments, notes, outlines, and more.",
                        actionTitle: "New Document"
                    ) {
                        isShowingNewDoc = true
                    }
                    .padding(.top, 30)
                }
            }
            .screenPadding()
            .padding(.vertical, 8)
        }
        .background(Theme.background)
        .searchable(text: $searchText, prompt: "Search documents")
        .refreshable { await model.refresh() }
        .navigationTitle(currentFolderName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        isShowingNewDoc = true
                    } label: {
                        Label("New Document", systemImage: "doc.badge.plus")
                    }

                    Button {
                        isShowingNewFolder = true
                    } label: {
                        Label("New Folder", systemImage: "folder.badge.plus")
                    }
                } label: {
                    Image(systemName: "plus").tappableArea()
                }
                .accessibilityLabel("New")
            }

            if currentFolderID != nil {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Haptics.tap()
                        currentFolderID = nil
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
            }
        }
        .sheet(isPresented: $isShowingNewDoc) {
            newDocumentSheet
        }
        .sheet(isPresented: $isShowingNewFolder) {
            newFolderSheet
        }
        .sheet(item: $selectedDocument) { doc in
            DocumentEditorView(
                document: doc,
                projectID: projectID,
                viewModel: model
            )
        }
        .task { await model.loadIfNeeded() }
    }

    // MARK: - Rows

    private func documentRow(_ doc: ProjectDocument) -> some View {
        Button {
            Haptics.tap()
            selectedDocument = doc
        } label: {
            Card(padding: 12) {
                HStack(spacing: 12) {
                    Image(systemName: doc.typeSymbol)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 38, height: 38)
                        .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(doc.resolvedTitle)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                            .lineLimit(1)

                        HStack(spacing: 6) {
                            Text(doc.typeLabel)
                                .font(.caption2)
                                .foregroundStyle(Theme.textTertiary)

                            if doc.wordCount > 0 {
                                Text("·")
                                    .foregroundStyle(Theme.textTertiary)
                                Text("\(doc.wordCount) words")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textTertiary)
                            }

                            if let updated = doc.updatedAt {
                                Text("·")
                                    .foregroundStyle(Theme.textTertiary)
                                Text(Self.relative(updated))
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textTertiary)
                            }
                        }
                    }

                    Spacer(minLength: 0)

                    if doc.isPinned == true {
                        Image(systemName: "pin.fill")
                            .font(.caption)
                            .foregroundStyle(Theme.warning)
                    }

                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.textTertiary)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive) {
                Task { await model.deleteDocument(id: doc.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(doc.resolvedTitle), \(doc.typeLabel)")
    }

    private func folderRow(_ folder: ProjectFolder) -> some View {
        Button {
            Haptics.tap()
            currentFolderID = folder.id
        } label: {
            Card(padding: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "folder.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color(hex: 0xFBBF24))
                        .frame(width: 38, height: 38)
                        .background(Color(hex: 0xFBBF24).opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(folder.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)

                        let count = model.documents(in: folder.id).count
                        Text("\(count) document\(count == 1 ? "" : "s")")
                            .font(.caption2)
                            .foregroundStyle(Theme.textTertiary)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.textTertiary)
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive) {
                Task { await model.deleteFolder(id: folder.id) }
            } label: {
                Label("Delete Folder", systemImage: "trash")
            }
        }
    }

    // MARK: - Sheets

    private var newDocumentSheet: some View {
        NavigationStack {
            Form {
                Section {
                    LabelledField(label: "Title", placeholder: "e.g. Production Notes", text: $newDocTitle, symbol: "doc.text")
                }
                .listRowBackground(Theme.elevated)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Document")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        isShowingNewDoc = false
                        newDocTitle = ""
                    }
                    .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        Haptics.tap()
                        let title = newDocTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !title.isEmpty else { return }
                        Task {
                            let doc = await model.createDocument(
                                title: title,
                                type: nil,
                                folderID: currentFolderID,
                                ownerID: auth.userID
                            )
                            isShowingNewDoc = false
                            newDocTitle = ""
                            if let doc { selectedDocument = doc }
                        }
                    }
                    .fontWeight(.semibold)
                    .disabled(newDocTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.height(240)])
        .presentationDragIndicator(.visible)
    }

    private var newFolderSheet: some View {
        NavigationStack {
            Form {
                Section {
                    LabelledField(label: "Folder Name", placeholder: "e.g. Research", text: $newFolderName, symbol: "folder")
                }
                .listRowBackground(Theme.elevated)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        isShowingNewFolder = false
                        newFolderName = ""
                    }
                    .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        Haptics.tap()
                        let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !name.isEmpty else { return }
                        Task {
                            _ = await model.createFolder(
                                name: name,
                                parentID: currentFolderID,
                                ownerID: auth.userID
                            )
                            isShowingNewFolder = false
                            newFolderName = ""
                        }
                    }
                    .fontWeight(.semibold)
                    .disabled(newFolderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.height(240)])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Helpers

    private static func relative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
