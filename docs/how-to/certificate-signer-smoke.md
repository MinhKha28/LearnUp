# Check certificate signer settings

Use a disposable local environment. The smoke test updates signer settings in the seeded organization. Start the cluster and provision its Organizer accounts using the [E2E setup](../../tests/e2e/README.md).

From the repository root, run the [signer journey](../../tests/e2e/journeys/07-signer-settings.mjs).

```sh
node tests/e2e/run.mjs J7
```

The journey reads signer settings through the Gateway and checks that the response ETag matches the returned version. It saves the name and title using the current If-Match value and verifies the new version on readback. It checks HTTP 428 for an omitted If-Match and HTTP 412 for a stale one. The tenant isolation journey also checks the second organization's settings.

For a signature upload check, use a storage-enabled development stack, a disposable organization and a synthetic PNG or JPEG. Use the [signer contract](../../contracts/openapi/achievement-reporting-service.yaml) to send a multipart PUT with the current If-Match and the replacement action. Read the signature with the contract's binary GET route and confirm the response matches the uploaded file. Repeat with an unauthorized caller and confirm access is denied.
