# Changelog

## 3.1.0 (28.11.2026)
- Added Training: five guided lessons on the real board (plant Grass, burn the rival with Fire, put the fire out with Water, read any cell, win a 30-second match against a scripted rival). Skip asks before it leaves, and the help button opens Training again.
- The card you drag now shows its element name.
- **Breaking:** Removed the six-step tutorial dialog. Training replaces it and opens once for every visitor, including those who already finished the tutorial.

## 3.0.0 (19.11.2026)
- Added Elements Duel: a 60-second match against an AI on a 41×41 board. Drag cards from your hand onto your home, the third of the board nearest you. Whoever owns more cells at the end wins, and a tie goes to the human.
- Added Arena: every visitor plays the same AI, and each win counts for Humanity. You hold 3 tickets and one returns every 10 minutes. A bot check opens each match, and a scheduled job replays it on the server before it counts.
- Added Practice: the same match, free and not counted.
- Added the AI Falcon s1, trained only by playing against itself (163,840 matches). It runs in your browser.
- Added 38 elements whose behaviour comes from shared properties and reactions.
- Added the [Deck](./deck/) page: pick the 10 elements you bring, with Autofill.
- Added the [User](./user/) page: your Arena record and match history.
- Added a six-step tutorial for first-time visitors.
- Added Reset settings to [Settings](./settings/).
- The game now lives at https://elements.eccs.dev/.
- **Breaking:** Removed custom elements and `/scripts/elements.js`. The board runs the built-in elements only.
- **Breaking:** Renamed the Sandbox page to Playground (`/playground/`). The Information page is gone: `/information/` opens Settings, and element details are on the Deck page.

## 2.9.3 : Adaptive Core 2.8.6 (27.05.2024)
- Added element descriptions.
- Added element information page.

## 2.9.1 : Adaptive Core 2.8.3 (26.05.2024)
- Gameplay screenshot updated.
- FPS counter appearance improved.
- Guide added to [`/README.md`](./README.md)

## 2.9.0 : Adaptive Core 2.8.3 (25.05.2024)
- Core updated.
- Project rebuilt using the latest OOP structures.
- Rendering optimized by approximately 30%.
- Documentation for internal structures added.
- Fixed radius of the player corners.
- Fixed bug with player resizing.
- Fixed bug with page structure distortion.
- Smooth rendering of elements fixed.
- Page metadata improved.
- Design fixed for mobile devices.
- FPS counter color fixed.
- Player icon color fixed for light theme.
- Settings validation improved.
- Loading added.

## Update 2.6.4 (21.06.2023)
- Updated internal engine.
- Fixed design issues.
- Updated design layout.
- Improved adaptation for mobile devices.
- Enhanced internal modules.
- Changed rendering algorithm.
- Improved translation.

## Update 2.5.7 (17.05.2023)
- Improved internal engine.
- Fixed rendering issue.

## Update 2.5.5 (04.02.2023)
- Added the ability to take a snapshot of the board.
- Added the option to change the game loop in the settings.
- Fixed a version compatibility issue with settings.
- Improved design.

## Patch 2.5.3 (31.01.2023)
- Fixed design issues where the board with a size of 101 or larger would go beyond the page boundaries.
- Adapted the control panel to different themes.

## Update 2.5.2 - Custom code support (30.01.2023)
- Improved HTML structure.
- Changed the sandbox icon.
- Updated styles.
- Fixed design issues.
- Added code descriptions.
- Improved modules for easier operation.
- Enhanced code structure.
- Reduced code redundancy.
- Added full support for user scripts.
- Optimized element counter functionality.
- Improved theme settings.
- Enhanced error descriptions.
- Removed unstable functions.
- Added a sample of user code.

## Update 2.1.6 (20.11.2022)
- Added the ability to change the absolute frames per second (FPS) count in the settings menu.
- Accelerated the operation of settings and saves.
- Changed the icon on the main page.
- Added icons at the top of the pages.
- Activated a safe mode to preserve data integrity in case of errors.
- Available update check when connected to the internet from the settings menu.

## Update 2.1.3 (13.11.2022)
- Now it is possible to hide elements with a zero count in the element counter.
- Improved settings structure.
- Enhanced dropdown menu structure in the settings.

## Update 2.1.2
- Added a settings section.
- The theme can be changed in the settings.
- The FPS counter can be hidden or shown in the settings.
- The element counter can be hidden or shown in the settings.
- The board size can be changed in the settings.
- Fixed internal program structure.
- Fixed styles.
- Added effects.
- Fixed fonts.
- Added warning hints about data loss.
- Changed the color of the Dirt element (previously Void).
- Optimized program performance.
- Fixed the movement indicator for the board.

## Update 2.0.5
- Updated design.
- Added a dark theme (internal toggle).
- Changed the structure of the elements.
- Fixed an issue with incorrect layer rendering.
- Added small effects.

## Update 2.0.2
- Added color for the FPS counter.
- Added an element table.
- Improved board structure.

## Update 2.0.0
- The game has been rewritten in JS (with JSDoc support).
- The entire game structure has been changed.
- Dynamic internal interactions have been added (for now).
- Custom elements have been added.
- The FPS counter has been added.

...