// ABOUTME: 由正文标题生成的目录：宽屏时停靠在稿纸左侧，窄屏时作为弹出列表；随滚动标出当前章节。
import { memo, useEffect, useState } from "react";
import type { OutlineItem } from "../contracts/domain";

/** 当前视口顶部所在的标题序号。 */
export function useActiveHeading(count: number): number {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!count) {
      setActive(-1);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const headings = document.querySelectorAll<HTMLElement>(".writing-editor .tiptap :is(h1, h2, h3)");
      let index = -1;
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 150) index = i;
        else break;
      }
      setActive(index);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count]);
  return active;
}

export const Outline = memo(function Outline({
  items,
  active,
  onSelect,
  id,
}: {
  items: OutlineItem[];
  active: number;
  onSelect: (index: number) => void;
  id?: string;
}) {
  if (!items.length)
    return <p className="outline-empty">添加标题（键入 / 或用「段落样式」）后，这里会生成目录。</p>;
  return (
    <ol className="outline-list" id={id}>
      {items.map((item) => (
        <li key={item.index} className={`level-${item.level}`}>
          <button
            type="button"
            aria-current={item.index === active ? "location" : undefined}
            onClick={() => onSelect(item.index)}
          >
            {item.text || "（空标题）"}
          </button>
        </li>
      ))}
    </ol>
  );
});
