"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitHubClient = createGitHubClient;
const errors_1 = require("./errors");
const REST_API_BASE = "https://api.github.com";
const GRAPHQL_API_URL = "https://api.github.com/graphql";
const USER_AGENT = "github-achievement-progress-tracker";
function baseHeaders(token) {
    const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}
async function parseErrorBody(response) {
    try {
        return await response.json();
    }
    catch {
        return await response.text();
    }
}
function getRateLimitResetIso(response) {
    const resetHeader = response.headers.get("x-ratelimit-reset");
    if (!resetHeader) {
        return null;
    }
    const resetSeconds = Number(resetHeader);
    if (Number.isNaN(resetSeconds)) {
        return null;
    }
    return new Date(resetSeconds * 1000).toISOString();
}
async function handleHttpError(response) {
    const body = await parseErrorBody(response);
    const remaining = response.headers.get("x-ratelimit-remaining");
    if ((response.status === 403 || response.status === 429) &&
        remaining === "0") {
        throw new errors_1.AppError(429, "GITHUB_RATE_LIMIT", "GitHub API rate limit exceeded.", {
            resetAt: getRateLimitResetIso(response),
            body,
        });
    }
    if (response.status === 401) {
        throw new errors_1.AppError(401, "GITHUB_TOKEN_INVALID", "GitHub token is invalid or expired.", {
            body,
        });
    }
    if (response.status === 403) {
        throw new errors_1.AppError(403, "GITHUB_FORBIDDEN", "GitHub denied access. Your token may be missing required permissions.", { body });
    }
    if (response.status === 404) {
        throw new errors_1.AppError(404, "GITHUB_NOT_FOUND", "GitHub resource was not found.", {
            body,
        });
    }
    if (response.status === 422) {
        throw new errors_1.AppError(422, "GITHUB_VALIDATION", "GitHub rejected the request query.", {
            body,
        });
    }
    throw new errors_1.AppError(response.status, "GITHUB_REQUEST_FAILED", "GitHub request failed.", {
        body,
        status: response.status,
    });
}
function createGitHubClient(token) {
    async function rest(path, init) {
        const response = await fetch(`${REST_API_BASE}${path}`, {
            ...init,
            headers: {
                ...baseHeaders(token),
                ...(init?.headers ?? {}),
            },
        });
        if (!response.ok) {
            return handleHttpError(response);
        }
        if (response.status === 204) {
            return {};
        }
        return (await response.json());
    }
    async function graphql(query, variables) {
        const response = await fetch(GRAPHQL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...baseHeaders(token),
            },
            body: JSON.stringify({ query, variables }),
        });
        if (!response.ok) {
            return handleHttpError(response);
        }
        const parsed = (await response.json());
        if (parsed.errors?.length) {
            throw new errors_1.AppError(400, "GITHUB_GRAPHQL_ERROR", parsed.errors.map((error) => error.message).join(" | "), parsed.errors);
        }
        if (!parsed.data) {
            throw new errors_1.AppError(500, "GITHUB_GRAPHQL_EMPTY", "GitHub GraphQL response was empty.");
        }
        return parsed.data;
    }
    return {
        rest,
        graphql,
    };
}
//# sourceMappingURL=githubClient.js.map