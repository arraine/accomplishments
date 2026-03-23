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
      }
    },
    required: ["assistantNote", "suggestedGoalIds", "suggestedCompetencyIds"]
  },
  strict: true
} as const;

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
              text:
                "You categorize brief daily work accomplishments against user-defined goals and competencies. Use semantic reasoning, not surface keyword overlap. Infer likely intent, responsibility, outcome, collaboration, ownership, execution, judgment, communication, and business impact from the accomplishment. Choose only IDs from the provided framework. Return up to 2 goals and up to 2 competencies. If an accomplishment plausibly demonstrates a competency or advances an objective even with different wording, select it. Prefer the strongest plausible matches rather than requiring exact phrase overlap. Use prior categorized examples as precedents for how this user tends to map work, but do not copy them blindly when the new accomplishment points somewhere else. The assistant note should be concise, professional, supportive, and mention the selected labels when they fit."
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
                  instructions:
                    "Map this accomplishment to the most relevant goals and competencies using the richer objective/key-result and category context below. Use the prior examples as user-specific guidance for thematic matching.",
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
      assistantNote: parsed.assistantNote,
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
