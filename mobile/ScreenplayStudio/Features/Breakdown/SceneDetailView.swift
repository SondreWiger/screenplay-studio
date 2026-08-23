import SwiftUI

/// Scene detail and breakdown.
///
/// This is the screen most likely to be used standing on a set holding a phone
/// in one hand, so every list is editable in place: tap a category, type, done.
/// No modal chain, no "edit" mode.
struct SceneDetailView: View {

    @State private var scene: ProductionScene
    let characters: [ProjectCharacter]
    let locations: [ProductionLocation]
    let onChange: (ProductionScene) -> Void

    @EnvironmentObject private var network: NetworkMonitor
    @State private var editingCategory: BreakdownCategory?
    @State private var isEditingSynopsis = false
    @State private var synopsisDraft = ""
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(
        scene: ProductionScene,
        characters: [ProjectCharacter],
        locations: [ProductionLocation],
        onChange: @escaping (ProductionScene) -> Void
    ) {
        _scene = State(initialValue: scene)
        self.characters = characters
        self.locations = locations
        self.onChange = onChange
    }

    /// Every editable breakdown list, with the column it maps to.
    enum BreakdownCategory: String, CaseIterable, Identifiable {
        case props, costumes, specialEffects, vehicles, animals, musicCues, specialEquipment

        var id: String { rawValue }

        var column: String {
            switch self {
            case .props:            return "props"
            case .costumes:         return "costumes"
            case .specialEffects:   return "special_effects"
            case .vehicles:         return "vehicles"
            case .animals:          return "animals"
            case .musicCues:        return "music_cues"
            case .specialEquipment: return "special_equipment"
            }
        }

        var label: String {
            switch self {
            case .props:            return "Props"
            case .costumes:         return "Costumes"
            case .specialEffects:   return "Special effects"
            case .vehicles:         return "Vehicles"
            case .animals:          return "Animals"
            case .musicCues:        return "Music cues"
            case .specialEquipment: return "Special equipment"
            }
        }

        var symbol: String {
            switch self {
            case .props:            return "shippingbox"
            case .costumes:         return "tshirt"
            case .specialEffects:   return "sparkles"
            case .vehicles:         return "car"
            case .animals:          return "pawprint"
            case .musicCues:        return "music.note"
            case .specialEquipment: return "wrench.and.screwdriver"
            }
        }

        var tint: Color {
            switch self {
            case .props:            return Color(hex: 0xF59E0B)
            case .costumes:         return Color(hex: 0xEC4899)
            case .specialEffects:   return Color(hex: 0x8B5CF6)
            case .vehicles:         return Color(hex: 0x3B82F6)
            case .animals:          return Color(hex: 0x22C55E)
            case .musicCues:        return Color(hex: 0x06B6D4)
            case .specialEquipment: return Color(hex: 0xEF4444)
            }
        }
    }

    private func values(for category: BreakdownCategory) -> [String] {
        switch category {
        case .props:            return scene.props ?? []
        case .costumes:         return scene.costumes ?? []
        case .specialEffects:   return scene.specialEffects ?? []
        case .vehicles:         return scene.vehicles ?? []
        case .animals:          return scene.animals ?? []
        case .musicCues:        return scene.musicCues ?? []
        case .specialEquipment: return scene.specialEquipment ?? []
        }
    }

    private func setValues(_ values: [String], for category: BreakdownCategory) {
        switch category {
        case .props:            scene.props = values
        case .costumes:         scene.costumes = values
        case .specialEffects:   scene.specialEffects = values
        case .vehicles:         scene.vehicles = values
        case .animals:          scene.animals = values
        case .musicCues:        scene.musicCues = values
        case .specialEquipment: scene.specialEquipment = values
        }
    }

    private var castNames: [String] {
        guard let ids = scene.castIDs, !ids.isEmpty else { return [] }
        let byID = Dictionary(uniqueKeysWithValues: characters.map { ($0.id, $0.name) })
        return ids.compactMap { byID[$0] }
    }

