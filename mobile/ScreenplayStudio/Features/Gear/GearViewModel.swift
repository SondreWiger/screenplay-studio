import SwiftUI

/// State for the gear management screen.
@MainActor
final class GearViewModel: ObservableObject {

    let projectID: String

    @Published private(set) var items: [GearItem] = []
    @Published private(set) var activeCheckouts: [GearCheckout] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    // Filters
    @Published var filterCategory: GearCategory?
    @Published var filterStatus: GearStatus?
    @Published var searchText = ""

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
            async let gear = ProductionService.fetchGear(projectID: projectID)
            async let checkouts = ProductionService.fetchActiveCheckouts(projectID: projectID)
            items = try await gear
            activeCheckouts = try await checkouts
            errorMessage = nil
        } catch is CancellationError {
            // Left the screen.
        } catch {
            if items.isEmpty {
                errorMessage = (error as? SupabaseError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    // MARK: - Derived

    var filteredItems: [GearItem] {
        var result = items

        if let category = filterCategory {
            result = result.filter { $0.category == category }
        }
        if let status = filterStatus {
            result = result.filter { $0.status == status }
        }

        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !term.isEmpty {
            result = result.filter {
                $0.name.lowercased().contains(term)
                || $0.category.rawValue.lowercased().contains(term)
                || ($0.vendor?.lowercased().contains(term) ?? false)
            }
        }

        return result
    }

    /// Items grouped by category for the list view.
    var groupedItems: [(category: GearCategory, items: [GearItem])] {
        Dictionary(grouping: filteredItems, by: \.category)
            .map { (category: $0.key, items: $0.value) }
            .sorted { $0.category.rawValue < $1.category.rawValue }
    }

    var totalItemCount: Int { items.count }
    var checkedOutCount: Int { activeCheckouts.count }

    var confirmedCount: Int { items.filter { $0.status == .confirmed }.count }
    var pendingCount: Int { items.filter { $0.status == .pending }.count }

    func activeCheckout(for gearID: String) -> GearCheckout? {
        activeCheckouts.first { $0.gearID == gearID }
    }

    // MARK: - CRUD

    func createItem(
        name: String,
        category: GearCategory,
        quantity: Int,
        unit: String,
        ownership: GearOwnership,
        vendor: String?,
        dailyRate: Double?,
        totalCost: Double?,
        notes: String?,
        ownerID: String?
    ) async -> GearItem? {
        do {
            let item = try await ProductionService.createGear(NewGearItem(
                projectID: projectID,
                name: name,
                category: category.rawValue,
                quantity: quantity,
                unit: unit,
                ownership: ownership.rawValue,
                vendor: vendor?.nonEmpty,
                dailyRate: dailyRate,
                totalCost: totalCost,
                notes: notes?.nonEmpty,
                status: GearStatus.pending.rawValue,
                createdBy: ownerID
            ))
            if let item {
                items.append(item)
                items.sort { ($0.category.rawValue, $0.name) < ($1.category.rawValue, $1.name) }
            }
            return item
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func deleteItem(id: String) async {
        do {
            try await ProductionService.deleteGear(id: id)
            items.removeAll { $0.id == id }
            activeCheckouts.removeAll { $0.gearID == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func cycleStatus(item: GearItem) async {
        let next = item.status.next
        do {
            try await ProductionService.cycleGearStatus(id: item.id, next: next)
            if let idx = items.firstIndex(where: { $0.id == item.id }) {
                items[idx].status = next
            }
            Haptics.selectionChanged()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Checkout

    func checkout(gearID: String, userID: String, userName: String, notes: String?) async {
        do {
            let checkout = try await ProductionService.checkoutGear(NewGearCheckout(
                gearID: gearID,
                projectID: projectID,
                checkedOutBy: userID,
                checkedOutByName: userName,
                notes: notes?.nonEmpty
            ))
            if let checkout {
                activeCheckouts.insert(checkout, at: 0)
            }
            Haptics.impact()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func returnItem(checkoutID: String) async {
        do {
            try await ProductionService.returnGear(checkoutID: checkoutID)
            if let idx = activeCheckouts.firstIndex(where: { $0.id == checkoutID }) {
                activeCheckouts.remove(at: idx)
            }
            Haptics.impact()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
