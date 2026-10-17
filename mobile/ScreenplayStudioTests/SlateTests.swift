import XCTest
@testable import Screenplay_Studio

@MainActor
final class SlateTests: XCTestCase {

    func testRollIncrement() {
        XCTAssertEqual(SlateViewModel.incremented("A001"), "A002")
        XCTAssertEqual(SlateViewModel.incremented("A009"), "A010")
        XCTAssertEqual(SlateViewModel.incremented("A999"), "A1000")
        XCTAssertEqual(SlateViewModel.incremented("R1"), "R2")
        XCTAssertEqual(SlateViewModel.incremented("B_007"), "B_008")
        XCTAssertEqual(SlateViewModel.incremented("ROLL"), "ROLL1")
        XCTAssertEqual(SlateViewModel.incremented(""), "1")
    }

    func testSetupLetters() {
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: ""), "A")
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: "A"), "B")
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: "b"), "C")
        // I and O read as 1 and 0 on a board, so they're skipped.
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: "H"), "J")
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: "N"), "P")
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: "Z"), "AA")
        XCTAssertEqual(SlateViewModel.nextSetupLabel(after: "3"), "4")
    }

    func testSetupFromShotNumber() {
        func shot(_ number: String?) -> Shot {
            Shot(id: "s", projectID: "p", shotNumber: number)
        }
        XCTAssertEqual(SlateViewModel.setupLabel(for: shot("12A"), scene: "12"), "A")
        XCTAssertEqual(SlateViewModel.setupLabel(for: shot("12-3"), scene: "12"), "3")
        XCTAssertEqual(SlateViewModel.setupLabel(for: shot("3"), scene: "12"), "3")
        XCTAssertEqual(SlateViewModel.setupLabel(for: shot("b"), scene: "12"), "B")
        XCTAssertEqual(SlateViewModel.setupLabel(for: shot(nil), scene: "12"), "")
    }

    func testBoardSavedByAnOlderBuildStillRestores() throws {
        let legacy = """
        {"production":"The Long Winter","director":"Ida","camera":"Ola","roll":"A004","scene":"12","take":7,
         "isInterior":false,"isDay":true,"isMOS":false,"linkedShotID":"shot-1"}
        """
        let state = try JSONDecoder().decode(SlateState.self, from: Data(legacy.utf8))
        XCTAssertEqual(state.roll, "A004")
        XCTAssertEqual(state.take, 7)
        XCTAssertFalse(state.isInterior)
        XCTAssertEqual(state.linkedShotID, "shot-1")
        XCTAssertEqual(state.shot, "")
        XCTAssertEqual(state.cameraUnit, "A")
        XCTAssertEqual(state.timecodeSource, .timeOfDay)
        XCTAssertTrue(state.logToCameraReport)
    }

    func testTakesSavedByAnOlderBuildStillRestore() throws {
        let legacy = """
        [{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","markedAt":781000000,"roll":"A001","scene":"4","take":2,
          "isMOS":true,"isCircled":true,"note":"Keep"}]
        """
        let takes = try JSONDecoder().decode([SlateTake].self, from: Data(legacy.utf8))
        XCTAssertEqual(takes.first?.label, "A001 / 4 / 2")
        XCTAssertEqual(takes.first?.isMOS, true)
        XCTAssertEqual(takes.first?.isCircled, true)
        XCTAssertNil(takes.first?.timecode)
    }

    func testJamSurvivesEncoding() throws {
        var state = SlateState()
        state.timecodeSource = .jam
        state.frameRate = .fps29_97DF
        state.jam = JamReference(frameIndex: 1_234, rate: .fps29_97DF, monotonic: MonotonicClock.now(), wallClock: Date(), origin: .manual)
        let restored = try JSONDecoder().decode(SlateState.self, from: JSONEncoder().encode(state))
        XCTAssertEqual(restored.timecodeSource, .jam)
        XCTAssertEqual(restored.frameRate, .fps29_97DF)
        XCTAssertEqual(restored.jam?.frameIndex, 1_234)
    }

    func testCSVQuotesWhatNeedsQuoting() {
        var state = SlateState()
        state.production = "Nightshift"
        state.roll = "A001"
        state.scene = "12"
        state.shot = "A"
        state.take = 3
        var take = SlateTake(
            markedAt: Date(timeIntervalSince1970: 1_791_000_000),
            state: state,
            timecode: Timecode.parse("10:42:17:08", rate: .fps25)
        )
        take.note = "Plane overhead, \"soft\" focus"
        take.isCircled = true

        let csv = SlateViewModel.csv(takes: [take], state: state)
        let lines = csv.components(separatedBy: "\r\n")
        XCTAssertTrue(lines[0].hasPrefix("Date,Time,Camera,Roll,Scene,Setup,Take,Timecode,FPS"))
        XCTAssertTrue(lines[1].contains(",A,A001,12,A,3,10:42:17:08,25,"))
        XCTAssertTrue(lines[1].contains(",yes,\"Plane overhead, \"\"soft\"\" focus\",Nightshift,"))
    }

    func testCameraReportGroupsByDayRollAndCamera() {
        var state = SlateState()
        state.roll = "B002"
        state.cameraUnit = "B"
        let take = SlateTake(markedAt: Date(), state: state, timecode: nil)
        let key = CameraReportKey(take)
        XCTAssertEqual(key.roll, "B002")
        XCTAssertEqual(key.camera, "B")
        XCTAssertEqual(key.date, SlateTake.dayFormatter.string(from: Date()))
    }
}