    private var locationName: String? {
        guard let id = scene.locationID else { return nil }
        return locations.first { $0.id == id }?.name
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headerCard
                synopsisCard

                if !castNames.isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader(title: "Cast", subtitle: "\(castNames.count) in this scene")
                            FlowChips(items: castNames, tint: Theme.accent)
                        }
                    }
                }

                breakdownSection
                notesSection
            }
            .screenPadding()
            .padding(.top, 4)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle(scene.sceneNumber?.nonEmpty.map { "Scene \($0)" } ?? "Scene")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await toggleCompleted() }
                } label: {
                    Image(systemName: scene.done ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(scene.done ? Theme.success : Theme.textSecondary)
                        .tappableArea()
                }
                .accessibilityLabel(scene.done ? "Mark as not shot" : "Mark as shot")
            }
        }
        .sheet(item: $editingCategory) { category in
            ListEditorSheet(
                title: category.label,
                symbol: category.symbol,
                tint: category.tint,
                items: values(for: category)
            ) { updated in
                await save(updated, for: category)
            }
        }
        .alert(
            "Couldn't save",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            ),
            actions: { Button("OK", role: .cancel) { errorMessage = nil } },
            message: { Text(errorMessage ?? "") }
        )
    }

    // MARK: - Header

    private var headerCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text(scene.displayHeading)
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 6) {
                    if let type = scene.locationType {
                        Chip(text: type.shortLabel, symbol: type.symbol, tint: Theme.textSecondary)
                    }
                    if let time = scene.timeOfDay {
                        Chip(
                            text: time.label,
                            symbol: time.symbol,
                            tint: time.isNight ? Color(hex: 0x8B5CF6) : Theme.warning
                        )
                    }
                    if scene.done {
                        Chip(text: "Shot", symbol: "checkmark", tint: Theme.success, prominent: true)
                    }
                }

                if scene.eighthsLabel != nil || locationName != nil || (scene.extrasCount ?? 0) > 0 {
                    Divider().overlay(Theme.border)

                    HStack(spacing: 0) {
                        if let eighths = scene.eighthsLabel {
                            MiniStat(value: eighths, label: "Pages")
                        }
                        if let minutes = scene.shootingDurationMinutes, minutes > 0 {
                            MiniStat(value: "\(minutes)m", label: "To shoot")
                        }
                        if let extras = scene.extrasCount, extras > 0 {
                            MiniStat(value: "\(extras)", label: "Extras")
                        }
                    }

                    if let locationName {
                        MetaLabel(symbol: "mappin.and.ellipse", text: locationName)
                            .padding(.top, 2)
                    }
                }
            }
        }
    }

    // MARK: - Synopsis

    private var synopsisCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(
                    title: "Synopsis",
                    actionTitle: isEditingSynopsis ? "Save" : "Edit"
                ) {
                    if isEditingSynopsis {
                        Task { await saveSynopsis() }
                    } else {
                        synopsisDraft = scene.synopsis ?? ""
                        isEditingSynopsis = true
                    }
                }

                if isEditingSynopsis {
                    TextEditor(text: $synopsisDraft)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textPrimary)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 100)
                        .padding(8)
                        .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        .accessibilityLabel("Scene synopsis")
                } else if let synopsis = scene.synopsis?.nonEmpty {
                    Text(synopsis)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("No synopsis yet.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textTertiary)
                }
            }
        }
    }

    // MARK: - Breakdown

    private var breakdownSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: "Breakdown",
                subtitle: scene.totalBreakdownItems == 0
                    ? "Tap a category to add items"
                    : "\(scene.totalBreakdownItems) item\(scene.totalBreakdownItems == 1 ? "" : "s")"
            )

            VStack(spacing: 8) {
                ForEach(BreakdownCategory.allCases) { category in
                    let items = values(for: category)
                    Button {
                        Haptics.tap()
                        editingCategory = category
                    } label: {
                        BreakdownRow(category: category, items: items)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Notes

    @ViewBuilder
    private var notesSection: some View {
        let notes: [(String, String, String)] = [
            ("Stunts", "figure.fall", scene.stunts ?? ""),
            ("Makeup", "paintbrush.pointed", scene.makeupNotes ?? ""),
            ("Sound", "waveform", scene.soundNotes ?? ""),
            ("VFX", "wand.and.stars", scene.vfxNotes ?? ""),
            ("Weather", "cloud.sun", scene.weatherRequired ?? ""),
            ("Notes", "note.text", scene.notes ?? ""),
        ].filter { !$0.2.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

        if !notes.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Department notes")

                VStack(spacing: 8) {
                    ForEach(notes, id: \.0) { title, symbol, body in
                        Card(padding: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Image(systemName: symbol)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Theme.accent)
                                    Text(title)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Theme.textTertiary)
                                        .textCase(.uppercase)
                                        .tracking(0.4)
                                }
                                Text(body)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    // MARK: - Saving

    private func toggleCompleted() async {
        let newValue = !scene.done
        scene.isCompleted = newValue
        onChange(scene)
        Haptics.tap()

        do {
            try await ProductionService.setSceneCompleted(id: scene.id, completed: newValue)
        } catch {
            scene.isCompleted = !newValue
            onChange(scene)
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    private func save(_ values: [String], for category: BreakdownCategory) async {
        let previous = self.values(for: category)
        setValues(values, for: category)
        onChange(scene)

        do {
            try await ProductionService.updateSceneList(
                id: scene.id, column: category.column, values: values
            )
            Haptics.success()
        } catch {
            setValues(previous, for: category)
            onChange(scene)
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }

    private func saveSynopsis() async {
        let previous = scene.synopsis
        let value = synopsisDraft.nonEmpty
        scene.synopsis = value
        isEditingSynopsis = false
        onChange(scene)

        do {
            try await ProductionService.updateSceneFields(
                id: scene.id,
                fields: ["synopsis": value.map { JSONValue.string($0) } ?? .null]
            )
            Haptics.success()
        } catch {
            scene.synopsis = previous
            onChange(scene)
            errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            Haptics.error()
        }
    }
}

// MARK: - Breakdown row

private struct BreakdownRow: View {
    let category: SceneDetailView.BreakdownCategory
    let items: [String]

    var body: some View {
        Card(padding: 12) {
            VStack(alignment: .leading, spacing: items.isEmpty ? 0 : 8) {
                HStack(spacing: 10) {
                    Image(systemName: category.symbol)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(category.tint)
                        .frame(width: 30, height: 30)
                        .background(category.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityHidden(true)

                    Text(category.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.textPrimary)

                    Spacer(minLength: 0)

                    if items.isEmpty {
                        Image(systemName: "plus")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                    } else {
                        Text("\(items.count)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(category.tint)
                            .monospacedDigit()
                    }
                }
                .frame(minHeight: Theme.minTouchTarget - 12)

                if !items.isEmpty {
                    FlowChips(items: items, tint: category.tint)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(category.label), \(items.count) item\(items.count == 1 ? "" : "s")")
        .accessibilityHint("Opens the editor for this category")
        .accessibilityAddTraits(.isButton)
    }
}
