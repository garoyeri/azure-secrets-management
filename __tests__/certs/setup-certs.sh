#!/bin/bash

# This script will create a new self-signed CA and cert so we can do
# testing. It will overwrite whatever you've got in this folder with
# new stuff. You shouldn't commit the result to Git since some
# Dependeabot security scans might flag these as secrets.

# NOTE: this is not making a secure set of keys, do not use
# these keys for ANYTHING important, just testing.

# Some parts copied and adapted from: https://www.baeldung.com/openssl-self-signed-cert

echo "Create a new domain key"
rm -f domain.key
openssl genrsa -des3 -passout pass:password -out domain.key 2048

echo "Creating a CSR for the test domain"
rm -f domain.csr
openssl req -key domain.key -passin pass:password -new -config csr-config.cnf -out domain.csr

echo "Signing Domain Certificate using CA"
openssl x509 -req -CA rootCA.crt -CAkey rootCA.key -passin pass:password -in domain.csr -out domain.crt -days 365 -CAcreateserial -extfile domain.ext
