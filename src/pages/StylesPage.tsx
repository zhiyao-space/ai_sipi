import type { StyleItem } from "../types";

type Props = {
  styles: StyleItem[];
  styleId: string;
  lockStyle: boolean;
  newStyleName: string;
  newStylePrompt: string;
  onSelect: (id: string) => void;
  onLock: () => void;
  onName: (v: string) => void;
  onPrompt: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export default function StylesPage({
  styles,
  styleId,
  lockStyle,
  newStyleName,
  newStylePrompt,
  onSelect,
  onLock,
  onName,
  onPrompt,
  onAdd,
  onRemove,
}: Props) {
  return (
    <div className="page-single">
      <section className="panel">
        <div className="page-head">
          <h2>画风</h2>
          <button className={`btn ${lockStyle ? "" : "ghost"}`} onClick={onLock}>
            {lockStyle ? "画风已锁定" : "锁定画风"}
          </button>
        </div>
        <p className="empty-note">锁定后，每次生成都会沿用同一套光线、颗粒与构图语言。</p>
        <div className="style-grid">
          {styles.map((s) => (
            <div key={s.id} className={`style-card style-tile ${styleId === s.id ? "on" : ""}`}>
              <button className="style-pick" onClick={() => onSelect(s.id)}>
                <strong>{s.name}</strong>
                <small>{s.prompt}</small>
              </button>
              <div className="style-foot">
                {styleId === s.id ? <span>选用</span> : <span />}
                {s.id.startsWith("s") && s.id.length <= 3 ? null : (
                  <button className="tiny" onClick={() => onRemove(s.id)}>
                    删
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="section-label">新增画风</div>
        <div className="row">
          <input type="text" placeholder="新画风名称" value={newStyleName} onChange={(e) => onName(e.target.value)} />
          <input type="text" placeholder="画风描述" value={newStylePrompt} onChange={(e) => onPrompt(e.target.value)} />
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={onAdd}>
            添加画风
          </button>
        </div>
      </section>
    </div>
  );
}
