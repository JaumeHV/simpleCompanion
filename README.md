# simpleCompanion

## SCOPE
This module aims to create way for players to use a dedicated small touch 
display as a companion interface, created for use in a specific setup to 
enhance inperson play where interaction with a main screen is not viable.


## FEATURES
- Player-specific UI configurable for custom displays
- Popout-based character sheets, turn order, chat interaction and other
  static elements
- Custom local tactical viewport intended for viewing the combat state
  and placing templates
- Utilise touch-based placement and confirmation interactions


## RELEASE FLOW
- Script: `scripts/release.ps1`
- Prerequisites:
  - Clean working tree on `main`
  - `git` configured with push access to `origin`
  - `gh` installed and authenticated (`gh auth login`) for release creation
- Default behavior:
  - Calculates the next patch tag from existing tags (for example `v0.0.29` -> `v0.0.30`)
  - Updates `module.json` `version` and `download`
  - Commits all current changes
  - Pushes `main`
  - Creates and pushes the new tag
  - Creates a GitHub release for the new tag
- Usage examples:
  - Full release: `powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -Message "release: v0.0.30"`
  - Skip GitHub release (no `gh`): `powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -SkipRelease`
  - Skip branch push: `powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -SkipPush`


## LICENSE
As I (the Author) created this module for a very specific purpose and 
have no plans to maintain or extend its functionality outside of this 
use case, it is distributed under the Unlicense License as I believe it
may be useful for others and it's not that hard to replicate anyway.

The author encourages any interested parties to modify it as they wish.

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

Have fun fellow nerds.
