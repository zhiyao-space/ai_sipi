import { DURATIONS, SIZES, sizeLabel, type Person, type StyleItem } from "../types";
import { downloadUrl } from "../storage";

type Props = {
  videoUrl: string;
  busy: string;
  status: string;
  prompt: string;
  composedPrompt: string;
  size: string;
  seconds: number;
  ideas: string[];
  lockStyle: boolean;
  activeStyle?: StyleItem;
  cast: Person[];
  onPrompt: (v: string) => void;
  onSize: (v: string) => void;
  onSeconds: (v: number) => void;
  onGenerate: () => void;
  onSave: () => void;
  onInspire: () => void;
  onGo: (page: string) => void;
};

export default function StudioPage({
  videoUrl,
  busy,
  status,
  prompt,
  composedPrompt,
  size,
  seconds,
  ideas,
  lockStyle,
  activeStyle,
  cast,
  onPrompt,
  onSize,
  onSeconds,
  onGenerate,
  onSave,
  onInspire,
  onGo,
}: Props) {
  const meterCount = busy ? 8 : videoUrl ? 8 : 2;

  return (
    <div className="page-grid studio-grid">
      <section className="panel preview-panel">
        <div className="page-head">
          <h2>画幅</h2>
          <span className="page-kicker">{sizeLabel(size)} · {seconds} 秒</span>
        </div>
        <div className="preview-stage">
          {videoUrl ? (
            <video src={videoUrl} controls autoPlay loop />
          ) : (
            <div className="placeholder">
              <b>FRAME 00</b>
              黑白画幅等待曝光
              <div className="meter">
                {Array.from({ length: 8 }).map((_, i) => (
                  <i key={i} className={i < meterCount ? "on" : ""} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="page-head">
          <h2>镜头</h2>
        </div>

        <div className="summary-row">
          <button className="summary" onClick={() => onGo("cast")}>
            <span>人物</span>
            <b>{cast.length ? cast.map((p) => p.name).join(" / ") : "未选择"}</b>
          </button>
          <button className="summary" onClick={() => onGo("styles")}>
            <span>画风 {lockStyle ? "已锁定" : ""}</span>
            <b>{activeStyle?.name || "未选择"}</b>
          </button>
        </div>

        <div className="section-label">画面尺寸</div>
        <div className="chip-row size-chips">
          {SIZES.map((s) => (
            <button key={s.id} className={`chip size-chip ${size === s.value ? "on" : ""}`} onClick={() => onSize(s.value)}>
              <b>{s.label}</b>
              <small>{s.hint}</small>
            </button>
          ))}
        </div>
        <div className="custom-box">
          <span>自定义宽高（像素）</span>
          <div className="row custom-size">
            <input
              type="number"
              min={256}
              max={3840}
              placeholder="宽"
              value={size.split("x")[0] || ""}
              onChange={(e) => {
                const w = Number(e.target.value) || 0;
                const h = Number(size.split("x")[1]) || 720;
                if (w > 0) onSize(`${w}x${h}`);
              }}
            />
            <em>×</em>
            <input
              type="number"
              min={256}
              max={3840}
              placeholder="高"
              value={size.split("x")[1] || ""}
              onChange={(e) => {
                const w = Number(size.split("x")[0]) || 1280;
                const h = Number(e.target.value) || 0;
                if (h > 0) onSize(`${w}x${h}`);
              }}
            />
          </div>
        </div>

        <div className="section-label">视频时长</div>
        <div className="chip-row">
          {DURATIONS.map((n) => (
            <button key={n} className={`chip ${seconds === n ? "on" : ""}`} onClick={() => onSeconds(n)}>
              {n} 秒
            </button>
          ))}
        </div>
        <div className="custom-box">
          <span>自定义秒数</span>
          <input
            type="number"
            min={1}
            max={60}
            value={seconds}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1) onSeconds(Math.min(60, Math.round(n)));
            }}
          />
        </div>

        <div className="section-label">提示词</div>
        <textarea value={prompt} onChange={(e) => onPrompt(e.target.value)} />
        <p className="empty-note">合成后：{composedPrompt}</p>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!!busy} onClick={onGenerate}>
            {busy === "gen" ? "生成中" : "生成视频"}
          </button>
          <button className="btn ghost" disabled={!!busy || !videoUrl} onClick={onSave}>
            保存到相册
          </button>
          <button className="btn ghost" disabled={!!busy} onClick={onInspire}>
            AI 后续灵感
          </button>
          {videoUrl ? (
            <button className="btn ghost" onClick={() => downloadUrl(videoUrl, `noir-${Date.now()}.mp4`)}>
              下载
            </button>
          ) : null}
        </div>
        <div className="status">{status}</div>
        {ideas.map((idea) => (
          <div key={idea} className="idea" onClick={() => onPrompt(idea)}>
            {idea}
          </div>
        ))}
      </section>
    </div>
  );
}
