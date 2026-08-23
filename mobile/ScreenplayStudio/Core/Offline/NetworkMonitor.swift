import Foundation
import Network
import Combine

/// Publishes connectivity so the UI can show an offline bar and the sync queue
/// knows when to drain.
@MainActor
final class NetworkMonitor: ObservableObject {

    static let shared = NetworkMonitor()

    @Published private(set) var isOnline = true
    @Published private(set) var isExpensive = false
    @Published private(set) var isConstrained = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "no.northem.screenplaystudio.network")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                let online = path.status == .satisfied
                // Only publish real transitions — `pathUpdateHandler` fires on
                // interface changes that don't alter reachability.
                if self.isOnline != online { self.isOnline = online }
                self.isExpensive = path.isExpensive
                self.isConstrained = path.isConstrained
            }
        }
        monitor.start(queue: queue)
    }

    /// True on cellular or Low Data Mode — screens use it to skip prefetching
    /// images and to widen autosave debounce.
    var shouldConserveData: Bool { isExpensive || isConstrained }

    deinit { monitor.cancel() }
}
