## Web Stylebook: call `mcp__web-stylebook__start_ui_design` before writing UI code

Before you write HTML, CSS, JSX or other UI code for a new page or screen (landing page, dashboard,
docs, settings, product page, form), call `mcp__web-stylebook__start_ui_design` once with the product
context and `pageRole`. If tools are listed by name only, load it first with ToolSearch
`select:mcp__web-stylebook__start_ui_design`. For dashboards and charts, use it with your chart skill.

Without MCP, run the same tools from a shell: `npx -y web-stylebook-mcp@latest call <tool> --input
args.json` (`tools` lists them, `schema <tool>` shows the arguments, `read <uri>` opens a resource).

### New page or screen

1. **`start_ui_design`** returns the direction (style, hero, section order, signature moves, bans),
   the product's `mustHaves` with their zones, fonts with loading code, a photo plan, a copy brief and
   the `next` calls with their arguments. The direction is scored evidence: keep it or pick another
   with a reason (`recommend_design_direction` and `compare_design_directions` show more). Read
   `webstylebook://styles/{id}` for the build steps of the moves. The style never removes a must-have,
   and a first-screen must-have goes in the hero. Credit each stock photo as the photo plan says; with
   no fitting photo, leave the slot out.
2. **`compose_design_tokens`** when you write CSS or a theme, with the arguments from `next`. Obey its
   contrast warnings.
3. **Implement.** Cover the `get_ui_state_plan` states on each surface that loads data or takes input.
   `get_design_principle_plan` gives placement, apply and verify guidance for the layout concerns, a
   craft review rather than a fixed recipe; read `webstylebook://design-principles/{id}` only for the
   entries it selects. `get_ux_principle_plan` gives contextual decision prompts, not universal laws.
   Accessibility, safety, informed consent, and truthful feedback win. For a multi-screen product, write
   `design.md` first: the decisions, the selected visual-design principles with the placement each
   produced and its check, and the selected UX principles with their cautions.
4. **`audit_page_structure`** on the rendered HTML and CSS with the same `styleId` and `productType`,
   and **`audit_copy`** on the rendered HTML with the same `locale` and `productType`. Replace each
   finding with the move or rewrite it names, then run both again.
5. **`get_design_audit_plan`** with `includeGroups` holding the default groups plus `structure`, `copy`
   and `assets`, the same `styleId`, `productType` and `locale`, and the principle ids you used. Inspect
   the actual rendered UI, source and interactions for every check, the `principles` group included.
   Every PASS needs observed evidence; missing evidence is NOT_VERIFIED. Then call
   **`validate_design_audit_result`** with the same plan query, its `planHash`, the targets you
   inspected, evidence references, and the `evidence` and `results` the two audit tools returned.
   `valid` describes contract validity, never design quality.

For real-world examples, call `search_design_references` with a narrow query and `get_design_reference`
for a few entries. Record attribution and rights; borrow structure and measured tokens, never
screenshots, brand assets, copy, typefaces or visual identity. For an open-ended request, show 2-3
directions that differ in opening structure and ask which fits before you build components; when the
user already chose or asked you to just build, build.

### Existing UI: improve, fix, redesign

Call `get_design_improvement_plan` with the user task and target matrix in `context`, save its `query`
and `workflow.planHash`, and follow `webstylebook://workflows/improve-ui`: capture before, edit the
real source, capture after under the same conditions, test behavior and accessibility, check what the
edit kept with `compare_page_revisions`, then call `validate_design_improvement_result`. Keep working
behavior and product identity, and report before/after, changes with reasons and what was not
verified. Review-only requests stay read-only. Commit, push, release and deployment need their own
authorization.

### Craft rules

**No formulaic opening.** Two columns are fine; **generic furniture** is not: a copy stack beside a
decorative panel (a stock photo, an abstract blob, generic app chrome, a card you could paste onto
another product). Derive the opening from the product's most important object or action, and run
the furniture-check: the visual passes only as a bespoke demonstration of THIS product's core
mechanic, and a decorative seam bridging the columns does NOT launder a generic visual. Avoid the
all-text centered stack and the giant word too. Apply the same check below the fold.

**Kill the AI headline cadence.** No evocative noun-phrase fragment with one word italicized in the
accent color. The headline is specific to THIS product (paste-test: it could not sit on a competitor
by swapping a noun), and its form and emphasis change per project.

**Compose, don't recolor.** Tokens over an unchanged layout are a reskin. The style is a starting
tone: compose the components the brief needs and land on reusable components.

**Earn trust, don't fake it.** No invented metrics or compliance-jargon trust signals; back every
claim with content the user can browse.

**Copy puts meaning before machinery.** Inspect the visible strings. The absence of internal jargon
is not a pass. For every material claim, conclusion, or recommendation, ask what supports it, and
match wording and certainty to that support; never invent evidence, facts or next steps. Rewrite a
sentence that would sit equally well on an unrelated product or page. Match prominence to
information value, task relevance and support.

**Component states belong to the component**: context selectors (`nav a:hover`) must not override a
primitive's own states.

The catalog is the source of truth; read the live resources instead of copying them here. Output is
deterministic and offline; the server never sees your repository.

<!-- Copy this block into your project's CLAUDE.md. If you registered the server under another name,
     the tool is mcp__<that name>__start_ui_design. For Codex, use skills/AGENTS.md. -->
