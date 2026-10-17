import SwiftUI

/// The screenplay editor.
///
/// Laid out as a vertical stack of typed elements rather than one big text
/// field, which is what makes correct screenplay formatting possible: each
/// element knows its own margins, casing and what Return should create next.
struct ScriptEditorView: View {

    let projectID: String
    let scriptID: String
    let scriptTitle: String

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var settings: AppSettings
    @StateObject private var model: EditorViewModel

    @State private var isShowingSceneList = false
    @State private var isShowingStats = false
    /// Width of the scroll view, measured; everything about the page's
    /// geometry follows from it.
    @State private var containerWidth: CGFloat = 0

    init(projectID: String, scriptID: String, scriptTitle: String) {
        self.projectID = projectID
        self.scriptID = scriptID
        self.scriptTitle = scriptTitle
        _model = StateObject(wrappedValue: EditorViewModel(projectID: projectID, scriptID: scriptID))
    }

    private var fontSize: CGFloat {
        // 12pt is the screenplay standard; on a 390pt-wide phone that leaves
        // roughly 50 characters per line, so the default nudges up slightly and
        // the reader can trim it in Settings.
        13 * settings.clampedEditorScale
    }

    /// 6.5 inches of Courier at the editor's size: the live area of a real
    /// screenplay page.
    private var fullPageWidth: CGFloat { fontSize * 39 }

    /// Room for a whole page with margins round it — an iPad, or a large
    /// phone in landscape. Then the script is laid out as a page, with the
    /// real margins; narrower than that it fills the screen with compressed
    /// ones.
    private var showsPage: Bool {
        containerWidth >= fullPageWidth + fontSize * 9 + 48
    }

