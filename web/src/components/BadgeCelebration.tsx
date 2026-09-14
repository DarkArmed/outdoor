import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
export function BadgeCelebration({
  badge,
  fullStar,
  milestones,
  onClose,
}: {
  badge: { icon: string; name: string };
  fullStar: boolean;
  milestones: { icon: string; name: string }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="badge-modal-dialog legacy-page"
      aria-labelledby="unlock-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={`badge-card${fullStar ? " full-star" : ""}`}>
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="confetti"
            style={{
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 8) * 0.12}s`,
            }}
          >
            {["🎉", "✨", "🎊", "⭐"][i % 4]}
          </span>
        ))}
        <div className="badge-big" aria-hidden="true">
          {badge.icon}
        </div>
        <h2 id="unlock-title">
          {fullStar ? "🌟 满星通关！" : "🎉 解锁徽章！"}
        </h2>
        <p className="badge-big-name">
          {badge.icon} {badge.name}
        </p>
        {milestones.length > 0 && (
          <p className="badge-ms">
            同时解锁里程碑：
            {milestones.map((m) => `${m.icon} ${m.name}`).join("、")}
          </p>
        )}
        <div className="badge-actions">
          <Link className="badge-link" to="/?panel=badges">
            去看看徽章墙 →
          </Link>
          <button className="badge-close" onClick={onClose}>
            继续看计划
          </button>
        </div>
      </div>
    </dialog>
  );
}
