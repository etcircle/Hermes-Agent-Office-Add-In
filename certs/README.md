# Local HTTPS certificates

Office sideloading wants HTTPS. For local development, generate your own localhost certs here.

Expected files:
- `certs/localhost.crt`
- `certs/localhost.key`

## Quick openssl example

```bash
openssl req -x509 -nodes -newkey rsa:2048   -keyout certs/localhost.key   -out certs/localhost.crt   -days 365   -subj "/CN=localhost"
```

That is enough for local bridge testing. For a nicer trust story on macOS, import the cert into Keychain and trust it explicitly.
