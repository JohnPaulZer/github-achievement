"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTierSnapshot = computeTierSnapshot;
exports.computeStatus = computeStatus;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function computeTierSnapshot(value, tiers) {
    let current = null;
    for (const tier of tiers) {
        if (value >= tier.target) {
            current = tier;
        }
        else {
            break;
        }
    }
    const next = tiers.find((tier) => tier.target > value) ?? null;
    if (!next) {
        return {
            currentTier: current?.label ?? "None",
            nextTier: null,
            nextTarget: null,
            progressPercent: 100,
        };
    }
    const previousTarget = current?.target ?? 0;
    const stepSize = next.target - previousTarget;
    const progress = stepSize > 0 ? ((value - previousTarget) / stepSize) * 100 : 0;
    return {
        currentTier: current?.label ?? "None",
        nextTier: next.label,
        nextTarget: next.target,
        progressPercent: clamp(progress, 0, 100),
    };
}
function computeStatus(value, firstTierTarget, limitedOrUnavailable) {
    if (limitedOrUnavailable && value <= 0) {
        return "Not started";
    }
    if (value <= 0) {
        return "Not started";
    }
    if (value >= firstTierTarget) {
        return "Achieved";
    }
    const ratio = value / firstTierTarget;
    if (ratio >= 0.8) {
        return "Near completion";
    }
    return "In progress";
}
//# sourceMappingURL=tierUtils.js.map