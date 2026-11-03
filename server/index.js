import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";
const distDir = path.resolve(__dirname, "../dist");

app.use(cors());
app.use(express.json({ limit: "40mb" }));

function normalizeBase(url) {
  if (!url) return "";
  return String(url).trim().replace(/\/+$/, "");
}

function joinUrl(base, pathname) {
  const b = normalizeBase(base);
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${b}${p}`;
}

function authHeaders(apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function extractModels(payload) {
  const names = new Set();
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      if (typeof node.id === "string") names.add(node.id);
      if (typeof node.model === "string") names.add(node.model);
      if (typeof node.name === "string" && /video|kling|runway|luma|sora|wan|veo|minimax|hailuo|cog|vid/i.test(node.name)) {
        names.add(node.name);
      }
      Object.values(node).forEach(visit);
    }
  };
  visit(payload);
  return [...names];
}

function looksLikeVideoModel(id) {
  return /video|kling|runway|luma|sora|wan|veo|minimax|hailuo|cogvideox|vidu|hunyuan|pika|lightricks|ltx|seedance|jimeng|doubao-seed|gen-3|gen3|gen-2/i.test(
    id
  );
}

async function fetchJson(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data, text };
  } finally {
    clearTimeout(timer);
  }
}

function pickVideoUrl(payload) {
  if (!payload) return "";
  const urls = [];
  const visit = (node) => {
    if (!node) return;
    if (typeof node === "string") {
      if (/^https?:\/\/.+\.(mp4|webm|mov)(\?|$)/i.test(node) || /\/video|mp4|cdn/i.test(node) && /^https?:\/\//.test(node)) {
        urls.push(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const keys = ["url", "video_url", "videoUrl", "mp4", "output", "file", "uri"];
      for (const key of keys) {
        if (typeof node[key] === "string" && /^https?:\/\//.test(node[key])) urls.push(node[key]);
      }
      Object.values(node).forEach(visit);
    }
  };
  visit(payload);
  const mp4 = urls.find((u) => /\.mp4(\?|$)/i.test(u));
  return mp4 || urls[0] || "";
}

function pickText(payload) {
  if (!payload) return "";
  const texts = [];
  const visit = (node) => {
    if (!node) return;
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      if (typeof node.content === "string") texts.push(node.content);
      if (typeof node.text === "string") texts.push(node.text);
      if (Array.isArray(node.content)) {
        node.content.forEach((c) => {
          if (typeof c?.text === "string") texts.push(c.text);
        });
      }
      Object.values(node).forEach(visit);
    }
  };
  visit(payload);
  return texts.join("\n").trim();
}

app.post("/api/models", async (req, res) => {
  const { baseUrl, apiKey } = req.body || {};
  const base = normalizeBase(baseUrl);
  if (!base) return res.status(400).json({ error: "请填写 API 地址" });

  const candidates = [
    "/v1/models",
    "/models",
    "/openai/v1/models",
    "/v1/video/models",
  ];
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
      return res.json({
        models: all,
        videoModels: video.length ? video : all,
        chatModels: chat.length ? chat : all,
        source: pathName,
      });
    }
    lastError = result.data?.error?.message || result.text || `HTTP ${result.status}`;
  }
  return res.status(400).json({ error: lastError });
});

app.post("/api/generate", async (req, res) => {
  const {
    baseUrl,
    apiKey,
    model,
    prompt,
    seconds,
    size,
    image,
    extra,
  } = req.body || {};
  const base = normalizeBase(baseUrl);
  if (!base) return res.status(400).json({ error: "请填写 API 地址" });
  if (!model) return res.status(400).json({ error: "请选择视频模型" });
  if (!prompt) return res.status(400).json({ error: "请填写提示词" });

  const duration = Number(seconds) || 5;
  const [w, h] = String(size || "1280x720").split("x").map(Number);
  const bodies = [
    {
      model,
      prompt,
      seconds: String(duration),
      size: size || "1280x720",
      ...(image ? { input_reference: image } : {}),
      ...(extra || {}),
    },
    {
      model,
      prompt,
      duration,
      width: w || 1280,
      height: h || 720,
      ...(image ? { image } : {}),
    },
    {
      model,
      prompt,
      n: 1,
      duration,
      size: size || "1280x720",
      ...(image ? { image } : {}),
    },
  ];

  const endpoints = [
    "/v1/videos",
    "/videos",
    "/v1/video/generations",
    "/v1/video/create",
    "/openai/v1/videos",
  ];

  let lastError = "生成失败";
  for (const endpoint of endpoints) {
    for (const body of bodies) {
      const result = await fetchJson(
        joinUrl(base, endpoint),
        {
          method: "POST",
          headers: authHeaders(apiKey),
          body: JSON.stringify(body),
        },
        120000
      );
      if (result.ok) {
        const videoUrl = pickVideoUrl(result.data);
        const id = result.data?.id || result.data?.data?.id || "";
        return res.json({
          ok: true,
          id,
          videoUrl,
          raw: result.data,
          endpoint,
        });
      }
      lastError = result.data?.error?.message || result.text || `HTTP ${result.status}`;
      if (result.status === 401 || result.status === 403) {
        return res.status(result.status).json({ error: lastError });
      }
    }
  }
  return res.status(400).json({ error: lastError });
});

app.post("/api/video-status", async (req, res) => {
  const { baseUrl, apiKey, id } = req.body || {};
  const base = normalizeBase(baseUrl);
  if (!base || !id) return res.status(400).json({ error: "缺少任务信息" });
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
      return res.json({
        status: result.data?.status || result.data?.data?.status || "unknown",
        videoUrl: pickVideoUrl(result.data),
        raw: result.data,
      });
    }
  }
  return res.status(400).json({ error: "无法查询任务状态" });
});

app.post("/api/inspire", async (req, res) => {
  const { baseUrl, apiKey, model, prompt, history } = req.body || {};
  const base = normalizeBase(baseUrl);
  if (!base) return res.status(400).json({ error: "请填写 API 地址" });
  const chatModel = model || "gpt-4o-mini";
  const system = `你是电影分镜导演。根据已有镜头，写出下一段可直接用于视频生成的中文提示词。
要求：保持同一人物外貌、同一画风、同一光线逻辑；只输出 1 条提示词，不要解释，不要编号。长度 80-180 字。`;
  const user = [
    history ? `已有镜头：${history}` : "",
    `当前镜头：${prompt || "无"}`,
    "请给出下一段镜头提示词。",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await fetchJson(joinUrl(base, "/v1/chat/completions"), {
    method: "POST",
    headers: authHeaders(apiKey),
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
    const fallback = [
      `${prompt || "同一人物"}，镜头缓慢前推，光影更硬，留白更大，黑白胶片颗粒更明显。`,
      `切到侧面中景，人物停顿后抬眼，风吹动衣角，画风保持一致。`,
      `夜晚街道长镜头，人物背影走入高对比光区，电影感黑白。`,
    ];
    return res.json({
      ideas: fallback,
      note: result.data?.error?.message || "对话模型不可用，已给出本地分镜建议",
    });
  }

  const text = pickText(result.data) || "";
  const ideas = text
    .split(/\n+/)
    .map((s) => s.replace(/^[\d\.\-\*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return res.json({ ideas: ideas.length ? ideas : [text] });
});

if (isProd && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NOIR api on ${PORT}`);
});
