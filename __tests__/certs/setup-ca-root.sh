#!/bin/bash

# This script will setup a test CA certificate to sign CSR requests.
# This is useful for doing validation of the certificate handling.

# NOTE: this is not making a secure set of keys, do not use
# these keys for ANYTHING important, just testing.

# Some parts copied and adapted from: https://www.baeldung.com/openssl-self-signed-cert

# disable path conversion if using MSYS2
export MSYS2_ARG_CONV_EXCL="-subj"
export MSYS_NO_PATHCONV=1

echo "Create new Root CA Key"
rm -f rootCA.crt rootCA.key
openssl req -x509 -sha256 -days 1825 -passout pass:password -subj "/C=US/ST=TX/L=Houston/O=GaroYeriDev/CN=garoyeri.dev" -newkey rsa:2048 -keyout rootCA.key -out rootCA.crt
