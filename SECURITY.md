# Security Policy

`web-stylebook-mcp` is designed to be safe by construction. **At runtime the server makes no
network calls and does not read your project files, environment, shell, browser, or any model API.**
It reads only the catalog snapshot bundled in the package, serves that snapshot read-only, and every
response is a deterministic function of the input.

(Installing the package via `npx`/`npm` naturally downloads it from the npm registry — that is the
package manager, not the server.)

## Reporting a vulnerability

Please report security issues privately to **hyun@lafi.kr** rather than opening a public issue.
We'll acknowledge and respond as quickly as we can.

## Supported versions

The latest published `0.x` release receives fixes.
