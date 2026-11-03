function normalizeBase(url: string) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function joinUrl(base: string, pathname: string) {
  const b = normalizeBase(base);
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${b}${p}`;
}

function authHeaders(apiKey: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function extractModels(payload: unknown) {
  const names = new Set<string>();
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (typeof obj.id === "string") names.add(obj.id);
      if (typeof obj.model === "string") names.add(obj.model);
      if (
        typeof obj.name === "string" &&
        /video|kling|runway|luma|sora|wan|veo|minimax|hailuo|cog|vid/i.test(obj.name)
      ) {
        names.add(obj.name);
      }
      Object.values(obj).forEach(visit);
    }
  };
  visit(payload);
  return [...names];
}

function looksLikeVideoModel(id: string) {
  return /video|kling|runway|luma|sora|wan|veo|minimax|hailuo|cogvideox|vidu|hunyuan|pika|lightricks|ltx|seedance|jimeng|doubao-seed|gen-3|gen3|gen-2/i.test(
    id
  );
}

async function fetchJson(url: string, options: RequestInit, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data, text };
  } finally {
    window.clearTimeout(timer);
  }
}

function pickVideoUrl(payload: unknown) {
  if (!payload) return "";
  const urls: string[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string") {
      if (
        /^https?:\/\/.+\.(mp4|webm|mov)(\?|$)/i.test(node) ||
        (/\/video|mp4|cdn/i.test(node) && /^https?:\/\//.test(node))
      ) {
        urls.push(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const keys = ["url", "video_url", "videoUrl", "mp4", "output", "file", "uri"];
      for (const key of keys) {
        if (typeof obj[key] === "string" && /^https?:\/\//.test(obj[key] as string)) {
          urls.push(obj[key] as string);
        }
      }
      Object.values(obj).forEach(visit);
    }
  };
  visit(payload);
  return urls.find((u) => /\.mp4(\?|$)/i.test(u)) || urls[0] || "";
}

function pickText(payload: unknown) {
  if (!payload) return "";
  const texts: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (typeof obj.content === "string") texts.push(obj.content);
      if (typeof obj.text === "string") texts.push(obj.text);
      if (Array.isArray(obj.content)) {
        obj.content.forEach((c) => {
          if (c && typeof c === "object" && typeof (c as { text?: string }).text === "string") {
            texts.push((c as { text: string }).text);
          }
        });
      }
      Object.values(obj).forEach(visit);
    }
  };
  visit(payload);
  return texts.join("\n").trim();
}

function errorMessage(data: unknown, text: string, status: number) {
  const obj = data as { error?: { message?: string }; message?: string } | null;
  return obj?.error?.message || obj?.message || text || `HTTP ${status}`;
}

export async function detectModels(baseUrl: string, apiKey: string) {
  const base = normalizeBase(baseUrl);
  if (!base) throw new Error("请填写 API 地址");
  const candidates = ["/v1/models", "/models", "/openai/v1/models", "/v1/video/models"];
  let lastError = "无法读取模型列表";
  for (const pathName of candidates) {
    const result = await fetchJson(joinUrl(base, pathName), {
      method: "GET",
      headers: authHeaders(apiKey),
    });
    if (result.ok) {
      const all = extractModels(result.data);
      const video = all.filter(looksLikeVideoModel);
      const chat = all.filter((id) => !looksLikeVideoModel(id));
      return {
        models: all,
        videoModels: video.length ? video : all,
        chatModels: chat.length ? chat : all,
      };
    }
    lastError = errorMessage(result.data, result.text, result.status);
  }
  throw new Error(lastError);
}

export async function generateVideo(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  seconds: number;
  size: string;
  image?: string;
}) {
  const base = normalizeBase(input.baseUrl);
  if (!base) throw new Error("请填写 API 地址");
  if (!input.model) throw new Error("请选择视频模型");
  if (!input.prompt) throw new Error("请填写提示词");
  const duration = Number(input.seconds) || 5;
  const [w, h] = String(input.size || "1280x720").split("x").map(Number);
  const bodies = [
    {
      model: input.model,
      prompt: input.prompt,
      seconds: String(duration),
      size: input.size || "1280x720",
      ...(input.image ? { input_reference: input.image } : {}),
    },
    {
      model: input.model,
      prompt: input.prompt,
      duration,
      width: w || 1280,
      height: h || 720,
      ...(input.image ? { image: input.image } : {}),
    },
    {
      model: input.model,
      prompt: input.prompt,
      n: 1,
      duration,
      size: input.size || "1280x720",
      ...(input.image ? { image: input.image } : {}),
    },
  ];
  const endpoints = ["/v1/videos", "/videos", "/v1/video/generations", "/v1/video/create", "/openai/v1/videos"];
  let lastError = "生成失败";
  for (const endpoint of endpoints) {
    for (const body of bodies) {
      const result = await fetchJson(
        joinUrl(base, endpoint),
        {
          method: "POST",
          headers: authHeaders(input.apiKey),
          body: JSON.stringify(body),
        },
        120000
      );
      if (result.ok) {
        const data = result.data as { id?: string; data?: { id?: string } };
        return {
          id: data?.id || data?.data?.id || "",
          videoUrl: pickVideoUrl(result.data),
        };
      }
      lastError = errorMessage(result.data, result.text, result.status);
      if (result.status === 401 || result.status === 403) throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

export async function pollVideoStatus(baseUrl: string, apiKey: string, id: string) {
  const base = normalizeBase(baseUrl);
  if (!base || !id) throw new Error("缺少任务信息");
  const endpoints = [
    `/v1/videos/${encodeURIComponent(id)}`,
    `/videos/${encodeURIComponent(id)}`,
    `/openai/v1/videos/${encodeURIComponent(id)}`,
  ];
  for (const endpoint of endpoints) {
    const result = await fetchJson(joinUrl(base, endpoint), {
      method: "GET",
      headers: authHeaders(apiKey),
    });
    if (result.ok) {
      const data = result.data as { status?: string; data?: { status?: string } };
      return {
        status: data?.status || data?.data?.status || "unknown",
        videoUrl: pickVideoUrl(result.data),
      };
    }
  }
  throw new Error("无法查询任务状态");
}

export async function inspireNext(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  history: string;
}) {
  const base = normalizeBase(input.baseUrl);
  const fallback = [
    `${input.prompt || "同一人物"}，镜头缓慢前推，光影更硬，留白更大，黑白胶片颗粒更明显。`,
    "切到侧面中景，人物停顿后抬眼，风吹动衣角，画风保持一致。",
    "夜晚街道长镜头，人物背影走入高对比光区，电影感黑白。",
  ];
  if (!base) return { ideas: fallback, note: "未配置 API，已给出本地分镜建议" };
  const chatModel = input.model || "gpt-4o-mini";
  const system = `你是电影分镜导演。根据已有镜头，写出下一段可直接用于视频生成的中文提示词。
要求：保持同一人物外貌、同一画风、同一光线逻辑；只输出 1 条提示词，不要解释，不要编号。长度 80-180 字。`;
  const user = [input.history ? `已有镜头：${input.history}` : "", `当前镜头：${input.prompt || "无"}`, "请给出下一段镜头提示词。"]
    .filter(Boolean)
    .join("\n");
  const result = await fetchJson(joinUrl(base, "/v1/chat/completions"), {
    method: "POST",
    headers: authHeaders(input.apiKey),
    body: JSON.stringify({
      model: chatModel,
      temperature: 0.9,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!result.ok) {
    return {
      ideas: fallback,
      note: errorMessage(result.data, result.text, result.status) || "对话模型不可用，已给出本地分镜建议",
    };
  }
  const text = pickText(result.data) || "";
  const ideas = text
    .split(/\n+/)
    .map((s) => s.replace(/^[\d.\-*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return { ideas: ideas.length ? ideas : [text] };
}
