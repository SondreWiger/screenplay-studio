import SwiftUI

/// View/edit a single gear item — name, category, quantity, ownership, etc.
struct GearDetailSheet: View {

    let projectID: String
    @ObservedObject var viewModel: GearViewModel
    let editingItem: GearItem?

    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var category: GearCategory = .camera
    @State private var quantity = 1
    @State private var unit = "unit"
    @State private var ownership: GearOwnership = .tbc
    @State private var vendor = ""
    @State private var dailyRate = ""
    @State private var totalCost = ""
    @State private var notes = ""
    @State private var isSaving = false

    private var isEditing: Bool { editingItem != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Name
                    LabelledField(label: "Name", placeholder: "e.g. ARRI ALEXA Mini LF", text: $name, symbol: "shippingbox")

                    // Category
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CATEGORY")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.4)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(GearCategory.allCases) { cat in
                                    Button {
                                        Haptics.selectionChanged()
                                        category = cat
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: cat.symbol)
                                                .font(.caption2.weight(.semibold))
                                            Text(cat.label)
                                                .font(.caption.weight(.semibold))
                                        }
                                        .foregroundStyle(category == cat ? .white : Theme.textSecondary)
                                        .padding(.horizontal, 10)
                                        .frame(minHeight: 32)
                                        .background(Capsule().fill(category == cat ? cat.tint : Theme.card))
                                        .overlay(Capsule().strokeBorder(category == cat ? .clear : Theme.border, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Quantity and Unit
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("QUANTITY")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.textTertiary)
                                .tracking(0.4)
                            Stepper("\(quantity)", value: $quantity, in: 1...999)
                                .font(.body.weight(.medium))
                                .foregroundStyle(Theme.textPrimary)
                                .padding(.horizontal, 14)
                                .frame(minHeight: Theme.minTouchTarget)
                                .background(Theme.elevated, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous).strokeBorder(Theme.border))
                        }

                        LabelledField(label: "Unit", placeholder: "unit", text: $unit, symbol: "ruler")
                    }

                    // Ownership
                    VStack(alignment: .leading, spacing: 6) {
                        Text("OWNERSHIP")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .tracking(0.4)

                        HStack(spacing: 6) {
                            ForEach(GearOwnership.allCases) { own in
                                Button {
                                    Haptics.selectionChanged()
                                    ownership = own
                                } label: {
                                    Text(own.label)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(ownership == own ? .white : Theme.textSecondary)
                                        .frame(maxWidth: .infinity)
                                        .frame(minHeight: 36)
                                        .background(Capsule().fill(ownership == own ? own.tint : Theme.card))
                                        .overlay(Capsule().strokeBorder(ownership == own ? .clear : Theme.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // Vendor
                    LabelledField(label: "Vendor / Rental House", placeholder: "Optional", text: $vendor, symbol: "building.2")

                    // Costs
                    HStack(spacing: 12) {
                        LabelledField(label: "Daily Rate", placeholder: "0", text: $dailyRate, symbol: "dollarsign.circle", keyboard: .decimalPad)
                        LabelledField(label: "Total Cost", placeholder: "0", text: $totalCost, symbol: "banknote", keyboard: .decimalPad)
                    }

                    // Notes
                    LabelledField(label: "Notes", placeholder: "Optional notes…", text: $notes, symbol: "note.text")
                }
                .screenPadding()
                .padding(.vertical, 12)
            }
            .background(Theme.background)
            .navigationTitle(isEditing ? "Edit Gear" : "New Gear")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isEditing ? "Save" : "Add") {
                        Haptics.tap()
                        save()
                    }
                    .fontWeight(.semibold)
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
            .onAppear {
                if let item = editingItem {
                    name = item.name
                    category = item.category
                    quantity = item.quantity
                    unit = item.unit
                    ownership = item.ownership
                    vendor = item.vendor ?? ""
                    dailyRate = item.dailyRate.map { String(format: "%.2f", $0) } ?? ""
                    totalCost = item.totalCost.map { String(format: "%.2f", $0) } ?? ""
                    notes = item.notes ?? ""
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func save() {
        isSaving = true
        Task {
            if isEditing, let item = editingItem {
                var fields: [String: JSONValue] = [
                    "name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines)),
                    "category": .string(category.rawValue),
                    "quantity": .number(Double(quantity)),
                    "unit": .string(unit.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? "unit"),
                    "ownership": .string(ownership.rawValue),
                ]
                if let v = vendor.nonEmpty { fields["vendor"] = .string(v) } else { fields["vendor"] = .null }
                if let r = Double(dailyRate) { fields["daily_rate"] = .number(r) } else { fields["daily_rate"] = .null }
                if let c = Double(totalCost) { fields["total_cost"] = .number(c) } else { fields["total_cost"] = .null }
                if let n = notes.nonEmpty { fields["notes"] = .string(n) } else { fields["notes"] = .null }

                do {
                    try await ProductionService.updateGear(id: item.id, fields: fields)
                    await viewModel.refresh()
                } catch {
                    viewModel.errorMessage = error.localizedDescription
                }
            } else {
                _ = await viewModel.createItem(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    category: category,
                    quantity: quantity,
                    unit: unit.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? "unit",
                    ownership: ownership,
                    vendor: vendor.nonEmpty,
                    dailyRate: Double(dailyRate),
                    totalCost: Double(totalCost),
                    notes: notes.nonEmpty,
                    ownerID: auth.userID
                )
            }
            isSaving = false
            dismiss()
        }
    }
}
