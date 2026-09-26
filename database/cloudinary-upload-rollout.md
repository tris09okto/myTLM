# Cloudinary upload rollout

1. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in production.
2. Apply `migrations/20260926_cloudinary_file_references.sql` to the production database so file references can hold full URLs.
3. Deploy the URL-aware readers and Cloudinary writers.
4. In staging, exercise image, PDF, and base64 uploads and confirm stored references, mobile URL fields, and web links. Confirm development uploads still use local filenames.
5. Run a production dry run, then apply the cleanup:

   ```sh
   NODE_ENV=production npm run cleanup:local-upload-references
   NODE_ENV=production npm run cleanup:local-upload-references -- --apply
   ```

The cleanup clears non-URL references from the file columns only. It processes each `master_pegawai.st_file` entry individually, keeps URL entries, leaves physical files untouched, and reports affected references plus business-row counts before and after. Rerun it after applying; it should report zero affected references.
