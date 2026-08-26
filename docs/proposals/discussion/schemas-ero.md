The research base I used **did not meaningfully cover eroticism**, and I think that leaves a real gap.

I also think **Eroticism is plausibly an independent specialist**, not merely a genre add-on or a subset of Character/Reader/Telling. The focused sources converge on a distinct craft problem: managing **desire, anticipation, embodied attention, vulnerability, agency, power, restraint, escalation, consummation, and aftermath** so that erotic charge develops rather than merely reporting attraction or sexual activity. ([Sloane S. Monroe][1])

The distinction from the proposed specialists is fairly clean:

| Specialist         | Primary question                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character Logic    | Why does this person plausibly want/choose this?                                                                                                   |
| Reader Model       | What does the reader know, expect, and reinterpret?                                                                                                |
| Narrative Delivery | How is the experience exposed or withheld?                                                                                                         |
| **Eroticism**      | **Where is desire located, how does erotic charge accumulate/change, and does intimacy alter the characters or relationship in the intended way?** |

That last question has its own failure modes. A scene can be psychologically credible, correctly focalized, and structurally functional while still being erotically inert.

The research suggests several recurring dimensions worth giving it:

* **desire and object of desire** — what specifically attracts or compels each character;
* **anticipation/restraint** — tension often comes from the gap between desire and expression/action, not from explicitness itself; ([Scriptoamorus][2])
* **embodied perspective/gaze** — what the POV character notices and how bodily perception expresses their subjective desire; ([Sloane S. Monroe][3])
* **agency and reciprocity** — who initiates, responds, chooses, withholds, yields, redirects, etc.;
* **vulnerability/power** — what each person risks or exposes through intimacy;
* **escalation and release** — whether increasing intimacy changes the charge rather than merely increasing explicitness;
* **relational change/aftermath** — intimate events should generally leave some consequential difference in relationship, knowledge, self-understanding, or stakes. ([Chaptershift][4])
* **explicitness as delivery choice**, rather than a proxy for erotic effectiveness. ([Reedsy][5])

I’d tentatively call the persona simply **Eroticism**, because `Intimacy` is broader and can easily drift into emotional closeness that isn't erotic.

A first-pass role prompt would be:

> **You are the Eroticism specialist. Judge how the story creates, sustains, transforms, and resolves erotic desire.**
>
> Attend to who desires whom and why; what each character notices, anticipates, risks, permits, withholds, initiates, or responds to; how attraction becomes embodied through viewpoint and action; and how restraint, proximity, vulnerability, power, reciprocity, and changing boundaries create or dissipate erotic charge.
>
> Treat explicitness and erotic effectiveness as separate things. A fully explicit encounter may be erotically inert, while a look, interruption, withheld touch, or change in permission may carry substantial charge. Judge whether escalation changes the relationship or experience rather than merely increasing physical intensity.
>
> Pay attention to the aftermath of intimacy: what is newly known, exposed, permitted, complicated, or impossible to take back.
>
> Do not become a general relationship, character-motivation, prose-style, or Reader Model critic. Speak when the story's handling of desire and erotic experience itself materially helps or hurts what the author intends.

That persona could also have **mode-specific overlays** just like the others. In flash, for example:

> At flash scale, erotic charge may need to be established through a few highly selective details, asymmetries of attention, restraint, or one consequential shift in permission/intimacy. Do not require buildup proportional to a longer romance arc.

And importantly, I **wouldn't make it default based purely on length**. This exposes a second axis our current mode/cast proposal hasn't fully handled:

```text
form/scale mode
    +
story-specific craft concerns
```

A 1,000-word erotic story probably wants `Eroticism` in its cast. A 15,000-word story with no erotic dimension doesn't.

That doesn't necessarily require a new formal product axis; your existing editable cast already supports it. But it suggests that the proposal's default casts are really **baseline casts**, with specialists like Eroticism activated because the particular story calls for them.

There may also be schema implications. I wouldn't add a giant `sexuality:` section, but for relevant stories some existing fields may need to accommodate:

```yaml
relationships:
  - parties: [Mara, Elise]
    state: >
    desire: >
    tension: >
    boundaries: >
    change: >
```

or beat/scene-local information such as:

```yaml
change: >
  Mara stops treating the attraction as hypothetical.

relationship:
  desire: >
  vulnerability: >
  boundary_shift: >
```

The focused research makes me think **desire/erotic charge belongs primarily in the persona**, with schema additions only where the story actually makes those states durable planning information.

I’d add Eroticism to the specialist library and references, and probably broaden the independent review prompt to explicitly look for **other domain-specific craft dimensions we missed because the initial literature skewed toward general narratology**. Eroticism is a good example of exactly that blind spot.

[1]: https://sloane.ink/articles/writers-guide-womens-erotica/?utm_source=chatgpt.com "A Writer's Guide to Women's Erotica | Sloane S. Monroe"
[2]: https://scriptoamorus.com/blog/how-write-sexual-tension-craft/?utm_source=chatgpt.com "How to Write Sexual Tension: A Craft Guide | Scriptoamorus"
[3]: https://sloane.ink/articles/how-to-write-the-female-gaze-in-erotica/?utm_source=chatgpt.com "The Observer and the Observed: How to Write the Female Gaze in Erotica | Sloane S. Monroe"
[4]: https://chaptershift.com/articles/en/how-to-write-intimate-scenes-in-romance-craft-over-shock/?utm_source=chatgpt.com "How to Write Intimate Scenes in Romance (Craft Over Shock)"
[5]: https://reedsy.com/learning/courses/writing/how-to-turn-up-the-heat-in-your-romance?utm_source=chatgpt.com "How to Turn Up the Heat in Your Romance (Free Course) – Reedsy • Reedsy"
