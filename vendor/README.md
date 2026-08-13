# Vendored browser parsers

- `pdf.min.js` and `pdf.worker.min.js`: bundled from `pdfjs-dist@6.1.200` (Apache-2.0) for local PDF text extraction.
- `mammoth.browser.min.js`: copied from `mammoth@1.12.0` (BSD-2-Clause) for local DOCX text extraction.

These files run entirely in the browser. The application extracts text only and never renders imported document HTML.
