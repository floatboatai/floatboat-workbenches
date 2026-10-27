import type { Deck } from "../contracts/deck.ts";
export function DeckSettings({
  data,
  onChange,
}: {
  data: Deck;
  onChange: (value: Partial<Omit<Deck, "slides" | "version">>) => void;
}) {
  return (
    <section className="settings" aria-label="显示设置">
      <div className="section-heading">
        <h2>舞台设置</h2>
        <span>跟随演示保存</span>
      </div>
      <div className="settings-row">
        <fieldset className="themes">
          <legend>配色</legend>
          {(
            [
              ["forest", "松绿"],
              ["paper", "纸白"],
              ["night", "深蓝"],
            ] as const
          ).map(([value, name]) => (
            <label key={value} className={"theme-choice " + value}>
              <input
                type="radio"
                name="theme"
                checked={data.theme === value}
                onChange={() => onChange({ theme: value })}
              />
              <span aria-hidden="true" />
              {name}
            </label>
          ))}
        </fieldset>
        <label>
          画幅
          <select
            aria-label="画幅"
            name="ratio"
            value={data.ratio}
            onChange={(e) =>
              onChange({ ratio: e.target.value as Deck["ratio"] })
            }
          >
            <option value="wide">16:9 宽屏</option>
            <option value="classic">4:3 标准</option>
          </select>
        </label>
        <label>
          过渡
          <select
            aria-label="过渡"
            name="transition"
            value={data.transition}
            onChange={(e) =>
              onChange({ transition: e.target.value as Deck["transition"] })
            }
          >
            <option value="fade">淡入</option>
            <option value="slide">滑动</option>
            <option value="none">无过渡</option>
          </select>
        </label>
      </div>
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={data.fragments}
            onChange={(e) => onChange({ fragments: e.target.checked })}
          />
          列表逐项出现
        </label>
        <label>
          <input
            type="checkbox"
            checked={data.numbers}
            onChange={(e) => onChange({ numbers: e.target.checked })}
          />
          显示页码
        </label>
        <span>一页，一件事。让观点有呼吸。</span>
      </div>
    </section>
  );
}
