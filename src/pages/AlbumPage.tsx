import { sizeLabel, type Clip } from "../types";
import { downloadUrl } from "../storage";

type Props = {
  album: Clip[];
  onReplay: (clip: Clip) => void;
  onRemove: (id: string) => void;
};

export default function AlbumPage({ album, onReplay, onRemove }: Props) {
  return (
    <div className="page-single">
      <section className="panel">
        <div className="page-head">
          <h2>本地相册</h2>
          <span className="page-kicker">{album.length} clips</span>
        </div>
        <p className="empty-note">视频保存在本机 IndexedDB，刷新仍在。回看会跳转到生成页。</p>
        {album.length === 0 ? <p className="empty-note">还没有收藏。</p> : null}
        <div className="album-grid">
          {album.map((clip) => (
            <article key={clip.id} className="clip">
              <video
                src={clip.videoUrl}
                muted
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              <h3>{clip.title}</h3>
              <p>
                {sizeLabel(clip.size)} · {clip.seconds} 秒 · {new Date(clip.createdAt).toLocaleString()}
              </p>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="tiny" onClick={() => onReplay(clip)}>
                  回看
                </button>
                <button className="tiny" onClick={() => downloadUrl(clip.videoUrl, `${clip.title}.mp4`)}>
                  导出
                </button>
                <button className="tiny" onClick={() => onRemove(clip.id)}>
                  移除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
