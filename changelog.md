# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Planned improvements
1. Patient Data Integration: Will trial a sandbox version that can pull patient data objects from one of the VA's Developer Lighthouse APIs, directly into the chart data. This is going to require actually tracking the patient and having oauth tokens. 

### VERSIONS
2025-04-21: v1.1.0:  - Switched to ggml-medium.en.bin from ggml-small.en.bin for greater transcription accuracy.
                     - Switched to returning more complex json files with metadata instead of plain text, allowing for feedback on confidence of transcription. User can now also correct transcription before copying to clipboard.
                     - Changed default prompts to a two step approach. Prompt will have GPT first try to correct obvious errors in transcription and categorize all statements in the transcript, and ask user to review the cleaned up, categorized transcript before making the note, with a goal of improving accuracy and reducing hallucination (categorizing statements prior to note creation seems to help this).

2025-04-16: v1.0.0:  First stable release of SimpleScribeVA. Based on Whisper.cpp and intended to be used without a direct connection to any outside system. The user transcribes entirely on their computer, and can then copy over the transcript plus prompr plus optional chart data to the LLM of their choosing. This was intended for security and simplicity.

### Added
### Changed
### Deprecated
### Removed
### Fixed
