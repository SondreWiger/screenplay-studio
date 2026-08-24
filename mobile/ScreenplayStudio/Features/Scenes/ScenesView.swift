import SwiftUI

struct ScenesView: View {

    let projectID: String

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: Router
    @StateObject private var model: ScenesViewModel
    @State private var isPresentingNewScene = false

    init(projectID: String) {
        self.projectID = projectID
        _model = StateObject(wrappedValue: ScenesViewModel(projectID: projectID))
    }

    var body: some View {
        List {
            if !model.scenes.isEmpty {
                Section {
                    summaryStrip
                    filterRow
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 4, leading: Theme.screenPadding, bottom: 4, trailing: Theme.screenPadding))
            }

            Section {
                content
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 4, leading: Theme.screenPadding, bottom: 4, trailing: Theme.screenPadding))
        }
        // `.plain` keeps the rows edge-to-edge so the cards define the shape,
        // rather than sitting inside a second inset container.
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await model.refresh() }
        .searchable(text: $model.searchText, prompt: "Search scenes")
        .navigationTitle("Scenes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    isPresentingNewScene = true
                } label: {
                    Image(systemName: "plus").tappableArea()
                }
                .accessibilityLabel("New scene")
            }
        }
        .navigationDestination(for: ProductionScene.self) { scene in
            SceneDetailView(
                scene: scene,
                characters: model.characters,
                locations: model.locations,
                onChange: { model.apply($0) }
            )
        }
        .sheet(isPresented: $isPresentingNewScene) {
            NewSceneSheet { heading, type, locationName, time in
                await model.create(
                    heading: heading,
                    locationType: type,
                    locationName: locationName,
                    timeOfDay: time,
                    ownerID: auth.userID
                )
            }
        }
        .task {
            await model.loadIfNeeded()
            model.startLiveUpdates()
        }
        .onDisappear { model.stopLiveUpdates() }
    }

    // MARK: - Summary

    private var summaryStrip: some View {
        Card(padding: 12) {
            HStack(spacing: 0) {
                MiniStat(value: "\(model.scenes.count)", label: "Scenes")
                MiniStat(value: "\(model.completedCount)", label: "Shot")
                if model.totalPages > 0 {
                    MiniStat(value: String(format: "%.1f", model.totalPages), label: "Pages")
                }
            }
        }
    }

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ScenesViewModel.Filter.allCases) { option in
                    Button {
                        Haptics.selectionChanged()
                        model.filter = option
                    } label: {
                        Text(option.label)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(model.filter == option ? .white : Theme.textSecondary)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 36)
                            .background(Capsule().fill(model.filter == option ? Theme.accent : Theme.card))
                            .overlay(Capsule().strokeBorder(model.filter == option ? .clear : Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(model.filter == option ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.vertical, 2)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if model.isLoading && model.scenes.isEmpty {
            SkeletonList(rows: 5)

        } else if let error = model.errorMessage, model.scenes.isEmpty {
            ErrorStateView(message: error) { Task { await model.refresh() } }
                .padding(.top, 40)

        } else if model.scenes.isEmpty {
            EmptyStateView(
                symbol: "list.bullet.rectangle",
                title: "No scenes yet",
                message: "Add scenes here, or break them out from the script on the web app.",
                actionTitle: "Add a scene"
            ) { isPresentingNewScene = true }
            .padding(.top, 30)

        } else if model.filteredScenes.isEmpty {
            EmptyStateView(
                symbol: "line.3.horizontal.decrease.circle",
                title: "Nothing here",
                message: "No scenes match this filter."
            )
            .padding(.top, 30)

        } else {
            ForEach(model.filteredScenes) { scene in
                Button {
                    Haptics.tap()
                    router.push(value: scene)
                } label: {
                    SceneRow(
                        scene: scene,
                        castNames: model.characterNames(for: scene),
                        locationName: model.locationName(for: scene),
                        onToggle: { Task { await model.toggleCompleted(scene) } }
                    )
                }
                .buttonStyle(.plain)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        Task { await model.delete(scene) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        Task { await model.toggleCompleted(scene) }
                    } label: {
                        Label(scene.done ? "Not shot" : "Shot", systemImage: scene.done ? "arrow.uturn.backward" : "checkmark")
                    }
                    .tint(scene.done ? Theme.textTertiary : Theme.success)
                }
            }
        }
    }
}

// MARK: - Row

struct SceneRow: View {
    let scene: ProductionScene
    let castNames: [String]
    let locationName: String?
    let onToggle: () -> Void

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                // Tap target for done/not-done sits outside the navigation link's
                // own hit area so the two never fight.
                Button {
                    onToggle()
                } label: {
                    Image(systemName: scene.done ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(scene.done ? Theme.success : Theme.textTertiary)
                        .tappableArea(36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(scene.done ? "Mark as not shot" : "Mark as shot")

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        if let number = scene.sceneNumber?.nonEmpty {
                            Text(number)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.accent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                        }

                        if let time = scene.timeOfDay {
                            Chip(
                                text: time.label,
                                symbol: time.symbol,
                                tint: time.isNight ? Color(hex: 0x8B5CF6) : Theme.warning
                            )
                        }

                        if let eighths = scene.eighthsLabel {
                            Text(eighths)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Theme.textTertiary)
                                .monospacedDigit()
                        }
                    }

                    Text(scene.displayHeading)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(scene.done ? Theme.textTertiary : Theme.textPrimary)
                        .strikethrough(scene.done, color: Theme.textTertiary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    if let synopsis = scene.synopsis?.nonEmpty {
                        Text(synopsis)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    if !castNames.isEmpty || locationName != nil || scene.totalBreakdownItems > 0 {
                        HStack(spacing: 8) {
                            if let locationName {
                                MetaLabel(symbol: "mappin", text: locationName)
                            }
                            if !castNames.isEmpty {
                                MetaLabel(symbol: "person.2", text: castNames.prefix(2).joined(separator: ", ")
                                          + (castNames.count > 2 ? " +\(castNames.count - 2)" : ""))
                            }
                            if scene.totalBreakdownItems > 0 {
                                MetaLabel(symbol: "shippingbox", text: "\(scene.totalBreakdownItems)")
                            }
                        }
                    }
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
                    .padding(.top, 8)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(scene.displayHeading). \(scene.done ? "Shot" : "Not shot")")
    }
}

struct MetaLabel: View {
    let symbol: String
    let text: String

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: symbol)
                .font(.system(size: 9))
            Text(text)
                .font(.caption2)
                .lineLimit(1)
        }
        .foregroundStyle(Theme.textTertiary)
        .accessibilityElement(children: .combine)
    }
}

struct MiniStat: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}
