import SwiftUI

@MainActor
final class CharactersViewModel: ObservableObject {

    @Published private(set) var characters: [ProjectCharacter] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var leadsOnly = false

    private let projectID: String
    private var hasLoaded = false
    private var liveTask: Task<Void, Never>?

    init(projectID: String) {
        self.projectID = projectID
    }

    deinit { liveTask?.cancel() }

    /// Needs `characters` in the realtime publication — see
    /// `supabase/migration_realtime_mobile.sql`.
    func startLiveUpdates() {
        guard liveTask == nil else { return }
        liveTask = Task { [weak self, projectID] in
            let stream = await RealtimeClient.shared.changes(
                table: "characters", filter: "project_id=eq.\(projectID)"
            )
            for await change in stream {
                guard let self else { return }
                await self.applyLive(change)
            }
        }
    }

    func stopLiveUpdates() {
        liveTask?.cancel()
        liveTask = nil
    }

    private func applyLive(_ change: RealtimeChange) {
        let changed = LiveMerge.apply(change, to: &characters) { a, b in
            (a.sortOrder ?? 0) < (b.sortOrder ?? 0)
        }
        guard changed else { return }
        Task { await LocalCache.shared.save(characters, for: LocalCache.Key.characters(projectID)) }
    }

    var filtered: [ProjectCharacter] {
        var result = characters
        if leadsOnly { result = result.filter(\.lead) }

        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !term.isEmpty {
            result = result.filter {
                $0.name.lowercased().contains(term)
                    || ($0.description?.lowercased().contains(term) ?? false)
                    || ($0.castActor?.lowercased().contains(term) ?? false)
            }
        }
        // Leads first, then alphabetical — the order a cast list is read in.
        return result.sorted {
            if $0.lead != $1.lead { return $0.lead }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    var leadCount: Int { characters.filter(\.lead).count }
    var castCount: Int { characters.filter(\.isCast).count }

    func loadIfNeeded() async {
        guard !hasLoaded else {
            await refresh()
            return
        }
        hasLoaded = true

        if let cached = await LocalCache.shared.load(
            [ProjectCharacter].self, for: LocalCache.Key.characters(projectID)
        ) {
            characters = cached
        } else {
            isLoading = true
        }
        await refresh()
        isLoading = false
    }

    func refresh() async {
        do {
            let fetched = try await ProductionService.fetchCharacters(projectID: projectID)
            characters = fetched
            errorMessage = nil
            await LocalCache.shared.save(fetched, for: LocalCache.Key.characters(projectID))
        } catch is CancellationError {
        } catch {
            if characters.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    func create(name: String, description: String?, isMain: Bool, ownerID: String?) async -> ProjectCharacter? {
        // Cycle the palette so a new cast doesn't come out all one colour.
        let colours = ["#FF5F1F", "#8B5CF6", "#06B6D4", "#22C55E", "#EC4899", "#F59E0B", "#3B82F6"]
        let colour = colours[characters.count % colours.count]

        do {
            let created = try await ProductionService.createCharacter(
                projectID: projectID,
                name: name.uppercased(),
                description: description,
                isMain: isMain,
                color: colour,
                sortOrder: characters.count,
                ownerID: ownerID
            )
            if let created {
                characters.append(created)
                await LocalCache.shared.save(characters, for: LocalCache.Key.characters(projectID))
                Haptics.success()
            }
            return created
        } catch {
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
            return nil
        }
    }

    func toggleLead(_ character: ProjectCharacter) async {
        guard let index = characters.firstIndex(where: { $0.id == character.id }) else { return }
        let newValue = !character.lead
        characters[index].isMain = newValue
        Haptics.tap()

        do {
            try await ProductionService.updateCharacterFields(
                id: character.id, fields: ["is_main": .bool(newValue)]
            )
            await LocalCache.shared.save(characters, for: LocalCache.Key.characters(projectID))
        } catch {
            characters[index].isMain = character.isMain
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    func setCastActor(_ actor: String?, for character: ProjectCharacter) async {
        guard let index = characters.firstIndex(where: { $0.id == character.id }) else { return }
        let previous = characters[index].castActor
        characters[index].castActor = actor
        do {
            try await ProductionService.updateCharacterFields(
                id: character.id,
                fields: ["cast_actor": actor.map { JSONValue.string($0) } ?? .null]
            )
            await LocalCache.shared.save(characters, for: LocalCache.Key.characters(projectID))
            Haptics.success()
        } catch {
            characters[index].castActor = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    func delete(_ character: ProjectCharacter) async {
        let previous = characters
        characters.removeAll { $0.id == character.id }
        do {
            try await ProductionService.deleteCharacter(id: character.id)
            await LocalCache.shared.save(characters, for: LocalCache.Key.characters(projectID))
            Haptics.success()
        } catch {
            characters = previous
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }
}

struct CharactersView: View {

    let projectID: String

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model: CharactersViewModel

    @State private var isPresentingNew = false
    @State private var castingTarget: ProjectCharacter?

    init(projectID: String) {
        self.projectID = projectID
        _model = StateObject(wrappedValue: CharactersViewModel(projectID: projectID))
    }

    var body: some View {
        List {
            if !model.characters.isEmpty {
                Section {
                    Card(padding: 12) {
                        HStack(spacing: 0) {
                            MiniStat(value: "\(model.characters.count)", label: "Characters")
                            MiniStat(value: "\(model.leadCount)", label: "Leads")
                            MiniStat(value: "\(model.castCount)", label: "Cast")
                        }
                    }

                    Toggle(isOn: $model.leadsOnly) {
                        Text("Leads only")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .tint(Theme.accent)
                    .frame(minHeight: Theme.minTouchTarget)
                    .onChange(of: model.leadsOnly) { _, _ in Haptics.selectionChanged() }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(rowInsets)
            }

            Section {
                content
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(rowInsets)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await model.refresh() }
        .searchable(text: $model.searchText, prompt: "Search characters")
        .navigationTitle("Characters")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    isPresentingNew = true
                } label: {
                    Image(systemName: "plus").tappableArea()
                }
                .accessibilityLabel("New character")
            }
        }
        .sheet(isPresented: $isPresentingNew) {
            NewCharacterSheet { name, description, isMain in
                await model.create(
                    name: name, description: description, isMain: isMain, ownerID: auth.userID
                )
            }
        }
        .sheet(item: $castingTarget) { character in
            CastingSheet(character: character) { actor in
                await model.setCastActor(actor, for: character)
            }
        }
        .task {
            await model.loadIfNeeded()
            model.startLiveUpdates()
        }
        .onDisappear { model.stopLiveUpdates() }
    }

    private var rowInsets: EdgeInsets {
        EdgeInsets(top: 4, leading: Theme.screenPadding, bottom: 4, trailing: Theme.screenPadding)
    }

    @ViewBuilder
    private var content: some View {
        if model.isLoading && model.characters.isEmpty {
            SkeletonList(rows: 4)
        } else if let error = model.errorMessage, model.characters.isEmpty {
            ErrorStateView(message: error) { Task { await model.refresh() } }
                .padding(.top, 40)
        } else if model.characters.isEmpty {
            EmptyStateView(
                symbol: "person.2",
                title: "No characters yet",
                message: "Add the people in your story. Names you add here show up as suggestions in the script editor.",
                actionTitle: "Add a character"
            ) { isPresentingNew = true }
            .padding(.top, 30)
        } else if model.filtered.isEmpty {
            EmptyStateView(
                symbol: "magnifyingglass",
                title: "Nothing matches",
                message: "Try a different search, or turn off the leads filter."
            )
            .padding(.top, 30)
        } else {
            ForEach(model.filtered) { character in
                CharacterRow(character: character) {
                    Task { await model.toggleLead(character) }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        Task { await model.delete(character) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        Haptics.tap()
                        castingTarget = character
                    } label: {
                        Label("Cast", systemImage: "person.crop.circle.badge.checkmark")
                    }
                    .tint(Theme.accent)
                }
            }
        }
    }
}

// MARK: - Row

struct CharacterRow: View {
    let character: ProjectCharacter
    let onToggleLead: () -> Void

    private var tint: Color { Color(webHex: character.color) }

    var body: some View {
        Card {
            HStack(spacing: 12) {
                Text(character.initials)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(tint.readableForeground)
                    .frame(width: 42, height: 42)
                    .background(tint, in: Circle())
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(character.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                            .lineLimit(1)

                        if character.lead {
                            Chip(text: "Lead", symbol: "star.fill", tint: Theme.warning)
                        }
                    }

                    if let subtitle = character.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }

                Spacer(minLength: 0)

                Button(action: onToggleLead) {
                    Image(systemName: character.lead ? "star.fill" : "star")
                        .font(.body)
                        .foregroundStyle(character.lead ? Theme.warning : Theme.textTertiary)
                        .tappableArea(38)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(character.lead ? "Remove lead status" : "Mark as a lead")
            }
        }
        .accessibilityElement(children: .contain)
    }
}
