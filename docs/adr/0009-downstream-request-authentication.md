# ADR 0009 · Downstream request authentication

Amends ADR 0003 ([Gateway security and context propagation](0003-gateway-security-and-auth-context.md)).

## Status

Accepted

## Context

Gateway JWT validation creates the forwarded identity claims. Services also receive direct internal calls and need to establish their own authenticated request context.

## Decision

The Gateway removes client-supplied identity and internal headers, then forwards validated claims and its configured internal key. Downstream service guards authenticate internal calls before using forwarded claims. Identity authenticates internal provisioning with the internal key and validates bearer JWTs on protected user routes. See [request authentication](../architecture/security.md).

## Consequences

Service authorization reads the authenticated principal. Deployment must configure the same internal key for participating callers and receivers. Identity keeps JWT validation at its own user-route boundary.
