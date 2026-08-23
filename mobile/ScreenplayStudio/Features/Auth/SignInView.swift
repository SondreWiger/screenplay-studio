import SwiftUI

struct SignInView: View {

    @EnvironmentObject private var auth: AuthStore

    private enum Mode { case signIn, signUp, reset }

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var didSendReset = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, email, password }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                header

                if let confirmation = auth.confirmationEmail {
                    confirmationNotice(email: confirmation)
                } else {
                    form
                }
            }
            .screenPadding()
            .padding(.bottom, 40)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .animation(.easeInOut(duration: 0.2), value: mode)
        .animation(.easeInOut(duration: 0.2), value: auth.confirmationEmail)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 12) {
            AppMark(size: 64)
            Text("Screenplay Studio")
                .font(.title2.weight(.bold))
                .foregroundStyle(Theme.textPrimary)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 36)
    }

    private var subtitle: String {
        switch mode {
        case .signIn: return "Write. Plan. Produce."
        case .signUp: return "Create an account to start writing."
        case .reset:  return "We'll email you a link to set a new password."
        }
    }

    // MARK: - Form

    private var form: some View {
        VStack(spacing: 16) {
            if mode == .signUp {
                LabelledField(
                    label: "Name",
                    placeholder: "Your name",
                    text: $fullName,
                    symbol: "person",
                    textContent: .name,
                    autocapitalisation: .words
                ) { focusedField = .email }
                .focused($focusedField, equals: .name)
            }

            LabelledField(
                label: "Email",
                placeholder: "you@example.com",
                text: $email,
                symbol: "envelope",
                keyboard: .emailAddress,
                textContent: .emailAddress,
                autocapitalisation: .never,
                submitLabel: mode == .reset ? .go : .next
            ) {
                mode == .reset ? submit() : (focusedField = .password)
            }
            .focused($focusedField, equals: .email)

            if mode != .reset {
                LabelledField(
                    label: "Password",
                    placeholder: mode == .signUp ? "At least 6 characters" : "Your password",
                    text: $password,
                    symbol: "lock",
                    isSecure: true,
                    textContent: mode == .signUp ? .newPassword : .password,
                    autocapitalisation: .never,
                    submitLabel: .go
                ) { submit() }
                .focused($focusedField, equals: .password)
            }

            if let error = auth.errorMessage {
                InlineError(message: error)
            }

            if didSendReset {
                InlineNotice(
                    symbol: "paperplane.fill",
                    message: "If an account exists for that address, a reset link is on its way."
                )
            }

            Button {
                submit()
            } label: {
                if auth.isWorking {
                    ProgressView().tint(.white)
                } else {
                    Text(primaryTitle)
                }
            }
            .buttonStyle(PrimaryButtonStyle(isLoading: auth.isWorking))
            .disabled(!canSubmit || auth.isWorking)
            .opacity(canSubmit ? 1 : 0.5)

            footerLinks
        }
    }

    private var primaryTitle: String {
        switch mode {
        case .signIn: return "Sign in"
        case .signUp: return "Create account"
        case .reset:  return "Send reset link"
        }
    }

    private var canSubmit: Bool {
        let hasEmail = email.contains("@") && email.count > 4
        switch mode {
        case .reset:  return hasEmail
        case .signIn: return hasEmail && password.count >= 6
        case .signUp: return hasEmail && password.count >= 6
        }
    }

    private var footerLinks: some View {
        VStack(spacing: 4) {
            switch mode {
            case .signIn:
                textButton("New here? Create an account") { switchTo(.signUp) }
                textButton("Forgot your password?") { switchTo(.reset) }
            case .signUp:
                textButton("Already have an account? Sign in") { switchTo(.signIn) }
            case .reset:
                textButton("Back to sign in") { switchTo(.signIn) }
            }
        }
        .padding(.top, 4)
    }

    private func textButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title) {
            Haptics.tap()
            action()
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(Theme.accent)
        .frame(minHeight: Theme.minTouchTarget)
        .contentShape(.rect)
    }

    // MARK: - Confirmation notice

    private func confirmationNotice(email: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "envelope.badge")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Theme.accent)
                .accessibilityHidden(true)

            Text("Check your inbox")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)

            Text("We sent a confirmation link to \(email). Tap it, then come back and sign in.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Button("Back to sign in") {
                Haptics.tap()
                auth.confirmationEmail = nil
                mode = .signIn
                password = ""
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        .padding(.top, 12)
    }

    // MARK: - Actions

    private func switchTo(_ newMode: Mode) {
        mode = newMode
        auth.errorMessage = nil
        didSendReset = false
    }

    private func submit() {
        guard canSubmit, !auth.isWorking else { return }
        focusedField = nil
        didSendReset = false

        Task {
            switch mode {
            case .signIn:
                await auth.signIn(email: email, password: password)
            case .signUp:
                await auth.signUp(email: email, password: password, fullName: fullName)
            case .reset:
                await auth.sendPasswordReset(email: email)
                if auth.errorMessage == nil { didSendReset = true }
            }
        }
    }
}

/// A neutral, non-error inline message.
struct InlineNotice: View {
    let symbol: String
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: symbol)
                .font(.footnote)
                .foregroundStyle(Theme.accent)
                .accessibilityHidden(true)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
