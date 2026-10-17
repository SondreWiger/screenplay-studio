import Foundation

/// The web app's public pages the phone links to.
enum AppLinks {
    static let website = URL(string: "https://screenplaystudio.fun")!
    static let privacy = website.appendingPathComponent("legal/privacy")
    static let terms = website.appendingPathComponent("legal/terms")
    static let support = URL(string: "mailto:support@screenplaystudio.fun")!
}
