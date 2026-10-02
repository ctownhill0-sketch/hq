'use strict';
// Price table (USD per million tokens) for cost estimates and caps.
// Verify current prices on Anthropic's pricing page; override with
// LLM_PRICE_INPUT_PER_MTOK / LLM_PRICE_OUTPUT_PER_MTOK in .env if needed.
const PRICES = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-fable-5-1': [10, 50],
};

function priceFor(llm) {
  if (Number.isFinite(llm.priceInputPerMTok) && Number.isFinite(llm.priceOutputPerMTok)) {
    return { input: llm.priceInputPerMTok, output: llm.priceOutputPerMTok };
  }
  const p = PRICES[llm.model];
  return p ? { input: p[0], output: p[1] } : null;
}

const costOf = (price, inTok, outTok) => (inTok * price.input + outTok * price.output) / 1e6;

// Worst case for one run: every input token used plus the full output cap.
function worstCaseCost(llm, research) {
  const price = priceFor(llm);
  if (!price) return null;
  return costOf(price, research.maxInputTokens + 2500, research.maxOutputTokens);
}

module.exports = { PRICES, priceFor, costOf, worstCaseCost };
