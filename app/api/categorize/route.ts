import { NextResponse } from "next/server";
import { getCategorizationModel, getOpenAiClient, isOpenAiConfigured } from "../../lib/openai";
import type {
  CompetencyCategory,
  FrameworkItem,
  GoalObjective,
  LlmCategorizationResult,
  PriorCategorizationExample
} from "../../lib/types";

type CategorizeRequest = {
  accomplishment: string;
  framework: FrameworkItem[];
  goalObjectives: GoalObjective[];
  competencyCategories: CompetencyCategory[];
  priorExamples: PriorCategorizationExample[];
  clarificationAnswer?: string;
};

const responseSchema = {
  name: "accomplishment_categorization",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      assistantNote: {
        type: "string",
        description:
          "A short supportive note acknowledging the accomplishment and naming the selected goal and competency labels when possible."
      },
      resultType: {
        type: "string",
        enum: ["direct", "clarification"]
      },
      suggestedGoalIds: {
        type: "array",
        items: {
          type: "string"
        },
        maxItems: 2
      },
      suggestedCompetencyIds: {
        type: "array",
        items: {
          type: "string"
        },
        maxItems: 2
      },
      clarificationQuestion: {
        type: "string",
        description:
          "One concise follow-up question to ask only when categorization is ambiguous. Empty string when no follow-up is needed."
      }
    },
    required: [
      "assistantNote",
      "resultType",
      "suggestedGoalIds",
      "suggestedCompetencyIds",
      "clarificationQuestion"
    ]
  },
  strict: true
} as const;

const assistantInstruction = `
You are the user's Accomplishments assistant.

Your job is to record, categorize, and summarize daily accomplishments relative to the user's defined goals and competencies.

Priorities:
- Capture the accomplishment accurately.
- Categorize it against the user's saved goals and competencies.
- Use conceptual similarity, not just wording overlap.
- Prefer semantic interpretation of the work: intent, ownership, complexity, collaboration, execution, leadership, judgment, communication, and business impact.
- Treat brief daily task descriptions as valid evidence when they plausibly support a broader goal or competency.

Behavior rules:
- If the user gives a short or plain description, infer the likely meaningful outcome from context.
- If an accomplishment plausibly advances a goal or demonstrates a competency even with different phrasing, select it.
- Prefer the strongest 1-2 goal matches and 1-2 competency matches rather than spreading too broadly.
- If prior categorized examples suggest how this user usually maps work, use them as guidance.
- Do not require exact keyword overlap.
- Only return no matches when there is genuinely not enough evidence.

Assistant note style:
- Professional, organized, supportive.
- Short and precise.
- Mention the selected goals or competencies when useful.
- Sound like a capable accomplishments-tracking assistant, not a generic classifier.
`.trim();

export async function POST(request: Request) {
  if (!isOpenAiConfigured()) {
    return NextResponse.json(
      { error: "OpenAI is not configured on the server." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Partial<CategorizeRequest>;
  const accomplishment = body.accomplishment?.trim();
  const framework = body.framework ?? [];
  const goalObjectives = body.goalObjectives ?? [];
  const competencyCategories = body.competencyCategories ?? [];
  const priorExamples = body.priorExamples ?? [];
  const clarificationAnswer = body.clarificationAnswer?.trim() ?? "";

  if (!accomplishment) {
    return NextResponse.json({ error: "Accomplishment text is required." }, { status: 400 });
  }

  const client = getOpenAiClient();

  if (!client) {
    return NextResponse.json(
      { error: "OpenAI client could not be initialized." },
      { status: 503 }
    );
  }

  const goals = framework
    .filter((item) => item.kind === "goal")
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description
    }));
  const competencies = framework
    .filter((item) => item.kind === "competency")
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      categoryName: item.categoryName ?? ""
    }));

  try {
    const response = await client.responses.create({
      model: getCategorizationModel(),
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          ...responseSchema
        }
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `${assistantInstruction}

Output rules:
- Choose only IDs from the provided framework.
- Return up to 2 goals and up to 2 competencies.
- Use prior categorized examples as precedents for how this user tends to map work, but do not copy them blindly when the new accomplishment points somewhere else.
- The assistant note should be concise, professional, supportive, and mention the selected labels when they fit.`
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  accomplishment,
                  clarificationAnswer,
                  instructions:
                    "Map this accomplishment to the most relevant goals and competencies using the richer objective/key-result and category context below. Use the prior examples as user-specific guidance for thematic matching. If confidence is low or the accomplishment could map to multiple different themes, ask exactly one short follow-up question and still return your best provisional top suggestions in suggestedGoalIds and suggestedCompetencyIds.",
                  goalObjectives,
                  competencyCategories,
                  goals,
                  competencies,
                  priorExamples
                },
                null,
                2
              )
            }
          ]
        }
      ]
    });

    const parsed = JSON.parse(response.output_text) as LlmCategorizationResult;

    return NextResponse.json({
      resultType: parsed.resultType,
      assistantNote: parsed.assistantNote,
      clarificationQuestion: parsed.clarificationQuestion,
      suggestedGoalIds: parsed.suggestedGoalIds.filter((id) => goals.some((item) => item.id === id)),
      suggestedCompetencyIds: parsed.suggestedCompetencyIds.filter((id) =>
        competencies.some((item) => item.id === id)
      )
    } satisfies LlmCategorizationResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Categorization failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
