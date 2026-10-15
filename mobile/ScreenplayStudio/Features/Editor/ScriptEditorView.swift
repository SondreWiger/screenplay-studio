import SwiftUI

/// The screenplay editor.
///
/// Laid out as a vertical stack of typed elements rather than one big text
/// field, which is what makes correct screenplay formatting possible: each
/// element knows its own margins, casing and what Return should create next.
///
/// On a phone the margins are compressed to fit; on iPad (or any wide window)
/// the script sits on a sheet of paper at real screenplay margins, the way it
/// will print.
struct ScriptEditorView: View {

    let projectID: String
    let scriptID: String
    let scriptTitle: String

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var model: EditorViewModel

    @State private var elementHeights: [String: CGFloat] = [:]
    @State private var isShowingSceneList = false
    @State private var isShowingStats = false
    @State private var sharedFile: SharedFile?
    @State private var exportError: String?
    /// Width of the scroll view, measured, used to lay out the page.
    @State private var containerWidth: CGFloat = 0

    init(projectID: String, scriptID: String, scriptTitle: String) {
        self.projectID = projectID
        self.scriptID = scriptID
        self.scriptTitle = scriptTitle
        _model = StateObject(wrappedValue: EditorViewModel(projectID: projectID, scriptID: scriptID))
    }

    // MARK: - Layout

    private var isWide: Bool { sizeClass == .regular }

    private var fontSize: CGFloat {
        // 12pt is the screenplay standard; on a 390pt-wide phone that leaves
        // roughly 50 characters per line, so the default nudges up slightly and
        // the reader can trim it in Settings. iPad has room for a little more.
        (isWide ? 15 : 13) * settings.clampedEditorScale
    }

    /// Paper on wide screens when the setting is on.
    private var showsPaper: Bool { isWide && settings.editorPaper }

    /// Inside margin of the paper sheet.
    private var paperInset: CGFloat { showsPaper ? 48 : 0 }

    /// The live text column: about 60 Courier characters, like a printed page,
    /// on wide screens; the full width less gutters on a phone.
    private var columnWidth: CGFloat {
        guard containerWidth > 0 else { return 0 }
        if isWide {
            let ideal = fontSize * 36.5
            return max(280, min(ideal, containerWidth - 2 * (paperInset + 28)))
        }
        return containerWidth - 36
    }

    /// Phones compress the screenplay margins so dialogue isn't squeezed into a
    /// column three words wide; a full-size page uses them as written.
    private var marginCompression: CGFloat { isWide ? 1.0 : 0.55 }

    private var dimsOtherLines: Bool {
        settings.focusMode && model.focusedElementID != nil
    }

