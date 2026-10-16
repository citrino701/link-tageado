# Security and deployment

## Firestore access

The browser does not access Firestore directly. The server calls the Firestore REST API with Google Application Default Credentials, and `firestore.rules` denies all direct client reads and writes.

Grant the deployed server runtime service account the **Cloud Datastore User** role (`roles/datastore.user`) on the Firebase/Google Cloud project. The Firestore rules should remain locked down; server access is authorized through IAM.

## Required server secrets

Set these in the AI Studio Secrets panel or the deployment environment. Do not commit real values:

- `SESSION_SECRET`: a random value of at least 32 characters. This signs the administrator session cookie.
- `TOKEN_ENCRYPTION_KEY`: a separate random value used to encrypt the Google refresh token.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the OAuth credentials for the Google account allowed to manage the hub.
- `ADMIN_EMAIL`: the Google account allowed to manage the hub.

Changing `SESSION_SECRET` invalidates existing administrator sessions; sign in again after deployment.

The previous token encryption fallback was committed to repository history. Treat that value as compromised: set a new `TOKEN_ENCRYPTION_KEY`, revoke the hub's old Google OAuth grant, and reconnect the Google account so its refresh token is encrypted with the new key.
