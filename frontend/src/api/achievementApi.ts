import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiErrorPayload,
} from "../types";

const DEFAULT_API_BASE_URL = (() => {
  if (typeof window === "undefined") {
    return "http://localhost:5050";
  }

  return `${window.location.protocol}//${window.location.hostname}:5050`;
})();

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as ApiErrorPayload;
    return new ApiError(
      response.status,
      data.code || "REQUEST_FAILED",
      data.message || "Request failed.",
      data.details,
    );
  } catch {
    return new ApiError(response.status, "REQUEST_FAILED", "Request failed.");
  }
}

export async function analyzeAchievements(
  payload: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/achievements/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as AnalyzeResponse;
}