    // MARK: - Body

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                page
                    .frame(width: columnWidth > 0 ? columnWidth : nil)
                    .padding(.horizontal, isWide ? paperInset : 18)
                    .padding(.top, showsPaper ? 44 : 12)
                    .padding(.bottom, showsPaper ? 28 : 0)
                    .background {
                        if showsPaper {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Theme.card)
                                .shadow(color: .black.opacity(0.12), radius: 18, y: 6)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .strokeBorder(Theme.border, lineWidth: 1)
                                )
                        }
                    }
                    .padding(.vertical, showsPaper ? 28 : 0)
                    .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .background(
                GeometryReader { geometry in
                    Color.clear
                        .onAppear { containerWidth = geometry.size.width }
                        .onChange(of: geometry.size.width) { _, width in containerWidth = width }
                }
            )
            .onChange(of: model.focusedElementID) { _, id in
                guard let id else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    // Typewriter scrolling keeps the current line mid-screen;
                    // otherwise scroll only as far as needed to show it.
                    proxy.scrollTo(id, anchor: settings.typewriterScrolling ? .center : nil)
                }
            }
            .overlay {
                if model.isLoading && model.elements.isEmpty {
                    ProgressView().tint(Theme.textTertiary)
                }
            }
            .background {
                // Hardware-keyboard shortcuts for the screen as a whole.
                Group {
                    Button("Save Now") { Task { await model.flushImmediately() } }
                        .keyboardShortcut("s", modifiers: .command)
                    Button("Jump to Scene") { isShowingSceneList = true }
                        .keyboardShortcut("j", modifiers: .command)
                }
                .opacity(0)
                .accessibilityHidden(true)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if settings.showElementBar {
                EditorToolbar(
                    focusedElement: focusedElement,
                    characterSuggestions: characterSuggestions,
                    onSelectType: { type in
                        guard let id = model.focusedElementID else { return }
                        model.changeType(type, for: id)
                    },
                    onSelectCharacter: { name in
                        guard let id = model.focusedElementID else { return }
                        model.updateContent(name, for: id)
                        model.insertElement(after: id, type: .dialogue)
                    },
                    onDismissKeyboard: {
                        model.focusedElementID = nil
                        Haptics.tap()
                    }
                )
            }
        }
        .navigationTitle(scriptTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        // The page is the point of this screen. The tab bar costs ~50pt of it
        // and leads nowhere you'd go mid-sentence, so it steps aside here.
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(scriptTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    SaveStatusLabel(state: model.saveState)
                }
            }

            ToolbarItem(placement: .topBarTrailing) {
                optionsMenu
            }
        }
        .sheet(isPresented: $isShowingSceneList) {
            SceneJumpSheet(scenes: model.sceneIndex) { element in
                model.focusedElementID = element.id
            }
        }
        .sheet(isPresented: $isShowingStats) {
            ScriptStatsSheet(
                pages: model.estimatedPages,
                words: model.wordCount,
                elements: model.elements.count,
                scenes: model.sceneIndex.count,
                characters: model.knownCharacterNames
            )
        }
        .sheet(item: $sharedFile) { file in
            ActivityView(items: [file.url])
                .presentationDetents([.medium, .large])
                .ignoresSafeArea()
        }
        .alert(
            "Couldn’t export",
            isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } }),
            actions: { Button("OK", role: .cancel) { exportError = nil } },
            message: { Text(exportError ?? "") }
        )
        .task {
            await model.load(ownerID: auth.userID)
            model.startLiveUpdates()
            #if DEBUG
            // `-ss-route editor-typing` opens with a line already focused, so the
            // keyboard bar can be checked in the simulator without tapping.
            if DemoData.initialRoute == "editor-typing",
               let target = model.elements.first(where: { $0.elementType == .character }) {
                model.focusedElementID = target.id
            }
            #endif
        }
        .onAppear { applyKeepAwake(settings.keepAwakeWhileWriting) }
        .onChange(of: settings.keepAwakeWhileWriting) { _, keepAwake in applyKeepAwake(keepAwake) }
        .onDisappear {
            applyKeepAwake(false)
            model.stopLiveUpdates()
            Task { await model.flushImmediately() }
        }
        .alert(
            "Couldn't save",
            isPresented: Binding(
                get: { if case .failed = model.saveState { return true }; return false },
                set: { if !$0 { Task { await model.flush() } } }
            ),
            actions: {
                Button("Try again") { Task { await model.flush() } }
                Button("OK", role: .cancel) {}
            },
            message: {
                if case .failed(let message) = model.saveState { Text(message) }
            }
        )
    }

    // MARK: - Page

    private var page: some View {
        LazyVStack(alignment: .leading, spacing: 0) {
            ForEach(model.elements) { element in
                let isFocused = model.focusedElementID == element.id
                ElementRow(
                    element: element,
                    pageWidth: columnWidth,
                    marginCompression: marginCompression,
                    fontSize: fontSize,
                    lineSpacingFactor: settings.editorLineSpacing.leadingFactor,
                    showsSceneNumber: settings.showSceneNumbers,
                    isFocused: isFocused,
                    height: elementHeights[element.id] ?? fontSize * 1.6,
                    onHeightChange: { elementHeights[element.id] = $0 },
                    onTextChange: { model.updateContent($0, for: element.id) },
                    onReturn: { model.insertElement(after: element.id) },
                    onBackspaceAtStart: { model.mergeBackwards(from: element.id) },
                    onFocus: { model.focusedElementID = element.id },
                    onBlur: {
                        if model.focusedElementID == element.id {
                            model.focusedElementID = nil
                        }
                    },
                    onChangeType: { model.changeType($0, for: element.id) },
                    onCycleType: { forward in
                        Haptics.selectionChanged()
                        let current = model.elements.first { $0.id == element.id }?.elementType ?? element.elementType
                        model.changeType(forward ? current.nextInCycle : current.previousInCycle, for: element.id)
                    },
                    onEscape: {
                        model.focusedElementID = nil
                    },
                    onDelete: { model.delete(id: element.id) }
                )
                .opacity(dimsOtherLines && !isFocused ? 0.32 : 1)
                .animation(.easeOut(duration: 0.2), value: dimsOtherLines && !isFocused)
                .id(element.id)
            }

            // Tapping the space under the last line adds a new one, the way
            // tapping below the text does in a notes app.
            Button {
                if let last = model.elements.last, last.isEmpty {
                    model.focusedElementID = last.id
                } else {
                    model.appendElement(type: .action)
                }
            } label: {
                Color.clear
                    .frame(height: showsPaper ? 100 : 140)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add a line at the end")
        }
    }

    // MARK: - Options

    private var optionsMenu: some View {
        Menu {
            Button {
                isShowingSceneList = true
            } label: {
                Label("Jump to Scene", systemImage: "list.bullet.indent")
            }
            .disabled(model.sceneIndex.isEmpty)

            Button {
                isShowingStats = true
            } label: {
                Label("Script Statistics", systemImage: "chart.bar")
            }

            Button {
                shareFountain()
            } label: {
                Label("Share as Fountain…", systemImage: "square.and.arrow.up")
            }
            .disabled(model.elements.isEmpty)

            Divider()

            Menu {
                ForEach([1.6, 1.3, 1.15, 1.0, 0.9, 0.8], id: \.self) { scale in
                    Button {
                        settings.editorScale = scale
                        Haptics.selectionChanged()
                    } label: {
                        if abs(settings.clampedEditorScale - scale) < 0.01 {
                            Label("\(Int(scale * 100))%", systemImage: "checkmark")
                        } else {
                            Text("\(Int(scale * 100))%")
                        }
                    }
                }
            } label: {
                Label("Text Size", systemImage: "textformat.size")
            }

            Picker(selection: $settings.editorLineSpacing) {
                ForEach(EditorLineSpacing.allCases) { spacing in
                    Text(spacing.label).tag(spacing)
                }
            } label: {
                Label("Line Spacing", systemImage: "text.line.spacing")
            }
            .pickerStyle(.menu)

            Toggle(isOn: $settings.focusMode) {
                Label("Focus Mode", systemImage: "scope")
            }
            Toggle(isOn: $settings.typewriterScrolling) {
                Label("Typewriter Scrolling", systemImage: "text.aligncenter")
            }
            if isWide {
                Toggle(isOn: $settings.editorPaper) {
                    Label("Paper Page", systemImage: "doc")
                }
            }
            Toggle(isOn: $settings.showElementBar) {
                Label("Element Bar", systemImage: "keyboard")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .tappableArea()
        }
        .accessibilityLabel("Editor options")
    }

    private func shareFountain() {
        do {
            let url = try FountainExporter.temporaryFile(
                title: scriptTitle,
                author: auth.profile?.bestName,
                elements: model.elements
            )
            sharedFile = SharedFile(url: url)
            Haptics.tap()
        } catch {
            exportError = error.localizedDescription
        }
    }

    private func applyKeepAwake(_ keepAwake: Bool) {
        UIApplication.shared.isIdleTimerDisabled = keepAwake
    }

    private var focusedElement: ScriptElement? {
        guard let id = model.focusedElementID else { return nil }
        return model.elements.first { $0.id == id }
    }

    /// Character names offered above the keyboard, filtered by what's typed.
    private var characterSuggestions: [String] {
        guard let element = focusedElement, element.elementType == .character else { return [] }
        let typed = element.content.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let names = model.knownCharacterNames.filter { $0 != typed }
        guard !typed.isEmpty else { return Array(names.prefix(6)) }
        return Array(names.filter { $0.hasPrefix(typed) }.prefix(6))
    }
}

// MARK: - Element row

private struct ElementRow: View {
    let element: ScriptElement
    let pageWidth: CGFloat
    /// 1.0 for real screenplay margins; less on a phone.
    let marginCompression: CGFloat
    let fontSize: CGFloat
    let lineSpacingFactor: CGFloat
    let showsSceneNumber: Bool
    let isFocused: Bool
    let height: CGFloat
    let onHeightChange: (CGFloat) -> Void
    let onTextChange: (String) -> Void
    let onReturn: () -> Void
    let onBackspaceAtStart: () -> Void
    let onFocus: () -> Void
    let onBlur: () -> Void
    let onChangeType: (ScriptElementType) -> Void
    let onCycleType: (Bool) -> Void
    let onEscape: () -> Void
    let onDelete: () -> Void

    @State private var text: String = ""

    private var leadingInset: CGFloat {
        pageWidth * element.elementType.leadingFraction * marginCompression
    }

    private var trailingInset: CGFloat {
        pageWidth * element.elementType.trailingFraction * marginCompression
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: element.elementType.spacingAbove * 0.6)

            HStack(alignment: .top, spacing: 0) {
                // Scene-number badge for scene headings.
                if showsSceneNumber,
                   element.elementType == .sceneHeading,
                   let num = element.sceneNumber?.nonEmpty {
                    Text(num)
                        .font(.system(size: max(9, fontSize * 0.7), weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.accent)
                        .frame(width: fontSize * 2, height: fontSize * 1.6)
                        .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .padding(.trailing, 6)
                        .accessibilityLabel("Scene \(num)")
                }

                ZStack(alignment: alignmentForPlaceholder) {
                    if text.isEmpty {
                        Text(element.elementType.placeholder)
                            .font(Font(ScreenplayTextView.screenplayFont(
                                size: fontSize, bold: element.elementType.isBold
                            )))
                            .foregroundStyle(element.elementType.textColor.opacity(0.3))
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }

                    ScreenplayTextView(
                        text: $text,
                        elementType: element.elementType,
                        fontSize: fontSize,
                        lineSpacingFactor: lineSpacingFactor,
                        isFocused: isFocused,
                        onHeightChange: onHeightChange,
                        onReturn: onReturn,
                        onBackspaceAtStart: onBackspaceAtStart,
                        onFocusChange: { $0 ? onFocus() : onBlur() },
                        onCycleType: onCycleType,
                        onSetType: onChangeType,
                        onEscape: onEscape
                    )
                    .frame(height: height)
                }
            }
            .padding(.leading, leadingInset)
            .padding(.trailing, trailingInset)
        }
        .padding(.vertical, 1)
        .background(alignment: .leading) {
            if let accentColor = element.elementType.leftAccentColor {
                // Persistent accent bar for notes and similar types.
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(accentColor)
                    .frame(width: 2.5)
                    .offset(x: -10)
            }
            // A left rule marks the focused line without moving anything.
            if isFocused {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(Theme.accent)
                    .frame(width: 3)
                    .offset(x: -12)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.15), value: isFocused)
        .contextMenu {
            Menu {
                ForEach(ScriptElementType.standardCycle, id: \.self) { type in
                    Button {
                        onChangeType(type)
                    } label: {
                        Label(type.label, systemImage: type.symbol)
                    }
                    .disabled(type == element.elementType)
                }
            } label: {
                Label("Change type", systemImage: "textformat")
            }

            Button(role: .destructive, action: onDelete) {
                Label("Delete line", systemImage: "trash")
            }
        }
        .onAppear { text = element.content }
        .onChange(of: element.content) { _, newValue in
            if newValue != text { text = newValue }
        }
        .onChange(of: text) { _, newValue in
            onTextChange(newValue)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(element.elementType.label). \(element.content.isEmpty ? "Empty" : element.content)")
    }

    private var alignmentForPlaceholder: Alignment {
        switch element.elementType.alignment {
        case .leading:  return .topLeading
        case .center:   return .top
        case .trailing: return .topTrailing
        }
    }
}