    private var pageWidth: CGFloat {
        showsPage ? fullPageWidth : max(0, containerWidth - 36)
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(model.elements) { element in
                        ElementRow(
                            element: element,
                            pageWidth: pageWidth,
                            marginScale: showsPage ? 1 : 0.55,
                            fontSize: fontSize,
                            isFocused: model.focusedElementID == element.id,
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
                            onDelete: { model.delete(id: element.id) }
                        )
                        .equatable()
                        .id(element.id)
                    }

                    // Tapping the space under the last line adds a new one, the
                    // way tapping below the text does in a notes app. Hidden
                    // until the script has loaded, so a failed load can't be
                    // "fixed" by typing into what looks like an empty script.
                    if !model.elements.isEmpty {
                        Button {
                            if let last = model.elements.last, last.isEmpty {
                                model.focusedElementID = last.id
                            } else {
                                model.appendElement(type: .action)
                            }
                        } label: {
                            Color.clear
                                .frame(height: 140)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add a line at the end")
                    }
                }
                .frame(width: showsPage ? pageWidth : nil)
                .padding(.horizontal, showsPage ? fontSize * 4.5 : 18)
                .padding(.top, showsPage ? fontSize * 3 : 12)
                .background {
                    if showsPage {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Theme.Surface.s900)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .strokeBorder(Theme.border, lineWidth: 1)
                            )
                    }
                }
                .padding(.vertical, showsPage ? 24 : 0)
                .frame(maxWidth: .infinity)
            }
            .background(
                GeometryReader { geometry in
                    Color.clear
                        .onAppear { containerWidth = geometry.size.width }
                        .onChange(of: geometry.size.width) { width in
                            containerWidth = width
                        }
                }
            )
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .onChange(of: model.focusedElementID) { id in
                guard let id else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(id, anchor: .center)
                }
            }
            .overlay {
                if model.isLoading && model.elements.isEmpty {
                    ProgressView().tint(Theme.textTertiary)
                } else if let error = model.errorMessage, model.elements.isEmpty {
                    ErrorStateView(message: error) { Task { await model.retry() } }
                }
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
                Menu {
                    Button {
                        isShowingSceneList = true
                    } label: {
                        Label("Jump to scene", systemImage: "list.bullet.indent")
                    }
                    .disabled(model.sceneIndex.isEmpty)

                    Button {
                        isShowingStats = true
                    } label: {
                        Label("Script statistics", systemImage: "chart.bar")
                    }

                    Divider()

                    Menu {
                        ForEach([1.6, 1.3, 1.15, 1.0, 0.9, 0.8], id: \.self) { scale in
                            Button {
                                settings.editorScale = scale
                                Haptics.selectionChanged()
                            } label: {
                                Label(
                                    "\(Int(scale * 100))%",
                                    systemImage: abs(settings.clampedEditorScale - scale) < 0.01
                                        ? "checkmark" : ""
                                )
                            }
                        }
                    } label: {
                        Label("Text size", systemImage: "textformat.size")
                    }

                    Toggle(isOn: $settings.showElementBar) {
                        Label("Element bar", systemImage: "keyboard")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .tappableArea()
                }
                .accessibilityLabel("Editor options")
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
        .onDisappear {
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

private struct ElementRow: View, Equatable {
    let element: ScriptElement
    let pageWidth: CGFloat
    /// 1 on a full page; less where the screen is too narrow for real margins.
    let marginScale: CGFloat
    let fontSize: CGFloat
    let isFocused: Bool
    let onTextChange: (String) -> Void
    let onReturn: () -> Void
    let onBackspaceAtStart: () -> Void
    let onFocus: () -> Void
    let onBlur: () -> Void
    let onChangeType: (ScriptElementType) -> Void
    let onDelete: () -> Void

    @State private var text: String

    init(
        element: ScriptElement,
        pageWidth: CGFloat,
        marginScale: CGFloat,
        fontSize: CGFloat,
        isFocused: Bool,
        onTextChange: @escaping (String) -> Void,
        onReturn: @escaping () -> Void,
        onBackspaceAtStart: @escaping () -> Void,
        onFocus: @escaping () -> Void,
        onBlur: @escaping () -> Void,
        onChangeType: @escaping (ScriptElementType) -> Void,
        onDelete: @escaping () -> Void
    ) {
        self.element = element
        self.pageWidth = pageWidth
        self.marginScale = marginScale
        self.fontSize = fontSize
        self.isFocused = isFocused
        self.onTextChange = onTextChange
        self.onReturn = onReturn
        self.onBackspaceAtStart = onBackspaceAtStart
        self.onFocus = onFocus
        self.onBlur = onBlur
        self.onChangeType = onChangeType
        self.onDelete = onDelete
        // Seeded here rather than in `onAppear`, so a row is laid out once with
        // its text instead of empty and then again.
        _text = State(initialValue: element.content)
    }

    /// Rows compare on what they draw. The closures are rebuilt on every
    /// editor redraw but only ever act on this row's id, so leaving them out
    /// lets SwiftUI skip every line a keystroke didn't touch.
    static func == (lhs: ElementRow, rhs: ElementRow) -> Bool {
        lhs.element == rhs.element
            && lhs.pageWidth == rhs.pageWidth
            && lhs.marginScale == rhs.marginScale
            && lhs.fontSize == rhs.fontSize
            && lhs.isFocused == rhs.isFocused
    }

    /// Full screenplay margins are unreadable on a 390pt screen — a character
    /// cue would start two-thirds of the way across. On a phone they're
    /// compressed (`marginScale` 0.55) so the shape of the page survives
    /// without squeezing dialogue into a column three words wide, matching
    /// the web app's mobile breakpoint. With room for a page they're real.
    private var leadingInset: CGFloat {
        pageWidth * element.elementType.leadingFraction * marginScale
    }

    private var trailingInset: CGFloat {
        pageWidth * element.elementType.trailingFraction * marginScale
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: element.elementType.spacingAbove * 0.6)

            HStack(alignment: .top, spacing: 0) {
                // Scene-number badge for scene headings.
                if element.elementType == .sceneHeading,
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
                        isFocused: isFocused,
                        onReturn: onReturn,
                        onBackspaceAtStart: onBackspaceAtStart,
                        onFocusChange: { $0 ? onFocus() : onBlur() },
                        onSetType: onChangeType
                    )
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
        .onChange(of: element.content) { newValue in
            if newValue != text { text = newValue }
        }
        .onChange(of: text) { newValue in
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
