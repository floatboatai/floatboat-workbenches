import { shelf } from "../contracts/catalog";

/** Categorised equipment shelf; a click places a preset element in the middle of the view. */
export function Shelf({ disabled, onAdd }: { disabled: boolean; onAdd(type: string): void }) {
  return (
    <nav className="shelf" aria-label="器材架">
      <p className="shelf-title">器材架</p>
      {shelf.map((group) => (
        <section key={group.id} className="shelf-group" aria-labelledby={"shelf-" + group.id}>
          <h2 id={"shelf-" + group.id}>{group.label}</h2>
          <div className="shelf-items">
            {group.items.map((item) => (
              <button
                key={item.type}
                type="button"
                disabled={disabled}
                title={item.hint}
                aria-label={"放置" + item.label + "：" + item.hint}
                onClick={() => onAdd(item.type)}
              >
                <span className="glyph" aria-hidden="true">
                  {item.glyph}
                </span>
                <span className="shelf-label">{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
