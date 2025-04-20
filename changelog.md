# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Planned improvements
1. Whisper segments on new lines: Will separate Whisper segments with new lines, meaning the small 2-5 seconds natural phrases within the 30 or 45 second "chunk" that Whisper processes at a time. This will mean transcribe_chunk() will need to return a json file format with a list of segments, rather than just a txt file, and then monitor_chunks will need to send those to be appended. The rationale is to make the transcript more legible to both humans and GPT.
2. Two-step prompting to reduce hallucnation: A persistent issue is the risk of hallucination, especially around assuming certain clinical actions were taken or plans were made despite a lack of explicit discussion. By asking the GPT to first put every transcript lines into SOAP categories, and then using a second step to use these lines, the risk is reduced.
3. Patient Data Integration: Will trial a sandbox version that can pull patient data objects from one of the VA's Developer Lighthouse APIs, directly into the chart data. This is going to require actually tracking the patient and having oauth tokens. 

### VERSIONS
2025-04-16: v1.0.0:  First stable release of SimpleScribeVA. Based on Whisper.cpp and intended to be used without a direct connection to any outside system. The user transcribes entirely on their computer, and can then copy over the transcript plus prompr plus optional chart data to the LLM of their choosing. This was intended for security and simplicity.

### Added
### Changed
### Deprecated
### Removed
### Fixed
