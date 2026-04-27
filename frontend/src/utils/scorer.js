const SCORER_API_URL = (import.meta.env.VITE_SCORER_API_URL || "").replace(/\/+$/, "");

function getScorerUrl(path) {
  if (!SCORER_API_URL) {
    throw new Error("Scorer service URL is not configured.");
  }
  return `${SCORER_API_URL}${path}`;
}

async function parsePayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function requestScoreUpdate(wallet) {
  const response = await fetch(getScorerUrl("/score"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });

  const payload = await parsePayload(response);
  if (!response.ok) {
    throw new Error(payload.detail || "Failed to update the on-chain credit score.");
  }

  return payload;
}
