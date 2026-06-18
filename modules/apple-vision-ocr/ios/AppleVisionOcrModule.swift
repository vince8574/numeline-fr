import ExpoModulesCore
import Vision
import UIKit

public class AppleVisionOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleVisionOcr")

    // recognizeText(uri): runs VNRecognizeTextRequest on the image at `uri`
    // and resolves the recognized text (lines joined by "\n"), or "" on failure.
    // Tuned for a low-latency preview "is there lot-like text?" trigger:
    //   - recognitionLevel = .fast      → minimal latency for the ~1.8s loop
    //   - usesLanguageCorrection = false → lot codes aren't words; correction hurts
    AsyncFunction("recognizeText") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri),
            let data = try? Data(contentsOf: url),
            let uiImage = UIImage(data: data),
            let cgImage = uiImage.cgImage else {
        promise.resolve("")
        return
      }

      let orientation = Self.cgOrientation(from: uiImage.imageOrientation)

      DispatchQueue.global(qos: .userInitiated).async {
        var didResolve = false
        let request = VNRecognizeTextRequest { (req, err) in
          didResolve = true
          if err != nil {
            promise.resolve("")
            return
          }
          guard let observations = req.results as? [VNRecognizedTextObservation] else {
            promise.resolve("")
            return
          }
          let text = observations
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
          promise.resolve(text)
        }
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        do {
          try handler.perform([request])
          if !didResolve { promise.resolve("") }
        } catch {
          if !didResolve { promise.resolve("") }
        }
      }
    }
  }

  // Map UIImage orientation → CGImagePropertyOrientation so Vision reads the
  // pixels the right way up (expo-camera snapshots carry EXIF orientation).
  private static func cgOrientation(from o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .upMirrored: return .upMirrored
    case .down: return .down
    case .downMirrored: return .downMirrored
    case .left: return .left
    case .leftMirrored: return .leftMirrored
    case .right: return .right
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
