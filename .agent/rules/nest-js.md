---
trigger: always_on
---

Before writing code:
- Briefly state the architectural decision.
- Explain why this layer is the correct place.
- Do not proceed if the responsibility is unclear.

When writing application services:
- Clearly define transaction boundaries.
- Never split a single business use case across multiple transactions.
- Mention consistency guarantees when data is modified.

For HTTP APIs:
- Define request and response contracts explicitly.
- Avoid leaking domain objects directly in responses.
- Use DTOs for all external boundaries.

When handling errors:
- Use a consistent error response structure.
- Distinguish between client errors and server errors.
- Prefer explicit domain exceptions over generic errors.

Assume all input is untrusted.
Mention validation, authentication, and authorization whenever relevant.
Never assume internal APIs are safe.

Make the smallest possible change to achieve the goal.
Do not refactor unrelated code unless explicitly requested.

Write code so that it can be easily unit-tested.
Avoid hidden dependencies and static access.

Do not assume project-specific details.
If information is missing, state the assumption explicitly.