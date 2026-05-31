import { safeFloat } from "./parseNumbers";

export function calculateProfitMarginPercent({ invoicePrice, minSellPrice, marketPrice }) {
    const invoice = safeFloat(invoicePrice);
    const minSell = safeFloat(minSellPrice ?? marketPrice);

    if (minSell <= 0) {
        return 0;
    }

    return ((minSell - invoice) / minSell) * 100;
}
