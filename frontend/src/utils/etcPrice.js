/**
 * ETC Price Utilities
 *
 * Fixed exchange rate:  1 ETH  =  2,334.92 ETC
 * ETC price in USD:     1 ETC  =  ETH_USD_price / 2334.92  ≈  $1.00
 *
 * All formatting helpers live here so every page uses the same constant.
 */

// ─── Canonical exchange rate (matches CDP.sol ETC_PER_ETH / RATE_SCALE) ───
export const ETC_PER_ETH = 2334.92;

/**
 * Convert an ETH amount to the ETC amount you'd receive (before collateral ratio).
 * @param {number} ethAmount
 * @returns {number}
 */
export function ethToEtc(ethAmount) {
  return (ethAmount || 0) * ETC_PER_ETH;
}

/**
 * Convert an ETC amount to the equivalent ETH amount.
 * @param {number} etcAmount
 * @returns {number}
 */
export function etcToEth(etcAmount) {
  return (etcAmount || 0) / ETC_PER_ETH;
}

/**
 * Price of 1 ETC in USD  =  ethPrice / ETC_PER_ETH.
 * @param {number} ethPrice — current ETH/USD price
 * @returns {number}
 */
export function etcPriceUsd(ethPrice) {
  return (ethPrice || 0) / ETC_PER_ETH;
}

/**
 * Format an ETC token amount as its USD equivalent.
 * @param {number} etcAmount  — number of ETC tokens
 * @param {number} ethPrice   — current ETH/USD price
 * @returns {string} e.g. "$2,334.92"
 */
export function formatEtcUsd(etcAmount, ethPrice) {
  const usd = (etcAmount || 0) * etcPriceUsd(ethPrice);
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Return a compact peg-rate label for display.
 * @param {number} ethPrice
 * @returns {string} e.g. "1 ETH = 2,334.92 ETC"
 */
export function etcPegLabel(_ethPrice) {
  return `1 ETH = ${ETC_PER_ETH.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETC`;
}

/**
 * Return the per-ETC USD price as a formatted string.
 * @param {number} ethPrice
 * @returns {string} e.g. "1 ETC ≈ $1.00"
 */
export function etcUsdLabel(ethPrice) {
  const price = etcPriceUsd(ethPrice);
  const formatted = price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return `1 ETC ≈ ${formatted}`;
}
