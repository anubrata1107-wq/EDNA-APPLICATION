import { GoogleGenAI } from '@google/genai';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface AssistantDatasetContext {
  datasetName: string;
  fileFormat: string;
  sampleType: string;
  samplingLocation: string;
  collectionDate: string;
  recordCount: number;
  taxonomicSummary: Array<{
    species: string;
    genus: string;
    family: string;
    phylum: string;
    kingdom: string;
    abundanceCount: number;
    percentIdentity: number;
    identificationStatus: string;
    matchSource: string;
  }>;
  biodiversitySummary?: {
    richness: number;
    totalIndividuals: number;
    shannonIndex: number;
    simpsonIndex: number;
    pielouEvenness: number;
    chao1Estimate: number | null;
  } | null;
  sampleBreakdown?: Array<{
    sampleLabel: string;
    richness: number;
    shannonIndex: number;
    simpsonIndex: number;
  }>;
}

const RESEARCH_ASSISTANT_SYSTEM_INSTRUCTION = `You are the "eDNA Biodiversity Research Assistant", an expert bioinformatics and ecological statistics assistant embedded inside a scientific environmental DNA platform.

CRITICAL SCIENTIFIC INTEGRITY RULES:
1. You must ONLY reference species names, read counts, diversity indices, sampling locations, and metadata explicitly provided in the VERIFIED DATASET CONTEXT JSON below.
2. NEVER invent, extrapolate, or fabricate species identifications, numerical diversity values, accession numbers, or literature citations. If a piece of information is not present in the context, state clearly: "Not present in the verified dataset results."
3. ALWAYS clearly separate your output into two explicit headings when interpreting data:
   - **Experimentally Computed Findings** (citing exact numbers and taxa from the context)
   - **AI-Assisted Ecological Interpretation** (contextual ecological hypotheses, functional guild notes, and recommended next analyses)
4. Remind researchers when identifications come from the local curated voucher reference engine vs. user-uploaded tables, and note any unassigned sequences honestly.`;

export async function askResearchAssistant(
  question: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  context: AssistantDatasetContext | null
): Promise<{ reply: string; model: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in server secrets. Please set GEMINI_API_KEY in Settings > Secrets.'
    );
  }

  const contextBlock = context
    ? `VERIFIED DATASET CONTEXT:\n${JSON.stringify(context, null, 2)}`
    : 'VERIFIED DATASET CONTEXT: No specific dataset selected. Answer general eDNA bioinformatics and biodiversity metric methodology questions accurately without fabricating dataset numbers.';

  const conversationContents = [
    ...history.slice(-8).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: `${contextBlock}\n\nRESEARCHER QUESTION:\n${question}` }],
    },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: conversationContents,
    config: {
      systemInstruction: RESEARCH_ASSISTANT_SYSTEM_INSTRUCTION,
    },
  });

  return {
    reply: response.text ?? 'Unable to generate interpretation response.',
    model: 'gemini-4-hydrogen',
  };
}

export async function generateReportInterpretation(context: AssistantDatasetContext): Promise<{
  ecologicalInterpretation: string;
  limitations: string;
  conclusion: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }

  const prompt = `Using ONLY the VERIFIED DATASET CONTEXT below, draft concise, publication-grade scientific prose for three sections of an eDNA biodiversity report. Return plain JSON with keys "ecologicalInterpretation", "limitations", and "conclusion". Do NOT invent species, metrics, or external citations.

VERIFIED DATASET CONTEXT:
${JSON.stringify(context, null, 2)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction: RESEARCH_ASSISTANT_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });

  try {
    const parsed = JSON.parse(response.text ?? '{}') as {
      ecologicalInterpretation?: string;
      limitations?: string;
      conclusion?: string;
    };
    return {
      ecologicalInterpretation:
        parsed.ecologicalInterpretation ||
        'Interpretation unavailable for the current dataset parameters.',
      limitations:
        parsed.limitations ||
        'Analysis depends on PCR primer specificity, reference database completeness, and sampling replication.',
      conclusion:
        parsed.conclusion ||
        'Further multi-marker validation and temporal sampling are recommended.',
    };
  } catch {
    return {
      ecologicalInterpretation: response.text || 'Ecological interpretation generated.',
      limitations:
        'Taxonomic coverage depends on reference voucher completeness and marker gene resolution.',
      conclusion: 'Dataset processed and archived for longitudinal biodiversity monitoring.',
    };
  }
}
