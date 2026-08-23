import SwiftUI

/// Shown when no Supabase project is bundled or stored.
///
/// A build that ships with `Secrets.plist` never reaches this screen; it exists
/// so a fresh checkout runs, and so the app can be pointed at a staging project
/// without a rebuild.
struct ConnectProjectView: View {

    @EnvironmentObject private var auth: AuthStore

    @State private var urlString = ""
    @State private var anonKey = ""
    @FocusState private var focusedField: Field?

    private enum Field { case url, key }

    private var canSubmit: Bool {
        !urlString.trimmingCharacters(in: .whitespaces).isEmpty
            && !anonKey.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 14) {
                    AppMark(size: 64)
                    Text("Connect your workspace")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Point the app at the Supabase project behind your Screenplay Studio install.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 32)

                VStack(spacing: 14) {
                    LabelledField(
                        label: "Project URL",
                        placeholder: "your-project.supabase.co",
                        text: $urlString,
                        symbol: "link",
                        keyboard: .URL,
                        textContent: .URL,
                        autocapitalisation: .never
                    ) { focusedField = .key }
                    .focused($focusedField, equals: .url)

                    LabelledField(
                        label: "Anon key",
                        placeholder: "eyJhbGciOi…",
                        text: $anonKey,
                        symbol: "key",
                        keyboard: .default,
                        autocapitalisation: .never,
                        submitLabel: .go
                    ) { submit() }
                    .focused($focusedField, equals: .key)
                }

                if let error = auth.errorMessage {
                    InlineError(message: error)
                }

                Button("Connect") { submit() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSubmit)
                    .opacity(canSubmit ? 1 : 0.5)

                Text("The anon key is a public, row-level-security-scoped key — the same one the website ships to browsers. It is stored only on this device.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }
            .screenPadding()
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .onAppear { focusedField = .url }
    }

    private func submit() {
        guard canSubmit else { return }
        focusedField = nil
        Task { await auth.configure(urlString: urlString, anonKey: anonKey) }
    }
}

/// Inline validation / server error text used across the auth screens.
struct InlineError: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.footnote)
                .foregroundStyle(Theme.danger)
                .accessibilityHidden(true)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.danger.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}
