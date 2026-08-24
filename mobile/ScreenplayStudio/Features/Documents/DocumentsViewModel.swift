import SwiftUI

/// State for the documents browser.
@MainActor
final class DocumentsViewModel: ObservableObject {

    let projectID: String

    @Published private(set) var documents: [ProjectDocument] = []
    @Published private(set) var folders: [ProjectFolder] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private var hasLoaded = false

    init(projectID: String) {
        self.projectID = projectID
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        isLoading = true
        await refresh()
        isLoading = false
    }

    func refresh() async {
        do {
            async let docs = ProductionService.fetchDocuments(projectID: projectID)
            async let flds = ProductionService.fetchFolders(projectID: projectID)
            documents = try await docs
            folders = try await flds
            errorMessage = nil
        } catch is CancellationError {
            // Left the screen.
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Derived

    func documents(in folderID: String?) -> [ProjectDocument] {
        documents.filter { $0.folderID == folderID }
    }

    func subfolders(of parentID: String?) -> [ProjectFolder] {
        folders.filter { $0.parentID == parentID }
    }

    var pinnedDocuments: [ProjectDocument] {
        documents.filter { $0.isPinned == true }
    }

    var documentCount: Int { documents.count }

    // MARK: - CRUD

    func createDocument(title: String, type: String?, folderID: String?, ownerID: String?) async -> ProjectDocument? {
        do {
            let doc = try await ProductionService.createDocument(NewDocument(
                projectID: projectID,
                title: title,
                content: nil,
                documentType: type,
                folderID: folderID,
                createdBy: ownerID
            ))
            if let doc {
                documents.insert(doc, at: 0)
            }
            return doc
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func createFolder(name: String, parentID: String?, ownerID: String?) async -> ProjectFolder? {
        do {
            let folder = try await ProductionService.createFolder(NewFolder(
                projectID: projectID,
                name: name,
                parentID: parentID,
                createdBy: ownerID
            ))
            if let folder {
                folders.append(folder)
            }
            return folder
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func deleteDocument(id: String) async {
        do {
            try await ProductionService.deleteDocument(id: id)
            documents.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteFolder(id: String) async {
        do {
            try await ProductionService.deleteFolder(id: id)
            folders.removeAll { $0.id == id }
            // Docs in the deleted folder stay in the project but lose their folder.
            for i in documents.indices where documents[i].folderID == id {
                documents[i].folderID = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveContent(id: String, content: String, editedBy: String?) async {
        do {
            try await ProductionService.updateDocumentContent(id: id, content: content, editedBy: editedBy)
            if let idx = documents.firstIndex(where: { $0.id == id }) {
                documents[idx].content = content
                documents[idx].updatedAt = Date()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func renameDocument(id: String, title: String) async {
        do {
            try await ProductionService.updateDocumentTitle(id: id, title: title)
            if let idx = documents.firstIndex(where: { $0.id == id }) {
                documents[idx].title = title
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
