import OpenAI from "openai";

let client: OpenAI | null | undefined;

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAiClient() {
  if (client !== undefined) {
    return client;
  }

  if (!process.env.OPENAI_API_KEY) {
    client = null;
    return client;
  }

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  return client;
}

export function getCategorizationModel() {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}
