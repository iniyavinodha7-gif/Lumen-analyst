import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planTurn, explainResult, summarizeProfile, titleFor } from "./ai.server";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const planAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        question: z.string().min(1),
        history: z.array(turnSchema).default([]),
        datasetContext: z.string().default(""),
        role: z.string().default("Student"),
        persona: z.string().default("Helpful Tutor"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => planTurn(data));

export const explainAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        question: z.string(),
        code: z.string(),
        execOutput: z.string(),
        role: z.string().default("Student"),
        persona: z.string().default("Helpful Tutor"),
        eli5: z.boolean().default(false),
        tldr: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => explainResult(data));

export const profileDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ profileJson: z.string(), role: z.string().default("Student") }).parse(data),
  )
  .handler(async ({ data }) => summarizeProfile(data));

export const generateTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ question: z.string() }).parse(data))
  .handler(async ({ data }) => ({ title: await titleFor(data.question) }));
