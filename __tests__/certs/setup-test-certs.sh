#!/bin/bash

# Root CA public certificate
cp -f rootCA.crt public-root-ca.pem.txt

# Certificate signing request
cp -f domain.csr public-domain-cert.csr.txt

# Standalone public certificate for garoyeri.dev
cp -f domain.crt public-domain-cert.pem.txt

# Public certificate with trust chain for garoyeri.dev
cp -f rootCA.crt public-domain-cert-chain.pem.txt
cat domain.crt >> public-domain-cert-chain.pem.txt
