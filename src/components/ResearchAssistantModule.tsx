import React, { useEffect, useState } from 'react';
import { Bot, Send, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Dataset } from '../types/edna';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const STARTER_PROMPTS = [
  'Explain the taxonomic identification results for this dataset.',
  'Interpret the Shannon-Wiener and Simpson diversity indices computed for these samples.',
  'Compare biodiversity and community composition across sampling sites.',
  'Draft a concise ecological summary and recommend follow-up analyses.',
];

export const ResearchAssistantModule: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Welcome to the eDNA Biodiversity Research Assistant. Select an analyzed dataset above and ask questions about your taxonomic identifications, Shannon/Simpson indices, ecological patterns, or report drafting. All interpretations stay strictly grounded in your verified PostgreSQL dataset records.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ datasets: Dataset[] }>('/api/datasets')
      .then((res) => {
        setDatasets(res.datasets);
        if (res.datasets.length > 0) setSelectedDatasetId(res.datasets[0].id);
      })
      .catch(() => {});
  }, []);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || busy) return;

    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setError(null);
    setBusy(true);

    try {
      const res = await apiFetch<{ reply: string; model: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          datasetId: selectedDatasetId || undefined,
          history: messages.filter((_, idx) => idx > 0),
        }),
      });
      setMessages((prev) => [...prev, { role: 'model', text: res.reply }]);
    } catch (err: any) {
      setError(err.message || 'Unable to reach AI Research Assistant.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#174D35]">eDNA Biodiversity Research Assistant</h1>
          <p className="text-sm text-[#25332C]/75">
            AI-assisted scientific interpretation grounded strictly in your uploaded datasets and
            computed biodiversity metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#174D35] whitespace-nowrap">
            Dataset Context:
          </label>
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-[#174D35]/20 rounded-lg"
          >
            <option value="">General Methodology (No Dataset)</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.fileName} ({ds.processingStatus})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-white border border-[#174D35]/12 text-xs text-[#25332C]/80 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-[#18A999] shrink-0 mt-0.5" />
        <span>
          <strong>Scientific Grounding Guardrail:</strong> AI outputs provide interpretive
          commentary only. Experimentally computed species identifications and diversity indices come
          exclusively from deterministic sequence matching and mathematical equations.
        </span>
      </div>

      {/* Quick Starters */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={busy}
            onClick={() => sendMessage(p)}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-[#174D35] hover:text-white text-[#174D35] border border-[#174D35]/20 rounded-lg transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Chat Viewport */}
      <div className="bg-white rounded-xl border border-[#174D35]/12 flex flex-col h-[500px]">
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#174D35] text-white'
                    : 'bg-[#F6FAF7] border border-[#174D35]/12 text-[#25332C]'
                }`}
              >
                {m.role === 'model' && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18A999] mb-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    <span>eDNA Biodiversity Research Assistant</span>
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="text-xs text-[#25332C]/60 font-mono">
              Analyzing verified dataset context...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-[#174D35]/12 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about taxonomy, Shannon/Simpson indices, ecological patterns, or report text..."
            className="flex-1 px-4 py-2.5 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="px-5 py-2.5 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};
