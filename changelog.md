# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Planned improvements
1. Patient Data Integration: Will trial a sandbox version that can pull patient data objects from one of the VA's Developer Lighthouse APIs, directly into the chart data. This is going to require actually tracking the patient and having oauth tokens. Attempted this but some difficulty with getting the data to return properly. Regardless, given token limits and the size of a typical patient's chart when in FHIR format (significant amounts of metadata), good data integration is going to be a bigger project.
2. Consider switching to a PowerApp to keep integrated in the Microsoft Teams environment with which users are already familiar. Also, reduces risk of problems with this code and maintenance over time.

### VERSIONS
2025-04-28: v1.3.0: Switched back to whisper.cpp for now, using the ggml-small.en.bin model, still connecting to OpenAI. Can be swapped out by the user if they wish, but this seems like a reasonable compromise until able to access a secure transcription service like Azure. Various minor bug fixes. Won't release full package directly on here given connection to OpenAI subscription.

2025-04-23: v1.2.0: Added direct connection to Azure OpenAI. Attempted to use use Windows Speech Recognition for real-time transcription but the accuracy was insufficient. Won't release full package directly on here given connection to OpenAI subscription.

2025-04-22: v1.1.1: Minor bug fixes and updated the design. The bugs were that the notice of "Transcribing..." would not turn off even after transcription ended, and the transcripts were not displaying correctly. Minor improvements in the default prompts.

2025-04-21: v1.1.0:  - Switched to ggml-medium.en.bin from ggml-small.en.bin for greater transcription accuracy
                     - Switched to returning more complex json files with metadata instead of plain text, allowing for feedback on confidence of transcription
                     - Changed default prompts to a two step approach. Prompt will ask user to double check a cleaned up transcript before making the note, with a goal of improving accuracy and reducing hallucination (categorizing statements prior to note creation seems to help this)

2025-04-16: v1.0.0:  First stable release of SimpleScribeVA. Based on Whisper.cpp and intended to be used without a direct connection to any outside system. The user transcribes entirely on their computer, and can then copy over the transcript plus prompr plus optional chart data to the LLM of their choosing. This was intended for security and simplicity.

### Added
### Changed
### Deprecated
### Removed
### Fixed
