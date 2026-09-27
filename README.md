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
npm run lint
npm run format:check
npm run build
```

Run `npm run format` to apply the project Prettier style.

## How it works

- TanStack Query fetches the supplied [assessment payload](https://respond-io-fe-bucket.s3.ap-southeast-1.amazonaws.com/candidate-assessments/payload.json) from the live S3 service. The S3 response has no browser CORS header, so Vite and Vercel proxy `/candidate-assessments/payload.json` to that URL. Loading or resetting the sample requires network access to S3.
- Query mutations persist workflow snapshots to IndexedDB, so larger attachment sets do not require synchronous localStorage writes. Existing localStorage edits are migrated on the next load. There is no write API in the brief, so edits are scoped to the current browser. **Reset to sample** removes saved edits.
- Pinia keeps transient UI state and up to 30 undo snapshots. Vue Router maps `/nodes/:id` to the details drawer, so a node can be opened by URL. Vue Flow handles graph interaction and dragging.
- The source `trigger` and `dateTimeConnector` records appear on the canvas as part of the original graph. As requested, they do not open a details drawer.
- The app preserves source payload fields. New nodes use the chosen title and description to initialize relevant message or comment content and may be connected after an existing node. Deleting a node leaves its children unconnected.
- Attachments are saved as browser data URLs in IndexedDB with a 2 MB per-file limit. The app reports browser storage quota errors when a workflow cannot be saved. Existing remote attachments remain linked to their original URL.

## Controls

Click an editable node to open its details. Drag nodes to rearrange the canvas; scroll to zoom. Use the toolbar or `⌘/Ctrl+Z` to undo and `⌘/Ctrl+Shift+Z` to redo. Press Escape to close the drawer or create dialog.

## Deployment

The Vercel project is linked to this GitHub repository. Vercel creates preview deployments for pull requests and production deployments for pushes to `main`. GitHub Actions runs tests, lint, formatting, and build checks; no Vercel credentials are stored in GitHub.

The `vercel.json` rewrites proxy the assessment payload and keep direct `/nodes/:id` links working. Other static hosts need an equivalent proxy for `/candidate-assessments/payload.json`.
