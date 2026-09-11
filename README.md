# DevFintech

The public website for DevFintech’s free, student-led financial literacy and fintech programs. The visual design follows the [Cobalt Figma design](https://www.figma.com/design/FA7TarleHc8eLqm52yMlmY/dev-fin-tech?node-id=72-3). Website content comes from this GitHub repository, including the existing chapter and class registration flows.

## Run locally

Requires Node.js 20 or later. No framework or build step is required to serve the site.

```sh
npm run dev
```

Open http://127.0.0.1:4173. The development server binds only to this computer and serves the website files, not repository metadata.

## Validate

```sh
npm ci
npx playwright install chromium
npm run check
```

With the development server running in another terminal:

```sh
npm test
```

The suite covers desktop, tablet, narrow mobile layouts, navigation, course browsing, both chapter paths, both class schedule paths, validation, keyboard focus, enlarged text, reduced motion, literal user input, and submission failure/retry behavior. All registration requests are intercepted; tests never submit a real application. Screenshots and results are saved in ignored `.artifacts/`.

Optional environment variables: `TEST_URL` changes the preview URL; `TEST_BROWSER_PATH` selects an existing Chromium executable; `PLAYWRIGHT_MODULE` selects a preinstalled Playwright module.

## Publishing

Serve `index.html` and the `assets/` directory together, retaining their relative paths. They work with the repository’s existing static GitHub Pages setup. `index_1.html` is the unchanged older variant and is not the main entrypoint. Development scripts, tests, and dependencies are not needed in a static deployment.

Existing `#/home`, `#/curriculum`, `#/chapters`, `#/about`, `#/get-involved`, `#/start-a-chapter`, and `#/class` links continue to work in the refreshed entrypoint.

## Registration integration

`assets/app.js` retains the original class and chapter Google Apps Script endpoints and payload field names. Review these endpoints in your Apps Script deployment before release. Automated testing uses mocked responses and does not verify live delivery, spreadsheet writes, or confirmation emails.

The browser no longer contains or calls Discord webhook credentials. If Discord notifications are required, send them from the receiving Apps Script using credentials stored in Script Properties. Rotate the previously exposed webhooks; removing them from the current code does not revoke credentials already present in Git history. Never put their replacements in the website or a public repository.

An existing newsletter form had no subscription service. It has been replaced by a working email contact link, without claiming to subscribe visitors.

## Design and assets

- DM Sans and IBM Plex Mono, warm paper, dark green, and cobalt are retained from Figma; lime is the highlight color.
- `assets/learning.jpg` is the original photograph extracted byte-for-byte from the repository’s embedded JPEG. The same photo appears in Figma and was sourced from DevFintech’s existing Wix site. It is illustrative, not identified as a particular DevFintech student.
- Homepage content comes from the original `index.html`; the nine course descriptions come from the existing `index_1.html` catalog.
- Compound Hacks retains the repository’s original event copy, date, location, destination link, and desert SVG artwork.
- The existing event date, class schedules, participation figures, and contact details have been retained. Confirm them with the program organizers when publishing updates.

Registration drafts stay in memory only while the page is open. Names and other form inputs are escaped before rendering; no personal data is saved to browser storage.
