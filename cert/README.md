# Development CA Certificates

This file contains the necessary Certificate Authority (CA) certificates for the development environment. It is used by Node.js applications via the `NODE_EXTRA_CA_CERTS` environment variable.

**Do not add comments or any non-PEM formatted text directly into `ca.cer`.**

The `ca.cer` file includes the following certificates concatenated together:

1. **Subject:** `CN=Central Provident Fund Board Certificate Authority for Test`
    * **Issuer:** `CN=Central Provident Fund Board Certificate Authority for Test`
    * Root CA certificate for the Test environment.

2. **Subject:** `CN=Central Provident Fund Board Non-Prod Application CA`
    * **Issuer:** `CN=Central Provident Fund Board Certificate Authority for Test`
    * Intermediate CA that issues certificates for non-production applications.

This bundle ensures that applications can trust the certificates presented by internal development services signed by these CAs.
