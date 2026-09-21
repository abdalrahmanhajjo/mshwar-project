# File uploads

Story: MSHWAR-112 · Code: `services/api/app/core/uploads.py`, `media_inspect.py`, `imagekit.py`, `storage.py`; `app/api/v1/endpoints/portal.py`

## What can be uploaded

| Purpose                | Types                | Stored                                            |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Listing photos         | JPEG, PNG, WebP      | ImageKit when configured, otherwise local storage |
| Verification documents | JPEG, PNG, WebP, PDF | always private local storage                      |

## Checks, in order

1. **Signed in and allowed**: the caller must manage media for that business.
2. **Size**: at most `MAX_UPLOAD_BYTES` (10 MB).
3. **Type**: the declared type must be allowed for the purpose _and_ match the file's first bytes.
4. **Quota**: the business's total storage (`UPLOAD_ORG_QUOTA_BYTES`, 500 MB) and photos per listing (`MAX_IMAGES_PER_EXPERIENCE`, 20). Over the limit: `413`.
5. **Rate**: `UPLOAD_ORG_HOURLY_LIMIT` (60) uploads per business per hour. Over the limit: `429`.
6. **Structure**:
   - images must parse, with sane dimensions (at most 12,000 px per side and `MAX_IMAGE_PIXELS` in total), and must not contain markup or scripts;
   - PDFs must be real PDFs with no active content: no JavaScript, launch actions, embedded files, rich media, or forms that submit or import data.

   A file that fails gets `422` with a plain message.

## Where files go

- **ImageKit** (`IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` both set): listing photos are sent with a unique file name. Only the file path is stored; the web app builds delivery URLs with `NEXT_PUBLIC_IMAGEKIT_URL` and asks ImageKit for resized, compressed versions. If the database step fails after the upload, the file is deleted from ImageKit again.
- **Local private storage** (`PRIVATE_STORAGE_DIR`): verification documents always, and listing photos when ImageKit isn't configured. Files are served only through short-lived signed links.

## Downloads

Signed file links respond with:

- the right `Content-Type` for the stored extension;
- `Content-Disposition: inline` for images and `attachment` for everything else;
- `X-Content-Type-Options: nosniff`;
- `Content-Security-Policy: default-src 'none'; sandbox`;
- `Cache-Control: private, no-store`;
- `Referrer-Policy: no-referrer`;
- `Cross-Origin-Resource-Policy: same-origin`.

## Tests

`services/api/tests/test_abuse_controls.py` and `test_portal.py` cover each rejection, the quotas, the ImageKit path (with a fake client) and the download headers.
