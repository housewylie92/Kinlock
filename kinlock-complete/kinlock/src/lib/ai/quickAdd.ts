import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type ParsedEvent = {
  title: string;
  starts_at: string; // ISO datetime, or YYYY-MM-DD if is_all_day
  is_all_day: boolean;
  assigned_to: string; // a roster member's name, or "Whole family"
  location: string; // "" if not mentioned
  notes: string; // "" if nothing extra
  needs_review: boolean; // true if the date/time was ambiguous
};

const WHOLE_FAMILY = "Whole family";

function buildSchema(rosterNames: string[]) {
  return {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            starts_at: {
              type: "string",
              description:
                "ISO 8601 date-time (e.g. 2026-08-18T16:00:00) if a time was given, or just YYYY-MM-DD if is_all_day is true.",
            },
            is_all_day: { type: "boolean" },
            assigned_to: {
              type: "string",
              // Enum built from the ACTUAL family roster at request time —
              // Claude can only pick a name that really exists in this
              // family, or the whole-family fallback. No fuzzy string
              // matching needed on the way back out.
              enum: [...rosterNames, WHOLE_FAMILY],
            },
            location: {
              type: "string",
              description: "Empty string if no location was mentioned.",
            },
            notes: {
              type: "string",
              description: "Empty string if there's nothing extra to note.",
            },
            needs_review: {
              type: "boolean",
              description:
                "true if the date or time was ambiguous or you had to guess — flags it for the user to double-check rather than silently guessing wrong.",
            },
          },
          required: [
            "title",
            "starts_at",
            "is_all_day",
            "assigned_to",
            "location",
            "notes",
            "needs_review",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["events"],
    additionalProperties: false,
  } as const;
}

export async function parseQuickAdd(
  text: string,
  rosterNames: string[],
  referenceDate: Date
): Promise<ParsedEvent[]> {
  const todayLabel = referenceDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You turn messy, casually-written family scheduling notes into a clean list of calendar events.

Today is ${todayLabel}. Resolve relative dates ("Tues", "next Wednesday", "tomorrow") against that.

The family members are: ${rosterNames.join(", ")}. Match names or clear nicknames mentioned in the text to these exact names. If an event isn't clearly for one person, or is a family-wide thing (dinner, movie night, a trip), use "${WHOLE_FAMILY}".

Split the text into one event per distinct activity — don't merge unrelated things, and don't invent events that aren't there. If a date or time is genuinely unclear, make your best reasonable guess and set needs_review to true rather than leaving it out.`,
    messages: [{ role: "user", content: text }],
    output_config: {
      format: { type: "json_schema", schema: buildSchema(rosterNames) },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude didn't return a parseable response.");
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude couldn't process that text.");
  }

  const parsed = JSON.parse(textBlock.text) as { events: ParsedEvent[] };
  return parsed.events;
}
