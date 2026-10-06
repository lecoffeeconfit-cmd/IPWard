# IPward companion result contract, version 1

The Protect → Deep Spyware Scan flow accepts a local JSON summary from a future desktop forensic analyzer. IPward does **not** create an encrypted backup, parse one on the phone, validate a desktop tool's authenticity, or certify that a phone is free of spyware. Keep the original backup and source artifacts outside this summary for independent review.

## Input

A desktop analyzer should work from a user-authorized encrypted iOS backup or Android export. It must preserve artifact source paths and observed timestamps. It should never infer a spyware family from a performance slowdown or a generic domain shape. The importer limits JSON to 5 MB, 1,000 artifacts, and 100 warnings.

```json
{
  "schemaVersion": 1,
  "type": "ipward-companion-result",
  "generatedAt": 1791240000000,
  "toolName": "Example forensic analyzer",
  "inputKind": "encrypted-ios-backup",
  "artifacts": [
    {
      "id": "artifact-001",
      "category": "network",
      "observedAt": 1791230000000,
      "summary": "An exact address appeared in a preserved backup record",
      "sourcePath": "backup/path/to/source.db",
      "indicator": "example.test"
    }
  ],
  "warnings": ["The backup did not include every protected operating-system artifact."]
}
```

`category` is one of `backup-record`, `process`, `profile`, `network`, `crash`, or `file`. `indicator` and `family` are optional strings. If `family` is present, IPward labels it as an **unverified claim**. An artifact becomes a review lead only when its indicator exactly matches a separately imported STIX2 entry; even then it is not a confirmed compromise. The app does not import raw backup data or upload this JSON. The user can export the resulting local scan report for a qualified examiner.

The JSON file should be produced by a trusted, independently verified workflow. A malicious or mistaken report can contain false claims; the mobile importer validates structure and bounds only.
