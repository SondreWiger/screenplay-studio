import SwiftUI

struct ShotsView: View {

    let projectID: String

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model: ShotsViewModel
    @State private var isPresentingNewShot = false

    init(projectID: String) {
        self.projectID = projectID
        _model = StateObject(wrappedValue: ShotsViewModel(projectID: projectID))
    }

    var body: some View {
        List {
            if !model.shots.isEmpty {
                Section {
                    summaryStrip
                    controlRow
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(rowInsets)
            }

            if model.shots.isEmpty {
                Section {
                    emptyContent
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(rowInsets)
            } else {
                ForEach(Array(model.groupedShots.enumerated()), id: \.offset) { _, section in
                    Section {
                        ForEach(section.shots) { shot in
                            ShotRow(
                                shot: shot,
                                onToggle: { Task { await model.toggleCompleted(shot) } },
                                onAddTake: { Task { await model.addTake(to: shot) } }
                            )
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .listRowInsets(rowInsets)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task { await model.delete(shot) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    Task { await model.toggleCompleted(shot) }
                                } label: {
                                    Label(shot.done ? "Reopen" : "Done",
                                          systemImage: shot.done ? "arrow.uturn.backward" : "checkmark")
                                }
                                .tint(shot.done ? Theme.textTertiary : Theme.success)
                            }
                        }
                    } header: {
                        if let scene = section.scene {
                            sceneHeader(scene, count: section.shots.count)
                        } else if model.grouping == .scene {
                            sceneHeader(nil, count: section.shots.count)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await model.refresh() }
        .searchable(text: $model.searchText, prompt: "Search shots")
        .navigationTitle("Shot list")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    isPresentingNewShot = true
                } label: {
                    Image(systemName: "plus").tappableArea()
                }
                .accessibilityLabel("New shot")
            }
        }
        .sheet(isPresented: $isPresentingNewShot) {
            NewShotSheet(
                scenes: model.scenes,
                suggestedNumber: { model.suggestedShotNumber(for: $0) }
            ) { sceneID, number, type, movement, description, lens in
                await model.create(
                    sceneID: sceneID,
                    shotNumber: number,
                    type: type,
                    movement: movement,
                    description: description,
                    lens: lens,
                    ownerID: auth.userID
                )
            }
        }
        .task { await model.loadIfNeeded() }
    }

    private var rowInsets: EdgeInsets {
        EdgeInsets(top: 4, leading: Theme.screenPadding, bottom: 4, trailing: Theme.screenPadding)
    }

    // MARK: - Header pieces

    private var summaryStrip: some View {
        Card(padding: 12) {
            HStack(spacing: 0) {
                MiniStat(value: "\(model.shots.count)", label: "Shots")
                MiniStat(value: "\(model.completedCount)", label: "Covered")
                if let duration = model.durationLabel {
                    MiniStat(value: duration, label: "Screen time")
                }
            }
        }
    }

    private var controlRow: some View {
        HStack(spacing: 8) {
            Picker("Grouping", selection: $model.grouping) {
                ForEach(ShotsViewModel.Grouping.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: model.grouping) { _, _ in Haptics.selectionChanged() }

            Button {
                Haptics.selectionChanged()
                model.hideCompleted.toggle()
            } label: {
                Image(systemName: model.hideCompleted ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                    .font(.body)
                    .foregroundStyle(model.hideCompleted ? Theme.accent : Theme.textSecondary)
                    .tappableArea(38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(model.hideCompleted ? "Show covered shots" : "Hide covered shots")
        }
    }

    private func sceneHeader(_ scene: ProductionScene?, count: Int) -> some View {
        HStack(spacing: 6) {
            Text(scene?.displayHeading ?? "Not assigned to a scene")
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text("\(count)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
                .monospacedDigit()
        }
        .padding(.horizontal, Theme.screenPadding)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.background)
        .listRowInsets(EdgeInsets())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var emptyContent: some View {
        if model.isLoading {
            SkeletonList(rows: 4)
        } else if let error = model.errorMessage {
            ErrorStateView(message: error) { Task { await model.refresh() } }
                .padding(.top, 40)
        } else {
            EmptyStateView(
                symbol: "camera",
                title: "No shots yet",
                message: "Plan your coverage shot by shot. Tick them off as you get them in the can.",
                actionTitle: "Add a shot"
            ) { isPresentingNewShot = true }
            .padding(.top, 30)
        }
    }
}

// MARK: - Row

struct ShotRow: View {
    let shot: Shot
    let onToggle: () -> Void
    let onAddTake: () -> Void

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                Button(action: onToggle) {
                    Image(systemName: shot.done ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(shot.done ? Theme.success : Theme.textTertiary)
                        .tappableArea(36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(shot.done ? "Mark shot as not covered" : "Mark shot as covered")

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text(shot.displayNumber)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.accent)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 5, style: .continuous))

                        if let type = shot.shotType {
                            Chip(text: type.abbreviation, tint: Color(hex: 0x06B6D4))
                        }
                        if shot.needsVFX {
                            Chip(text: "VFX", symbol: "wand.and.stars", tint: Color(hex: 0x8B5CF6))
                        }
                    }

                    if let description = shot.description?.nonEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(shot.done ? Theme.textTertiary : Theme.textPrimary)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }

                    let tech = shot.techSummary
                    if !tech.isEmpty {
                        Text(tech)
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                            .lineLimit(1)
                    }

                    HStack(spacing: 10) {
                        if let takes = shot.takesLabel {
                            MetaLabel(symbol: "film", text: takes)
                        }
                        if let duration = shot.durationLabel {
                            MetaLabel(symbol: "clock", text: duration)
                        }
                    }
                }

                Spacer(minLength: 0)

                // A big, obvious "+1 take" — the action you take with cold hands
                // while looking at the monitor, not the phone.
                Button(action: onAddTake) {
                    VStack(spacing: 1) {
                        Image(systemName: "plus")
                            .font(.caption.weight(.bold))
                        Text("take")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 44, height: 44)
                    .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Log another take")
            }
        }
        .accessibilityElement(children: .contain)
    }
}
