type HubApiResult = {
  status: number;
  body: unknown;
};

type HubScriptRunner = {
  withSuccessHandler(handler: (value: HubApiResult) => void): HubScriptRunner;
  withFailureHandler(handler: (error: Error) => void): HubScriptRunner;
  apiRequest(method: string, path: string, body: string): void;
};

declare global {
  interface Window {
    google?: {
      script?: {
        run: HubScriptRunner;
      };
    };
    HUB_CONFIG?: {
      publicLinkBaseUrl?: string;
      assetBaseUrl?: string;
    };
  }
}

function createResponse(result: HubApiResult): Response {
  const payload = result?.body;
  const status = Number(result?.status || 500);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => typeof payload === "string" ? payload : JSON.stringify(payload),
  } as Response;
}

const scriptRunner = window.google?.script?.run;
if (scriptRunner) {
  const browserFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (!requestUrl.includes("/api/")) return browserFetch(input, init);

    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const requestBody = typeof init?.body === "string"
      ? init.body
      : init?.body ? JSON.stringify(init.body) : "";

    return new Promise<Response>((resolve, reject) => {
      const runner = window.google!.script!.run
        .withSuccessHandler((result) => resolve(createResponse(result)))
        .withFailureHandler((error) => reject(new Error(error?.message || String(error))));
      runner.apiRequest(method, requestUrl, requestBody);
    });
  }) as typeof window.fetch;
}
