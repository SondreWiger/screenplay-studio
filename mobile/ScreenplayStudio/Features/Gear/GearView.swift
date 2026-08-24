import SwiftUI

/// Category-filtered list of all gear items with status chips and checkout badges.
struct GearView: View {

    let projectID: String

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model: GearViewModel

    @State private var isShowingNewItem = false
    @State private var selectedItem: GearItem?
    @State private var checkoutItem: GearItem?

    init(projectID: String) {
        self.projectID = projectID
        _model = StateObject(wrappedValue: GearViewModel(projectID: projectID))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Summary bar
                summaryCard

                // Category filter
                categoryFilter

                // Status filter
                statusFilter

                // Items grouped by category
                if model.isLoading {
                    SkeletonList(rows: 5)
                } else if model.filteredItems.isEmpty {
                    EmptyStateView(
                        symbol: "shippingbox",
                        title: model.items.isEmpty ? "No gear yet" : "No matching items",
                        message: model.items.isEmpty
                            ? "Add cameras, lenses, lights and more."
                            : "Try a different filter or search.",
                        actionTitle: model.items.isEmpty ? "Add Gear" : nil
                    ) {
                        isShowingNewItem = true
                    }
                    .padding(.top, 20)
                } else {
                    ForEach(model.groupedItems, id: \.category) { group in
                        VStack(alignment: .leading, spacing: 8) {
                            SectionHeader(
                                title: group.category.label,
                                subtitle: "\(group.items.count) item\(group.items.count == 1 ? "" : "s")"
                            )

                            ForEach(group.items) { item in
                                gearRow(item)
                            }
                        }
                    }
                }
            }
            .screenPadding()
            .padding(.vertical, 8)
        }
        .background(Theme.background)
        .searchable(text: $model.searchText, prompt: "Search gear")
        .refreshable { await model.refresh() }
        .navigationTitle("Gear")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    isShowingNewItem = true
                } label: {
                    Image(systemName: "plus").tappableArea()
                }
                .accessibilityLabel("Add gear")
            }
        }
        .sheet(isPresented: $isShowingNewItem) {
            GearDetailSheet(projectID: projectID, viewModel: model, editingItem: nil)
        }
        .sheet(item: $selectedItem) { item in
            GearDetailSheet(projectID: projectID, viewModel: model, editingItem: item)
        }
        .sheet(item: $checkoutItem) { item in
            GearCheckoutSheet(item: item, projectID: projectID, viewModel: model)
        }
        .task { await model.loadIfNeeded() }
    }

    // MARK: - Summary

    private var summaryCard: some View {
        Card {
            HStack(spacing: 0) {
                summaryCell(value: "\(model.totalItemCount)", label: "Total", tint: Theme.textPrimary)
                summaryCell(value: "\(model.confirmedCount)", label: "Confirmed", tint: Theme.success)
                summaryCell(value: "\(model.pendingCount)", label: "Pending", tint: Theme.warning)
                summaryCell(value: "\(model.checkedOutCount)", label: "Checked Out", tint: Theme.accent)
            }
        }
    }

    private func summaryCell(value: String, label: String, tint: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(tint)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Filters

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip(label: "All", isSelected: model.filterCategory == nil) {
                    model.filterCategory = nil
                }
                ForEach(GearCategory.allCases) { cat in
                    filterChip(
                        label: cat.label,
                        symbol: cat.symbol,
                        isSelected: model.filterCategory == cat,
                        tint: cat.tint
                    ) {
                        model.filterCategory = model.filterCategory == cat ? nil : cat
                    }
                }
            }
            .padding(.horizontal, Theme.screenPadding)
        }
        .padding(.horizontal, -Theme.screenPadding)
    }

    private var statusFilter: some View {
        HStack(spacing: 6) {
            ForEach(GearStatus.allCases) { status in
                filterChip(
                    label: status.label,
                    symbol: status.symbol,
                    isSelected: model.filterStatus == status,
                    tint: status.tint
                ) {
                    model.filterStatus = model.filterStatus == status ? nil : status
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func filterChip(label: String, symbol: String? = nil, isSelected: Bool, tint: Color = Theme.accent, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selectionChanged()
            action()
        } label: {
            HStack(spacing: 4) {
                if let symbol {
                    Image(systemName: symbol)
                        .font(.caption2.weight(.semibold))
                }
                Text(label)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? .white : Theme.textSecondary)
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(
                Capsule().fill(isSelected ? tint : Theme.card)
            )
            .overlay(
                Capsule().strokeBorder(isSelected ? .clear : Theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Item row

    private func gearRow(_ item: GearItem) -> some View {
        Button {
            Haptics.tap()
            selectedItem = item
        } label: {
            Card(padding: 12) {
                HStack(spacing: 12) {
                    Image(systemName: item.category.symbol)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(item.category.tint)
                        .frame(width: 38, height: 38)
                        .background(item.category.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(item.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(1)

                            if item.quantity > 1 {
                                Text("×\(item.quantity)")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.textTertiary)
                            }
                        }

                        HStack(spacing: 6) {
                            Chip(text: item.status.label, symbol: item.status.symbol, tint: item.status.tint)
                            Chip(text: item.ownership.label, tint: item.ownership.tint)

                            if let checkout = model.activeCheckout(for: item.id) {
                                Chip(text: checkout.checkedOutByName, symbol: "person.fill", tint: Theme.accent, prominent: true)
                            }
                        }
                    }

                    Spacer(minLength: 0)

                    // Checkout quick action
                    Button {
                        Haptics.tap()
                        checkoutItem = item
                    } label: {
                        Image(systemName: model.activeCheckout(for: item.id) != nil ? "arrow.uturn.backward.circle" : "arrow.right.circle")
                            .font(.title3)
                            .foregroundStyle(model.activeCheckout(for: item.id) != nil ? Theme.warning : Theme.accent)
                    }
                    .buttonStyle(.plain)
                    .tappableArea(36)
                    .accessibilityLabel(model.activeCheckout(for: item.id) != nil ? "Return gear" : "Check out gear")
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                Task { await model.cycleStatus(item: item) }
            } label: {
                Label("Cycle Status → \(item.status.next.label)", systemImage: item.status.next.symbol)
            }

            Divider()

            Button(role: .destructive) {
                Task { await model.deleteItem(id: item.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
