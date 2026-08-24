import SwiftUI

/// Checkout flow: pick who's taking the gear, confirm, and see the checkout log.
struct GearCheckoutSheet: View {

    let item: GearItem
    let projectID: String
    @ObservedObject var viewModel: GearViewModel

    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var checkoutName = ""
    @State private var checkoutNotes = ""
    @State private var checkoutHistory: [GearCheckout] = []
    @State private var isLoadingHistory = false
    @State private var isProcessing = false

    private var activeCheckout: GearCheckout? {
        viewModel.activeCheckout(for: item.id)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Item header
                    itemHeader

                    // Current status
                    if let checkout = activeCheckout {
                        currentCheckoutCard(checkout)
                    } else {
                        checkoutForm
                    }

                    // History
                    historySection
                }
                .screenPadding()
                .padding(.vertical, 12)
            }
            .background(Theme.background)
            .navigationTitle("Checkout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await loadHistory()
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Item header

    private var itemHeader: some View {
        Card {
            HStack(spacing: 12) {
                Image(systemName: item.category.symbol)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(item.category.tint)
                    .frame(width: 44, height: 44)
                    .background(item.category.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name)
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)

                    HStack(spacing: 6) {
                        Chip(text: item.category.label, tint: item.category.tint)
                        if item.quantity > 1 {
                            Chip(text: "×\(item.quantity)", tint: Theme.textTertiary)
                        }
                        Chip(text: item.status.label, symbol: item.status.symbol, tint: item.status.tint)
                    }
                }

                Spacer(minLength: 0)
            }
        }
    }

    // MARK: - Active checkout

    private func currentCheckoutCard(_ checkout: GearCheckout) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "person.badge.clock")
                        .font(.title3)
                        .foregroundStyle(Theme.warning)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Currently with")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.4)
                        Text(checkout.checkedOutByName)
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                    }

                    Spacer(minLength: 0)

                    Text(Self.relative(checkout.checkedOutAt))
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }

                if let notes = checkout.notes?.nonEmpty {
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }

                Button {
                    Haptics.impact()
                    isProcessing = true
                    Task {
                        await viewModel.returnItem(checkoutID: checkout.id)
                        isProcessing = false
                        await loadHistory()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.uturn.backward")
                        Text("Return to Video Village")
                    }
                }
                .buttonStyle(PrimaryButtonStyle(isLoading: isProcessing))
                .disabled(isProcessing)
            }
        }
    }

    // MARK: - Checkout form

    private var checkoutForm: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.right.circle.fill")
                        .font(.title3)
                        .foregroundStyle(Theme.success)

                    Text("Check Out")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                }

                Text("Who is taking this gear from video village?")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)

                LabelledField(
                    label: "Person",
                    placeholder: "Name of crew member",
                    text: $checkoutName,
                    symbol: "person"
                )

                LabelledField(
                    label: "Notes",
                    placeholder: "Optional — e.g. 'for B-cam setup at quay'",
                    text: $checkoutNotes,
                    symbol: "note.text"
                )

                Button {
                    Haptics.impact()
                    guard let userID = auth.userID else { return }
                    let name = checkoutName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !name.isEmpty else { return }
                    isProcessing = true
                    Task {
                        await viewModel.checkout(
                            gearID: item.id,
                            userID: userID,
                            userName: name,
                            notes: checkoutNotes.nonEmpty
                        )
                        isProcessing = false
                        checkoutName = ""
                        checkoutNotes = ""
                        await loadHistory()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.right.circle")
                        Text("Check Out")
                    }
                }
                .buttonStyle(PrimaryButtonStyle(isLoading: isProcessing))
                .disabled(checkoutName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isProcessing)
            }
        }
    }

    // MARK: - History

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Checkout History")

            if isLoadingHistory {
                SkeletonList(rows: 2)
            } else if checkoutHistory.isEmpty {
                Text("No checkout history yet.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(checkoutHistory) { checkout in
                    Card(padding: 10) {
                        HStack(spacing: 10) {
                            Image(systemName: checkout.isActive ? "circle.fill" : "checkmark.circle")
                                .font(.caption)
                                .foregroundStyle(checkout.isActive ? Theme.warning : Theme.success)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(checkout.checkedOutByName)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.textPrimary)

                                HStack(spacing: 4) {
                                    Text("Out: \(Self.formatDate(checkout.checkedOutAt))")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.textTertiary)

                                    if let returned = checkout.returnedAt {
                                        Text("→ In: \(Self.formatDate(returned))")
                                            .font(.caption2)
                                            .foregroundStyle(Theme.success)
                                    } else {
                                        Text("→ Still out")
                                            .font(.caption2)
                                            .foregroundStyle(Theme.warning)
                                    }
                                }
                            }

                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Data

    private func loadHistory() async {
        isLoadingHistory = true
        do {
            checkoutHistory = try await ProductionService.fetchCheckouts(gearID: item.id)
        } catch {
            // Silently fail — history is supplementary.
        }
        isLoadingHistory = false
    }

    private static func relative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private static func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM, HH:mm"
        return formatter.string(from: date)
    }
}
