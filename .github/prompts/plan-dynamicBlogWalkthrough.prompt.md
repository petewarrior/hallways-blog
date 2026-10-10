## Plan: Dynamic Blog Walkthrough

Build the requested first-version flow as one coherent A-Frame app: the user starts in a post-count-driven polygon lobby, walks through a post doorway into a streamed GLTF hallway, then reaches a cubic reading room whose canvas-textured plane displays the post. The hallway stops growing only after the canvas and its image resources have loaded or failed. Reuse and consolidate the existing room, navigation, and hallway modules rather than keeping the competing `main.js` room implementation.

**Steps**

**Phase 1: Content and startup**
1. Add `content/posts/index.json` as the static-hosting manifest of Markdown files and replace the parser's hard-coded filename array with manifest loading. Preserve the existing front-matter data and Markdown body needed by the lobby and renderer.
2. Make `main.js` the coordinator that initializes the selected room/navigation path once content and the scene are ready. Start the player at the lobby center; put movement on the tracked rig and keep camera look controls on the camera so proximity/crossing checks observe actual movement.

**Phase 2: Lobby and reading surface**
3. Refactor `RoomGenerator` to build a regular lobby polygon whose side count follows the successfully loaded post count (minimum three sides for a walkable shell; zero posts gets an empty state). Create one physical opening/doorway per post and arrange labels and door triggers consistently. Scale the lobby radius so door openings remain usable as counts grow. This replaces category and recent-post selection in the v1 lobby.
4. Add a focused canvas-rendering module, such as `src/post-canvas.js`, that draws a selected post's title, metadata, Markdown blocks, and images into a fixed-size hidden canvas. Support scrolling for long posts and expose a readiness promise. Use same-origin or CORS-enabled images; draw a placeholder and settle readiness on failed images so loading cannot hang.

**Phase 3: Corridor transition and return**
5. Extend `Navigation` so walking through a lobby doorway selects its post and starts the loading transition; prevent duplicate triggers while changing rooms. Refactor `HallwayLoader` to extend a corridor from repeated `hallway_4x4x10.gltf` segments as the player approaches its end, with no fixed five-segment cap.
6. Run canvas/image preparation while the corridor grows. Once readiness settles, stop extension, close the corridor at its terminal boundary, and construct a 4x4x4 room with an entrance from the corridor and the canvas-textured article plane. Keep the physical corridor path available for walking back; make the existing back control and Escape return directly to the lobby as well.
7. Update `index.html` and `styles.css` for the scene containers, hidden canvas source, player start/control placement, and back/loading UI. Update `README.md` to describe the new post manifest, movement, loading, and return behavior; remove obsolete category-room claims.

**Phase 4: Verification**
8. Validate the full flow in a browser served over HTTP: correct lobby start and N post doors, walking through each door, hallway segment continuity, room transition after images load/fail, readable/scrollable canvas, and both return routes. Exercise zero, one, two, three, and current six-post manifests; verify a larger manifest scales door spacing and lobby radius without overlapping openings. Check browser console and network errors, including denied CORS images.

**Relevant files**
- `/home/arya/hallways/main.js` — replace the currently active duplicate room flow with initialization/orchestration for the modular path.
- `/home/arya/hallways/index.html` and `/home/arya/hallways/styles.css` — scene containers, player/canvas setup, and navigation/loading UI.
- `/home/arya/hallways/src/content-parser.js` and new `/home/arya/hallways/content/posts/index.json` — manifest-driven post list and content data.
- `/home/arya/hallways/src/room-generator.js` — N-sided lobby, post doorways, terminal cubical room, canvas plane attachment.
- `/home/arya/hallways/src/navigation.js` — tracked doorway transitions, room state, physical and direct return behavior.
- `/home/arya/hallways/src/hallway-loader.js` — unbounded-as-needed segment streaming and terminal handoff.
- New `/home/arya/hallways/src/post-canvas.js` — hidden canvas drawing, scroll viewport, image/CORS handling, readiness signaling.
- `/home/arya/hallways/README.md` — revised first-version setup, content, and controls documentation.

**Decisions**
- Every indexed post gets one lobby doorway; categories and the recent-post limit are out of the v1 lobby flow.
- Use a static JSON manifest because the app is served statically and browsers cannot list a directory. Adding a Markdown file requires adding its path to the manifest.
- Keep at least a three-sided lobby for one or two posts; zero posts shows an empty state.
- Corridor completion waits for canvas rendering and image load/error settlement. Images use CORS-compatible sources or placeholders.
- Long posts scroll on one readable canvas plane. Readers can retrace the hallway or use the back control/Escape for direct return.
- Existing modules are scaffolding rather than a working integrated path: current `main.js` expects missing `lobby-room`/`category-room` elements; `RoomGenerator` and `Navigation` are not instantiated; `HallwayLoader` stops at five segments.
- There is no `package.json` or existing test suite, so the first-version verification gate is an HTTP-served browser walkthrough and console/network inspection.

**Scope boundaries**
- Included: desktop walk-through flow, A-Frame scene, Markdown post presentation, image fallbacks, room navigation and documentation.
- Excluded: WordPress/server-proxy integration, category rooms, a full Markdown/CSS browser renderer, automatic filesystem discovery, and new package/build tooling.
