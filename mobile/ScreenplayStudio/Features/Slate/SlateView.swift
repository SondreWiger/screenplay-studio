import SwiftUI

/// A working digital clapperboard with running timecode.
///
/// Built to be used at arm's length in front of a lens: high contrast, big
/// numerals, red LED timecode, and a board that claps on a tap anywhere.
/// Point it at a shot and each clap logs a take — with the frame the sticks
/// closed on — to the shot list and the day's camera report, so the board is
/// part of the production record rather than a prop.
///
/// On an iPad in landscape the board takes most of the screen with the
/// controls and take log beside it; in portrait it stacks.
struct SlateView: View {

    let projectID: String
    let projectTitle: String

    @StateObject private var model: SlateViewModel
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.scenePhase) private var scenePhase

    @State private var isEditingBoard = false
    @State private var isPickingShot = false
    @State private var isShowingTimecode = false
    @State private var isPresenting = false

    init(projectID: String, projectTitle: String) {
        self.projectID = projectID
        self.projectTitle = projectTitle
        _model = StateObject(wrappedValue: SlateViewModel(projectID: projectID, projectTitle: projectTitle))
    }

    var body: some View {
        GeometryReader { geometry in
            let isWide = geometry.size.width > geometry.size.height && geometry.size.width >= 560
            if isWide {
                HStack(spacing: 0) {
                    SlateBoard(model: model, projectTitle: projectTitle, allowsSwipeToClap: true)
                        .padding(16)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    Rectangle().fill(Theme.border).frame(width: 1)

                    ScrollView {
                        panel
                            .padding(16)
                    }
                    .frame(width: min(420, max(300, geometry.size.width * 0.34)))
                    .background(Theme.background)
                }
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        SlateBoard(model: model, projectTitle: projectTitle)
                            .frame(height: min(geometry.size.width * 0.86, geometry.size.height * 0.58, 720))
                        panel
                    }
                    .frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
                    .screenPadding()
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("Slate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .toolbar { toolbar }
        .background { SlateKeyCommands(model: model) }
        .sheet(isPresented: $isEditingBoard) {
            SlateEditSheet(model: model, projectTitle: projectTitle)
        }
        .sheet(isPresented: $isPickingShot) {
            SlateShotPicker(shots: model.shots, scenes: model.scenes) { shot in
                model.link(to: shot)
            }
        }
        .sheet(isPresented: $isShowingTimecode) {
            TimecodeSettingsSheet(model: model, ltc: model.ltc)
        }
        .fullScreenCover(isPresented: $isPresenting) {
            SlatePresentView(model: model, projectTitle: projectTitle)
        }
        .task { await model.loadContext() }
        .onAppear {
            model.activate(ownerID: auth.userID)
            // Marking takes is the whole job of this screen; the screen must
            // not dim halfway through a setup.
            UIApplication.shared.isIdleTimerDisabled = true
            OrientationLock.allowLandscape(true)
            if model.state.maxBrightness { ScreenBrightness.boost() }
        }
        .onDisappear {
            model.deactivate()
            UIApplication.shared.isIdleTimerDisabled = false
            OrientationLock.allowLandscape(false)
            ScreenBrightness.restore()
        }
        .onChange(of: scenePhase) { phase in
            switch phase {
            case .active:
                if model.state.maxBrightness { ScreenBrightness.boost() }
            default:
                // iOS keeps whatever brightness an app leaves behind.
                ScreenBrightness.restore()
            }
        }
        .onChange(of: model.state.maxBrightness) { isOn in
            isOn ? ScreenBrightness.boost() : ScreenBrightness.restore()
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                Haptics.tap()
                isPresenting = true
            } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right").tappableArea()
            }
            .accessibilityLabel("Full-screen board")
            .keyboardShortcut("f", modifiers: .command)

            Menu {
                Button {
                    isEditingBoard = true
                } label: {
                    Label("Edit board", systemImage: "square.and.pencil")
                }
                Button {
                    isShowingTimecode = true
                } label: {
                    Label("Timecode", systemImage: "clock.badge.checkmark")
                }
                Divider()
                Button {
                    model.nextSetup()
                } label: {
                    Label("Next setup", systemImage: "forward.end")
                }
                Button {
                    model.nextRoll()
                } label: {
                    Label("Next roll", systemImage: "arrow.triangle.2.circlepath")
                }
                Divider()
                Toggle(isOn: Binding(
                    get: { AppSettings.shared.slateSoundEnabled },
                    set: { AppSettings.shared.slateSoundEnabled = $0 }
                )) {
                    Label("Clap sound", systemImage: "speaker.wave.2")
                }
            } label: {
                Image(systemName: "ellipsis.circle").tappableArea()
            }
            .accessibilityLabel("Slate options")
        }
    }

    private var panel: some View {
        SlateControlPanel(
            model: model,
            ltc: model.ltc,
            onEditBoard: { isEditingBoard = true },
            onPickShot: { isPickingShot = true },
            onTimecode: { isShowingTimecode = true }
        )
    }
}

// MARK: - Present mode

/// The board and nothing else, for holding up in front of a lens. Tap or
/// swipe down anywhere to clap; the two faint controls in the corners are
/// the only way out.
struct SlatePresentView: View {

    @ObservedObject var model: SlateViewModel
    let projectTitle: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            SlateBoard(model: model, projectTitle: projectTitle, allowsSwipeToClap: true)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
        }
        .overlay(alignment: .topLeading) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.bold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(width: 44, height: 44)
                    .background(.black.opacity(0.4), in: Circle())
            }
            .padding(14)
            .accessibilityLabel("Close full-screen board")
            .keyboardShortcut(.cancelAction)
        }
        .overlay(alignment: .topTrailing) {
            HStack(spacing: 6) {
                cornerButton("minus", label: "Previous take") { model.adjustTake(by: -1) }
                cornerButton("plus", label: "Next take") { model.adjustTake(by: 1) }
            }
            .padding(14)
        }
        .background { SlateKeyCommands(model: model) }
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .preferredColorScheme(.dark)
    }

    private func cornerButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.bold))
                .foregroundStyle(.white.opacity(0.55))
                .frame(width: 44, height: 44)
                .background(.black.opacity(0.4), in: Circle())
        }
        .accessibilityLabel(label)
    }
}

// MARK: - Keyboard

/// Hardware-keyboard and remote control of the board. Bluetooth camera
/// remotes and page turners send Space, Return or Page Down, so any of
/// them claps — an AC can slate from behind the camera.
private struct SlateKeyCommands: View {
    @ObservedObject var model: SlateViewModel

    var body: some View {
        ZStack {
            Button("Mark") { model.mark() }
                .keyboardShortcut(.space, modifiers: [])
            Button("Mark") { model.mark() }
                .keyboardShortcut(.return, modifiers: [])
            Button("Mark") { model.mark() }
                .keyboardShortcut(.pageDown, modifiers: [])
            Button("Next take") { model.adjustTake(by: 1) }
                .keyboardShortcut(.upArrow, modifiers: [])
            Button("Previous take") { model.adjustTake(by: -1) }
                .keyboardShortcut(.downArrow, modifiers: [])
            Button("Next setup") { model.nextSetup() }
                .keyboardShortcut("n", modifiers: .command)
            Button("Next roll") { model.nextRoll() }
                .keyboardShortcut("r", modifiers: [.command, .shift])
        }
        .opacity(0)
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }
}
