import SwiftUI

struct ProjectsView: View {

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model = ProjectsViewModel()

    @State private var isPresentingNewProject = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: Theme.rowSpacing) {
                if !model.projects.isEmpty {
                    StatusFilterRow(
                        selected: $model.statusFilter,
                        counts: model.statusCounts
                    )
                    .padding(.bottom, 2)
                }

                content
            }
            .screenPadding()
            .padding(.top, 4)
            // Clear of the tab bar and the floating add button.
            .padding(.bottom, 96)
        }
        .background(Theme.background)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await model.refresh() }
        .searchable(
            text: $model.searchText,
            placement: .navigationBarDrawer(displayMode: .automatic),
            prompt: "Search projects"
        )
        .navigationTitle("Projects")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    isPresentingNewProject = true
                } label: {
                    Image(systemName: "plus")
                        .font(.body.weight(.semibold))
                        .tappableArea()
                }
                .accessibilityLabel("New project")
            }
        }
        .navigationDestination(for: Project.self) { project in
            ProjectHubView(project: project)
        }
        .sheet(isPresented: $isPresentingNewProject) {
            NewProjectSheet { title, format, logline in
                guard let ownerID = auth.userID else { return nil }
                return await model.create(
                    title: title, format: format, logline: logline, ownerID: ownerID
                )
            }
        }
        .task { await model.loadIfNeeded() }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { model.errorMessage != nil && !model.projects.isEmpty },
                set: { if !$0 { model.errorMessage = nil } }
            ),
            actions: { Button("OK", role: .cancel) { model.errorMessage = nil } },
            message: { Text(model.errorMessage ?? "") }
        )
    }

    @ViewBuilder
    private var content: some View {
        if model.isLoading && model.projects.isEmpty {
            SkeletonList(rows: 4)

        } else if let error = model.errorMessage, model.projects.isEmpty {
            ErrorStateView(message: error) {
                Task { await model.refresh() }
            }
            .padding(.top, 40)

        } else if model.projects.isEmpty {
            EmptyStateView(
                symbol: "film.stack",
                title: "No projects yet",
                message: "Start a feature, a short, or a series. Everything else — scenes, shots, schedule — hangs off it.",
                actionTitle: "New project"
            ) {
                isPresentingNewProject = true
            }
            .padding(.top, 40)

        } else if model.filteredProjects.isEmpty {
            EmptyStateView(
                symbol: "magnifyingglass",
                title: "Nothing matches",
                message: "Try a different search, or clear the status filter."
            )
            .padding(.top, 40)

        } else {
            ForEach(model.filteredProjects) { project in
                NavigationLink(value: project) {
                    ProjectRow(project: project)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    statusMenu(for: project)
                    Divider()
                    Button(role: .destructive) {
                        Task { await model.delete(project) }
                    } label: {
                        Label("Delete project", systemImage: "trash")
                    }
                }
            }
        }
    }

    private func statusMenu(for project: Project) -> some View {
        Menu {
            ForEach(ProjectStatus.allCases) { status in
                Button {
                    Task { await model.setStatus(status, for: project) }
                } label: {
                    Label(status.label, systemImage: status.symbol)
                }
                .disabled(status == project.resolvedStatus)
            }
        } label: {
            Label("Change status", systemImage: "arrow.triangle.2.circlepath")
        }
    }
}

// MARK: - Row

struct ProjectRow: View {
    let project: Project

    private var accent: Color {
        Color(hex: Project.accentPalette[project.accentSeed])
    }

    var body: some View {
        Card {
            HStack(spacing: 12) {
                // Colour spine, so a long list is scannable at a glance.
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(accent)
                    .frame(width: 4)
                    .frame(maxHeight: .infinity)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 6) {
                    Text(project.title)
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(2)

                    if let logline = project.logline?.nonEmpty {
                        Text(logline)
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(2)
                    }

                    HStack(spacing: 6) {
                        Chip(
                            text: project.resolvedStatus.label,
                            symbol: project.resolvedStatus.symbol,
                            tint: project.resolvedStatus.tint
                        )
                        Chip(text: project.resolvedFormat.label, tint: Theme.textTertiary)
                        if let genre = project.genreSummary {
                            Text(genre)
                                .font(.caption)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: 56)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(project.title)
        .accessibilityHint("Opens the project")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Status filter

private struct StatusFilterRow: View {
    @Binding var selected: ProjectStatus?
    let counts: [ProjectStatus: Int]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(title: "All", tint: Theme.textSecondary, isOn: selected == nil) {
                    selected = nil
                }

                ForEach(ProjectStatus.allCases) { status in
                    let count = counts[status] ?? 0
                    if count > 0 {
                        filterChip(
                            title: "\(status.label) \(count)",
                            tint: status.tint,
                            isOn: selected == status
                        ) {
                            selected = selected == status ? nil : status
                        }
                    }
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
        // A horizontal scroller inside a vertical one needs its own clip so the
        // chips don't bleed into the screen padding.
        .scrollClipDisabled(false)
    }

    private func filterChip(
        title: String,
        tint: Color,
        isOn: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            Haptics.selectionChanged()
            action()
        } label: {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(isOn ? tint.readableForeground : Theme.textSecondary)
                .padding(.horizontal, 14)
                .frame(minHeight: 36)
                .background(
                    Capsule().fill(isOn ? tint : Theme.card)
                )
                .overlay(
                    Capsule().strokeBorder(isOn ? .clear : Theme.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}
