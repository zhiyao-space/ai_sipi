import type { Person } from "../types";

type Props = {
  people: Person[];
  selectedPeople: string[];
  onAddEmpty: () => void;
  onUpload: (file: File, personId?: string) => void;
  onToggle: (id: string) => void;
  onChange: (id: string, patch: Partial<Person>) => void;
  onRemove: (id: string) => void;
};

export default function CastPage({
  people,
  selectedPeople,
  onAddEmpty,
  onUpload,
  onToggle,
  onChange,
  onRemove,
}: Props) {
  return (
    <div className="page-single">
      <section className="panel">
        <div className="page-head">
          <h2>人物形象</h2>
          <span className="page-kicker">{selectedPeople.length} 选出镜</span>
        </div>
        <p className="empty-note">上传形象图并备注名称。点选卡片即可加入生成镜头，外貌会写入提示词。</p>
        <div className="btn-row">
          <button className="btn ghost" onClick={onAddEmpty}>
            添加人物
          </button>
          <label className="btn ghost upload">
            上传形象
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="people-grid">
          {people.length === 0 ? <p className="empty-note">还没有人物。先添加或上传一张形象图。</p> : null}
          {people.map((p) => (
            <div
              key={p.id}
              className={`person person-card ${selectedPeople.includes(p.id) ? "on" : ""}`}
              onClick={() => onToggle(p.id)}
            >
              {p.image ? (
                <img className="avatar avatar-lg" src={p.image} alt="" />
              ) : (
                <div className="avatar avatar-lg empty">NO IMG</div>
              )}
              <div>
                <input
                  type="text"
                  value={p.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onChange(p.id, { name: e.target.value })}
                  placeholder="名称"
                />
                <input
                  type="text"
                  value={p.note}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onChange(p.id, { note: e.target.value })}
                  placeholder="备注：年龄 / 服装 / 气质"
                  style={{ marginTop: 6 }}
                />
              </div>
              <div className="person-actions">
                <label className="tiny upload" onClick={(e) => e.stopPropagation()}>
                  图
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(file, p.id);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  className="tiny"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(p.id);
                  }}
                >
                  删
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
