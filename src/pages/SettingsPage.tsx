import type { ApiState } from "../types";

type Props = {
  api: ApiState;
  busy: string;
  status: string;
  onPatch: (partial: Partial<ApiState>) => void;
  onDetect: () => void;
};

export default function SettingsPage({ api, busy, status, onPatch, onDetect }: Props) {
  return (
    <div className="page-single settings-page">
      <section className="panel">
        <div className="page-head">
          <h2>API 配置</h2>
        </div>
        <p className="empty-note">填完地址和密钥后自动识别可用模型。兼容 OpenAI 风格 /v1/models 与视频接口。</p>
        <label className="field">
          <span>接口地址</span>
          <input
            type="text"
            placeholder="https://api.example.com"
            value={api.baseUrl}
            onChange={(e) => onPatch({ baseUrl: e.target.value })}
          />
        </label>
        <label className="field">
          <span>密钥</span>
          <input
            type="password"
            placeholder="sk-..."
            value={api.apiKey}
            onChange={(e) => onPatch({ apiKey: e.target.value })}
          />
        </label>
        <div className="btn-row">
          <button className="btn ghost" disabled={!!busy} onClick={onDetect}>
            识别模型
          </button>
        </div>
        <label className="field">
          <span>视频模型</span>
          <select value={api.videoModel} onChange={(e) => onPatch({ videoModel: e.target.value })}>
            <option value="">等待识别</option>
            {api.videoModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>灵感模型</span>
          <select value={api.chatModel} onChange={(e) => onPatch({ chatModel: e.target.value })}>
            <option value="">可选</option>
            {api.chatModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div className="status">{status}</div>
      </section>
    </div>
  );
}
