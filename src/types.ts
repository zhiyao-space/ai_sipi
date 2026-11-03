export type Person = {
  id: string;
  name: string;
  note: string;
  image: string;
};

export type StyleItem = {
  id: string;
  name: string;
  prompt: string;
};

export type Clip = {
  id: string;
  title: string;
  prompt: string;
  videoUrl: string;
  poster: string;
  createdAt: number;
  size: string;
  seconds: number;
  model: string;
};

export type ApiState = {
  baseUrl: string;
  apiKey: string;
  videoModel: string;
  chatModel: string;
  videoModels: string[];
  chatModels: string[];
};

export type PageId = "studio" | "cast" | "styles" | "album" | "settings";

export const PAGES: { id: PageId; label: string; kicker: string }[] = [
  { id: "studio", label: "生成", kicker: "01 Studio" },
  { id: "cast", label: "人物", kicker: "02 Cast" },
  { id: "styles", label: "画风", kicker: "03 Style" },
  { id: "album", label: "相册", kicker: "04 Album" },
  { id: "settings", label: "设置", kicker: "05 API" },
];

export const SIZES = [
  { id: "1280x720", label: "横屏", hint: "16:9 电脑/电视", value: "1280x720" },
  { id: "1920x1080", label: "全高清", hint: "横屏更清晰", value: "1920x1080" },
  { id: "720x1280", label: "竖屏", hint: "9:16 手机全屏", value: "720x1280" },
  { id: "1080x1920", label: "竖屏高清", hint: "短视频常用", value: "1080x1920" },
  { id: "1024x1024", label: "方形", hint: "1:1 封面/朋友圈", value: "1024x1024" },
];

export const DURATIONS = [3, 4, 5, 6, 8, 10];

export function sizeLabel(size: string) {
  const hit = SIZES.find((s) => s.value === size);
  if (hit) return `${hit.label} ${hit.hint}`;
  return `自定义 ${size.replace("x", "×")}`;
}

export const DEFAULT_STYLES: StyleItem[] = [
  {
    id: "s1",
    name: "黑白胶片",
    prompt: "high-contrast black and white 35mm film, grain, chiaroscuro lighting, cinematic still",
  },
  {
    id: "s2",
    name: "水墨留白",
    prompt: "ink wash painting, sparse composition, white space, dry brush texture, monochrome",
  },
  {
    id: "s3",
    name: "建筑硬光",
    prompt: "brutalist architecture, hard light, long shadows, geometric frames, monochrome photography",
  },
];

export const LS_KEY = "noir.studio.v1";
