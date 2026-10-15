import SwiftUI

@main
struct FloodSetuApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
                .tint(Theme.sos)
        }
    }
}

enum Theme {
    static let bg = Color(red: 0.035, green: 0.043, blue: 0.059)
    static let panel = Color(red: 0.075, green: 0.086, blue: 0.11)
    static let raised = Color(red: 0.11, green: 0.125, blue: 0.157)
    static let line = Color.white.opacity(0.08)
    static let text = Color(red: 0.93, green: 0.92, blue: 0.89)
    static let mute = Color(red: 0.55, green: 0.57, blue: 0.62)
    static let sos = Color(red: 1.0, green: 0.36, blue: 0.22)
    static let water = Color(red: 1.0, green: 0.17, blue: 0.33)
    static let warn = Color(red: 1.0, green: 0.72, blue: 0.2)
    static let safe = Color(red: 0.0, green: 0.71, blue: 0.58)
    static let info = Color(red: 0.31, green: 0.47, blue: 1.0)
    static let lime = Color(red: 0.92, green: 0.99, blue: 0.45)

    static func urgency(_ u: String?) -> Color {
        switch u { case "critical": return sos; case "urgent": return warn; default: return info }
    }
}

/// First launch asks one question. The choice is remembered; "Switch" in the corner changes it.
struct RootView: View {
    @AppStorage("role") private var role: String = ""

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            switch role {
            case "victim": VictimHome(onSwitch: { role = "" })
            case "rescuer": RescuerRoot(onSwitch: { role = "" })
            default: RolePicker(role: $role)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: role)
    }
}

struct RolePicker: View {
    @Binding var role: String
    @State private var showSettings = false

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Logo()
                Spacer()
                Button { showSettings = true } label: { Image(systemName: "gearshape").font(.title3).foregroundStyle(Theme.mute) }
                    .accessibilityLabel("Settings")
            }
            Spacer()
            Text("How can we help?")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            BigChoice(title: "I need help", subtitle: "Send an SOS. No login needed.", icon: "sos", color: Theme.sos) { role = "victim" }
            BigChoice(title: "I'm a rescuer", subtitle: "See your task and update the control room.", icon: "ferry.fill", color: Theme.info) { role = "rescuer" }

            Spacer()
            Call112()
        }
        .padding(20)
        .sheet(isPresented: $showSettings) { SettingsSheet() }
    }
}

struct BigChoice: View {
    let title: String, subtitle: String, icon: String, color: Color
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 28, weight: .semibold))
                    .frame(width: 60, height: 60)
                    .background(color.opacity(0.18), in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                    Text(subtitle).font(.subheadline).foregroundStyle(Theme.mute).multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.mute)
            }
            .padding(18)
            .background(Theme.panel, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.line))
        }
        .buttonStyle(Pressable())
    }
}

struct Logo: View {
    var body: some View {
        HStack(spacing: 8) {
            Image("Mark").resizable().scaledToFit().frame(width: 28, height: 28).accessibilityHidden(true)
            Text("FloodSetu").font(.headline).foregroundStyle(Theme.text)
        }
    }
}

struct Call112: View {
    var body: some View {
        Link(destination: URL(string: "tel://112")!) {
            Label("Life-threatening? Also call 112", systemImage: "phone.fill")
                .font(.callout.weight(.medium))
                .foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity, minHeight: 52)
                .overlay(Capsule().stroke(Theme.line, lineWidth: 1.5))
        }
    }
}

struct Pressable: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Only needed on a real phone: point the app at the laptop running `pnpm dev`.
struct SettingsSheet: View {
    @AppStorage("serverURL") private var server = "http://localhost:3000"
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("http://192.168.1.10:3000", text: $server)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                } header: { Text("Server") } footer: {
                    Text("Simulator: http://localhost:3000. On a real iPhone use the laptop's Network address printed by `pnpm dev`.")
                }
                Section { LabeledContent("Device ID", value: String(Device.id.prefix(16)) + "…") }
            }
            .navigationTitle("Settings")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
