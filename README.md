# Flow Studio

A Vue 3 conversation workflow editor built for the supplied frontend assessment. It displays the provided JSON as a draggable canvas, supports creating and editing three node types, and keeps edits in browser storage.

## Run locally

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify the app:

```bash
npm run test
npm run build
```

## How it works

- The starter data is a local copy of the supplied [assessment payload](https://respond-io-fe-bucket.s3.ap-southeast-1.amazonaws.com/candidate-assessments/payload.json) in `public/payload.json`. The app fetches it with TanStack Query. A local copy makes the initial flow reliable if the assessment bucket is unavailable or blocks cross-origin requests.
- Query mutations persist complete workflow snapshots to `localStorage`. There is no write API in the brief, so edits are scoped to the current browser. **Reset to sample** removes saved edits.
- Pinia keeps transient UI state and up to 30 undo snapshots. Vue Router maps `/nodes/:id` to the details drawer, so a node can be opened by URL. Vue Flow handles graph interaction and dragging.
- The source `trigger` and `dateTimeConnector` records appear on the canvas as part of the original graph. As requested, they do not open a details drawer.
- The app preserves source payload fields. New nodes use the chosen title and description to initialize relevant message or comment content and may be connected after an existing node. Deleting a node leaves its children unconnected.
- Attachments are saved as browser data URLs with a 2 MB file limit to stay within practical browser storage limits. Existing remote attachments remain linked to their original URL.

## Controls

Click an editable node to open its details. Drag nodes to rearrange the canvas; scroll to zoom. Use the toolbar or `⌘/Ctrl+Z` to undo and `⌘/Ctrl+Shift+Z` to redo. Press Escape to close the drawer or create dialog.

## Deployment

This is a static Vite app. Build with `npm run build` and deploy the `dist` directory to Vercel. The `vercel.json` rewrite keeps direct `/nodes/:id` links working.
