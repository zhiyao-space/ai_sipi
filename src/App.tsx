import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_STYLES,
  LS_KEY,
  PAGES,
  sizeLabel,
  type ApiState,
  type Clip,
  type PageId,
  type Person,
  type StyleItem,
} from "./types";
import { blobUrlToDataUrl, dbAll, dbDel, dbPut, fileToDataUrl, hashToPage, uid } from "./storage";
import { detectModels as fetchModels, generateVideo, inspireNext, pollVideoStatus } from "./api";
import StudioPage from "./pages/StudioPage";
import CastPage from "./pages/CastPage";
import StylesPage from "./pages/StylesPage";
import AlbumPage from "./pages/AlbumPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const [page, setPage] = useState<PageId>(() => hashToPage(window.location.hash));
  const [api, setApi] = useState<ApiState>({
    baseUrl: "",
    apiKey: "",
    videoModel: "",
    chatModel: "",
    videoModels: [],
    chatModels: [],
  });
  const [people, setPeople] = useState<Person[]>([]);
  const [styles, setStyles] = useState<StyleItem[]>(DEFAULT_STYLES);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [styleId, setStyleId] = useState("s1");
  const [lockStyle, setLockStyle] = useState(true);
  const [size, setSize] = useState("1280x720");
  const [seconds, setSeconds] = useState(5);
  const [prompt, setPrompt] = useState(
    "中年男人独自站在雨后的水泥天台，香烟将灭，远处城市灯火被压成灰阶。缓慢推近，风掀起大衣下摆。"
  );
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("等待配置 API");
  const [videoUrl, setVideoUrl] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [album, setAlbum] = useState<Clip[]>([]);
  const [toast, setToast] = useState("");
  const [newStyleName, setNewStyleName] = useState("");
  const [newStylePrompt, setNewStylePrompt] = useState("");
  const detectTimer = useRef<number | null>(null);
  const loaded = useRef(false);

  function go(next: PageId | string) {
    const id = hashToPage(`#/${next}`);
    setPage(id);
    window.location.hash = `/${id}`;
  }

  useEffect(() => {
    const onHash = () => setPage(hashToPage(window.location.hash));
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.hash = "/studio";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.api)
          setApi((prev) => ({
            ...prev,
            ...data.api,
            videoModels: data.api.videoModels || [],
            chatModels: data.api.chatModels || [],
          }));
        if (data.people) setPeople(data.people);
        if (data.styles) setStyles(data.styles);
        if (data.styleId) setStyleId(data.styleId);
        if (typeof data.lockStyle === "boolean") setLockStyle(data.lockStyle);
        if (data.size) setSize(data.size);
        if (data.seconds) setSeconds(data.seconds);
        if (data.prompt) setPrompt(data.prompt);
        if (data.selectedPeople) setSelectedPeople(data.selectedPeople);
      }
    } catch {}
    dbAll()
      .then(setAlbum)
      .catch(() => setAlbum([]));
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const payload = {
      api: { ...api, apiKey: api.apiKey },
      people,
      styles,
      styleId,
      lockStyle,
      size,
      seconds,
      prompt,
      selectedPeople,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }, [api, people, styles, styleId, lockStyle, size, seconds, prompt, selectedPeople]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const activeStyle = styles.find((s) => s.id === styleId) || styles[0];
  const cast = people.filter((p) => selectedPeople.includes(p.id));
  const current = PAGES.find((p) => p.id === page) || PAGES[0];

  const composedPrompt = useMemo(() => {
    const characterBlock = cast
      .map((p) => {
        const face = p.note ? `${p.name}（${p.note}）` : p.name;
        return face;
      })
      .join("、");
    const styleBlock =
      lockStyle && activeStyle
        ? `画风锁定：${activeStyle.name}。${activeStyle.prompt}`
        : activeStyle
          ? `画风：${activeStyle.name}。${activeStyle.prompt}`
          : "";
    return [characterBlock ? `出镜人物：${characterBlock}。保持人物外貌一致。` : "", styleBlock, prompt]
      .filter(Boolean)
      .join("\n");
  }, [cast, activeStyle, lockStyle, prompt]);

  async function detectModels(next = api) {
    if (!next.baseUrl.trim()) {
      setStatus("填写 API 地址后自动识别模型");
      return;
    }
    setBusy("detect");
    setStatus("正在识别模型…");
    try {
      const data = await fetchModels(next.baseUrl, next.apiKey);
      const videoModels = data.videoModels?.length ? data.videoModels : data.models || [];
      const chatModels = data.chatModels?.length ? data.chatModels : data.models || [];
      setApi((prev) => ({
        ...prev,
        videoModels,
        chatModels,
        videoModel: videoModels.includes(prev.videoModel) ? prev.videoModel : videoModels[0] || "",
        chatModel: chatModels.includes(prev.chatModel) ? prev.chatModel : chatModels[0] || "",
      }));
      setStatus(`已识别 ${videoModels.length} 个视频模型 / ${chatModels.length} 个对话模型`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "识别失败");
    } finally {
      setBusy("");
    }
  }

  function scheduleDetect(next: ApiState) {
    if (detectTimer.current) window.clearTimeout(detectTimer.current);
    detectTimer.current = window.setTimeout(() => detectModels(next), 700);
  }

  function patchApi(partial: Partial<ApiState>) {
    const next = { ...api, ...partial };
    setApi(next);
    if ("baseUrl" in partial || "apiKey" in partial) scheduleDetect(next);
  }

  async function addPersonImage(file: File, personId?: string) {
    const image = await fileToDataUrl(file);
    if (personId) {
      setPeople((list) => list.map((p) => (p.id === personId ? { ...p, image } : p)));
      return;
    }
    const person: Person = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 18) || "未命名",
      note: "",
      image,
    };
    setPeople((list) => [person, ...list]);
    setSelectedPeople((ids) => [...ids, person.id]);
  }

  function addEmptyPerson() {
    const person: Person = { id: uid(), name: `人物 ${people.length + 1}`, note: "", image: "" };
    setPeople((list) => [person, ...list]);
    setSelectedPeople((ids) => [...ids, person.id]);
  }

  function addStyle() {
    if (!newStyleName.trim()) return;
    const item: StyleItem = {
      id: uid(),
      name: newStyleName.trim(),
      prompt: newStylePrompt.trim() || newStyleName.trim(),
    };
    setStyles((list) => [...list, item]);
    setStyleId(item.id);
    setNewStyleName("");
    setNewStylePrompt("");
  }

  async function pollVideo(id: string) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const data = await pollVideoStatus(api.baseUrl, api.apiKey, id);
      if (data.videoUrl) return data.videoUrl;
      const st = String(data.status || "");
      setStatus(`生成中 · ${st || "queued"} · ${i + 1}/40`);
      if (["failed", "error", "cancelled"].includes(st.toLowerCase())) throw new Error("任务失败");
    }
    throw new Error("等待超时");
  }

  async function generate() {
    if (!api.baseUrl) {
      setToast("先填写 API 地址");
      go("settings");
      return;
    }
    if (!api.videoModel) {
      setToast("先识别并选择模型");
      go("settings");
      return;
    }
    setBusy("gen");
    setStatus("提交生成任务…");
    try {
      const firstImage = cast.find((p) => p.image)?.image || "";
      const data = await generateVideo({
        baseUrl: api.baseUrl,
        apiKey: api.apiKey,
        model: api.videoModel,
        prompt: composedPrompt,
        seconds,
        size,
        image: firstImage,
      });
      let url = data.videoUrl;
      if (!url && data.id) url = await pollVideo(data.id);
      if (!url) throw new Error("接口已响应，但未返回视频地址");
      setVideoUrl(url);
      setStatus("生成完成");
      setToast("视频已就绪");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusy("");
    }
  }

  async function saveAlbum() {
    if (!videoUrl) return setToast("还没有可保存的视频");
    setBusy("save");
    try {
      const stored = await blobUrlToDataUrl(videoUrl).catch(() => videoUrl);
      const clip: Clip = {
        id: uid(),
        title: prompt.slice(0, 18) || "未命名镜头",
        prompt: composedPrompt,
        videoUrl: stored,
        poster: cast.find((p) => p.image)?.image || "",
        createdAt: Date.now(),
        size,
        seconds,
        model: api.videoModel,
      };
      await dbPut(clip);
      setAlbum((list) => [clip, ...list]);
      setToast("已保存到本地相册");
    } catch {
      setToast("保存失败");
    } finally {
      setBusy("");
    }
  }

  async function inspire() {
    setBusy("idea");
    setStatus("正在生成后续分镜…");
    try {
      const data = await inspireNext({
        baseUrl: api.baseUrl,
        apiKey: api.apiKey,
        model: api.chatModel,
        prompt: composedPrompt,
        history: album
          .slice(0, 3)
          .map((c) => c.prompt)
          .join(" / "),
      });
      const list = (data.ideas || []).filter(Boolean);
      setIdeas(list);
      setStatus(data.note || "已给出后续灵感");
    } catch {
      setStatus("灵感生成失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-kicker">Monochrome Atelier</div>
          <div className="brand-title">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.png`} alt="NOIR" />
            <h1>NOIR</h1>
          </div>
          <p>{current.kicker} · {current.label}</p>
        </div>
        <nav className="nav">
          {PAGES.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${page === item.id ? "on" : ""}`}
              onClick={() => go(item.id)}
            >
              <small>{item.kicker}</small>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="top-meta">
          <span>{sizeLabel(size)}</span>
          <span>{seconds} 秒</span>
          <span>{album.length} clips</span>
        </div>
      </header>

      {page === "studio" ? (
        <StudioPage
          videoUrl={videoUrl}
          busy={busy}
          status={status}
          prompt={prompt}
          composedPrompt={composedPrompt}
          size={size}
          seconds={seconds}
          ideas={ideas}
          lockStyle={lockStyle}
          activeStyle={activeStyle}
          cast={cast}
          onPrompt={setPrompt}
          onSize={setSize}
          onSeconds={setSeconds}
          onGenerate={generate}
          onSave={saveAlbum}
          onInspire={inspire}
          onGo={go}
        />
      ) : null}

      {page === "cast" ? (
        <CastPage
          people={people}
          selectedPeople={selectedPeople}
          onAddEmpty={addEmptyPerson}
          onUpload={addPersonImage}
          onToggle={(id) =>
            setSelectedPeople((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
          }
          onChange={(id, patch) => setPeople((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
          onRemove={(id) => {
            setPeople((list) => list.filter((x) => x.id !== id));
            setSelectedPeople((ids) => ids.filter((x) => x !== id));
          }}
        />
      ) : null}

      {page === "styles" ? (
        <StylesPage
          styles={styles}
          styleId={styleId}
          lockStyle={lockStyle}
          newStyleName={newStyleName}
          newStylePrompt={newStylePrompt}
          onSelect={setStyleId}
          onLock={() => setLockStyle((v) => !v)}
          onName={setNewStyleName}
          onPrompt={setNewStylePrompt}
          onAdd={addStyle}
          onRemove={(id) => {
            setStyles((list) => list.filter((s) => s.id !== id));
            if (styleId === id) setStyleId(styles.find((s) => s.id !== id)?.id || "");
          }}
        />
      ) : null}

      {page === "album" ? (
        <AlbumPage
          album={album}
          onReplay={(clip) => {
            setVideoUrl(clip.videoUrl);
            setPrompt(clip.prompt);
            go("studio");
          }}
          onRemove={async (id) => {
            await dbDel(id);
            setAlbum((list) => list.filter((x) => x.id !== id));
          }}
        />
      ) : null}

      {page === "settings" ? (
        <SettingsPage api={api} busy={busy} status={status} onPatch={patchApi} onDetect={() => detectModels()} />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
