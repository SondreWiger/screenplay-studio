import SwiftUI

// MARK: - Appearance

struct AppearanceSettingsView: View {

    @EnvironmentObject private var settings: AppSettings

    private let swatchColumns = [GridItem(.adaptive(minimum: 64), spacing: 12)]

    var body: some View {
        List {
            Section {
                HStack(spacing: 10) {
                    ForEach(AppearanceMode.allCases) { mode in
                        AppearanceTile(mode: mode, isSelected: settings.appearance == mode) {
                            Haptics.selectionChanged()
                            settings.appearance = mode
                        }
                    }
                }
                .padding(.vertical, 6)
                .listRowBackground(Theme.card)
            } header: {
                SettingsSectionHeader("Mode")
            } footer: {
                Text("System follows your device, switching to dark at night if you’ve set it to.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Section {
                LazyVGrid(columns: swatchColumns, spacing: 14) {
                    ForEach(AccentChoice.allCases) { choice in
                        AccentSwatch(choice: choice, isSelected: settings.accent == choice) {
                            Haptics.selectionChanged()
                            settings.accent = choice
                        }
                    }
                }
                .padding(.vertical, 8)
                .listRowBackground(Theme.card)
            } header: {
                SettingsSectionHeader("Accent colour")
            } footer: {
                Text("Used for buttons, the current line in the script, and anything selected.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Appearance")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AppearanceTile: View {
    let mode: AppearanceMode
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                preview
                    .frame(height: 74)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(isSelected ? Theme.accent : Theme.border, lineWidth: isSelected ? 2.5 : 1)
                    )
                HStack(spacing: 4) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(isSelected ? Theme.accent : Theme.textTertiary)
                    Text(mode.label)
                        .foregroundStyle(Theme.textPrimary)
                }
                .font(.footnote.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(mode.label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    /// A miniature page in the mode's colours. System shows both, split.
    @ViewBuilder
    private var preview: some View {
        switch mode {
        case .light:  MiniPage(dark: false)
        case .dark:   MiniPage(dark: true)
        case .system:
            HStack(spacing: 0) {
                MiniPage(dark: false)
                MiniPage(dark: true)
            }
        }
    }
}

private struct MiniPage: View {
    let dark: Bool

    var body: some View {
        ZStack(alignment: .topLeading) {
            Rectangle().fill(dark ? Color(hex: 0x0F0F1C) : Color.white)
            VStack(alignment: .leading, spacing: 5) {
                Capsule().fill(Theme.accent).frame(width: 26, height: 4)
                ForEach([0.8, 0.6, 0.7], id: \.self) { width in
                    Capsule()
                        .fill(dark ? Color.white.opacity(0.35) : Color.black.opacity(0.25))
                        .frame(height: 3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .scaleEffect(x: width, anchor: .leading)
                }
            }
            .padding(10)
        }
    }
}

private struct AccentSwatch: View {
    let choice: AccentChoice
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Circle()
                    .fill(choice.color)
                    .frame(width: 38, height: 38)
                    .overlay {
                        if isSelected {
                            Image(systemName: "checkmark")
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .padding(3)
                    .overlay(
                        Circle().strokeBorder(isSelected ? choice.color : .clear, lineWidth: 2)
                    )
                Text(choice.label)
                    .font(.caption2)
                    .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textTertiary)
            }
            .frame(minWidth: Theme.minTouchTarget, minHeight: Theme.minTouchTarget)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(choice.label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Writing

struct WritingSettingsView: View {

    @EnvironmentObject private var settings: AppSettings

    var body: some View {
        List {
            Section {
                ScriptSample(
                    scale: settings.clampedEditorScale,
                    spacing: settings.editorLineSpacing.leadingFactor
                )
                .listRowBackground(Theme.card)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Text size")
                            .foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Text("\(Int(settings.clampedEditorScale * 100))%")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.textTertiary)
                            .monospacedDigit()
                    }
                    Slider(
                        value: Binding(
                            get: { settings.clampedEditorScale },
                            set: { settings.editorScale = $0 }
                        ),
                        in: 0.75...1.6,
                        step: 0.05
                    ) {
                        Text("Text size")
                    } minimumValueLabel: {
                        Image(systemName: "textformat.size.smaller")
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                    } maximumValueLabel: {
                        Image(systemName: "textformat.size.larger")
                            .font(.caption)
                            .foregroundStyle(Theme.textTertiary)
                    }
                    .tint(Theme.accent)
                }
                .padding(.vertical, 4)
                .listRowBackground(Theme.card)

                Picker("Line spacing", selection: $settings.editorLineSpacing) {
                    ForEach(EditorLineSpacing.allCases) { spacing in
                        Text(spacing.label).tag(spacing)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.vertical, 4)
                .listRowBackground(Theme.card)
            } header: {
                SettingsSectionHeader("The page")
            } footer: {
                Text("Text size sits on top of the system text size, so the page can be smaller than the rest of the app when you want more words on screen.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Section {
                toggle("Paper page", detail: "On iPad and in landscape, the script sits on a sheet of paper at real screenplay margins.", isOn: $settings.editorPaper)
                toggle("Focus mode", detail: "Dims every line except the one you’re writing.", isOn: $settings.focusMode)
                toggle("Typewriter scrolling", detail: "Keeps the line you’re writing in the middle of the screen.", isOn: $settings.typewriterScrolling)
                toggle("Scene numbers", detail: "Shows the number beside each scene heading.", isOn: $settings.showSceneNumbers)
            } header: {
                SettingsSectionHeader("While writing")
            }

            Section {
                toggle("Element bar", detail: "Scene / action / character / dialogue switcher above the keyboard. With a hardware keyboard, Tab and ⇧Tab do the same.", isOn: $settings.showElementBar)
                toggle("Keep screen awake", detail: "The screen won’t lock while a script is open — useful on set.", isOn: $settings.keepAwakeWhileWriting)
            } header: {
                SettingsSectionHeader("Keyboard & screen")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Writing")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func toggle(_ title: String, detail: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Theme.accent)
        .padding(.vertical, 2)
        .listRowBackground(Theme.card)
        .onChange(of: isOn.wrappedValue) { _, _ in Haptics.selectionChanged() }
    }
}

/// A few lines of screenplay that preview the size and spacing settings.
private struct ScriptSample: View {
    let scale: Double
    let spacing: CGFloat

    private var size: CGFloat { 13 * scale }

    private func line(_ text: String, type: ScriptElementType, indent: CGFloat = 0) -> some View {
        Text(text)
            .font(Font(ScreenplayTextView.screenplayFont(size: size, bold: type.isBold)))
            .foregroundStyle(type.textColor)
            .lineSpacing(size * spacing)
            .padding(.leading, indent)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: size * 0.6) {
            line("EXT. HARBOUR - NIGHT", type: .sceneHeading)
            line("Ice groans against the hull. Maren lowers the lamp.", type: .action)
            VStack(alignment: .leading, spacing: 2) {
                line("MAREN", type: .character, indent: 90)
                line("You came back.", type: .dialogue, indent: 40)
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Preview of the script page")
        .animation(.easeOut(duration: 0.15), value: scale)
        .animation(.easeOut(duration: 0.15), value: spacing)
    }
}

// MARK: - Project tools

/// Reorder and hide the tools on a project's home screen.
struct HubToolsEditor: View {

    @EnvironmentObject private var settings: AppSettings
    @State private var order: [HubTool] = []

    var body: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "doc.text")
                        .foregroundStyle(Theme.accent)
                        .frame(width: 28)
                    Text("Script")
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text("Always first")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }
                .listRowBackground(Theme.card)

                ForEach(order) { tool in
                    HStack(spacing: 12) {
                        Image(systemName: tool.symbol)
                            .foregroundStyle(tool.tint)
                            .frame(width: 28)
                            .accessibilityHidden(true)
                        Text(tool.title)
                            .foregroundStyle(settings.hiddenHubTools.contains(tool) ? Theme.textTertiary : Theme.textPrimary)
                        Spacer()
                        Toggle(tool.title, isOn: Binding(
                            get: { !settings.hiddenHubTools.contains(tool) },
                            set: { visible in
                                Haptics.selectionChanged()
                                settings.setHubTool(tool, hidden: !visible)
                            }
                        ))
                        .labelsHidden()
                        .tint(Theme.accent)
                    }
                    .listRowBackground(Theme.card)
                }
                .onMove { source, destination in
                    order.move(fromOffsets: source, toOffset: destination)
                    settings.setHubToolOrder(order)
                    Haptics.selectionChanged()
                }
            } header: {
                SettingsSectionHeader("Drag to reorder")
            } footer: {
                Text("Hidden tools are still there — switch them back on any time. This layout applies to every project on this device.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Section {
                Button("Reset to Default") {
                    settings.resetHubTools()
                    order = settings.hubToolOrder
                    Haptics.tap()
                }
                .listRowBackground(Theme.card)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .environment(\.editMode, .constant(.active))
        .navigationTitle("Project Tools")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { order = settings.hubToolOrder }
    }
}
