import { NextResponse } from "next/server";
import { getCategorizationModel, getOpenAiClient, isOpenAiConfigured } from "../../lib/openai";
import type { FrameworkItem, LlmCategorizationResult } from "../../lib/types";

type CategorizeRequest = {
  accomplishment: string;
  framework: FrameworkItem[];
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
      description: item.description
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
                "You categorize work accomplishments against user-defined goals and competencies. Choose only IDs from the provided framework. Prefer precision over recall. Return no more than 2 goals and 2 competencies. The assistant note should be concise, professional, supportive, and mention the selected labels when they fit."
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
                  goals,
                  competencies
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
