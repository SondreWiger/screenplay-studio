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

    @State private var elementHeights: [String: CGFloat] = [:]
    @State private var isShowingSceneList = false
    @State private var isShowingStats = false
    /// Page width measured once, used to convert margin fractions to points.
    @State private var pageWidth: CGFloat = 0

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

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(model.elements) { element in
                        ElementRow(
                            element: element,
                            pageWidth: pageWidth,
                            fontSize: fontSize,
                            isFocused: model.focusedElementID == element.id,
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
                            onDelete: { model.delete(id: element.id) }
                        )
                        .id(element.id)
                    }

                    // Tapping the space under the last line adds a new one, the
                    // way tapping below the text does in a notes app.
                    Button {
                        if let last = model.elements.last, last.isEmpty {
                            model.focusedElementID = last.id
                        } else {
                            model.appendElement(type: .action)
                        }
                    } label: {
                        Color.clear
                            .frame(height: 140)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add a line at the end")
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .background(
                    GeometryReader { geometry in
                        Color.clear
                            .onAppear { pageWidth = geometry.size.width - 36 }
                            .onChange(of: geometry.size.width) { _, width in
                                pageWidth = width - 36
                            }
                    }
                )
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .onChange(of: model.focusedElementID) { _, id in
                guard let id else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(id, anchor: .center)
                }
            }
            .overlay {
                if model.isLoading && model.elements.isEmpty {
                    ProgressView().tint(Theme.textTertiary)
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

private struct ElementRow: View {
    let element: ScriptElement
    let pageWidth: CGFloat
    let fontSize: CGFloat
    let isFocused: Bool
    let height: CGFloat
    let onHeightChange: (CGFloat) -> Void
    let onTextChange: (String) -> Void
    let onReturn: () -> Void
    let onBackspaceAtStart: () -> Void
    let onFocus: () -> Void
    let onBlur: () -> Void
    let onChangeType: (ScriptElementType) -> Void
    let onDelete: () -> Void

    @State private var text: String = ""

    /// Full screenplay margins are unreadable on a 390pt screen — a character
    /// cue would start two-thirds of the way across. They're compressed to 55%
    /// so the shape of the page survives without squeezing dialogue into a
    /// column three words wide. This matches what the web app does at its
    /// mobile breakpoint.
    private static let marginCompression: CGFloat = 0.55

    private var leadingInset: CGFloat {
        pageWidth * element.elementType.leadingFraction * Self.marginCompression
    }

    private var trailingInset: CGFloat {
        pageWidth * element.elementType.trailingFraction * Self.marginCompression
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
                        onHeightChange: onHeightChange,
                        onReturn: onReturn,
                        onBackspaceAtStart: onBackspaceAtStart,
                        onFocusChange: { $0 ? onFocus() : onBlur() }
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
