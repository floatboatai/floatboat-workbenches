// ABOUTME: 设计器属性框里尚未通过校验的输入：作为草稿保留、可修改后应用或丢弃。
import { designerProperties, type DesignerDraft } from "../contracts/designer-draft";

export function DesignerDrafts({
  inputs,
  onEdit,
  onApply,
  onDiscard,
}: {
  inputs: DesignerDraft[];
  onEdit: (index: number, value: string) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="designer-drafts" aria-label="待应用的设计器属性">
      <div>
        <strong>待应用的属性输入</strong>
        <p>这些输入已作为草稿保留，尚未改变模板。修正后应用，或丢弃并回到当前版式。</p>
      </div>
      {inputs.map((item, index) => (
        <label key={`${item.field}-${item.property}`}>
          {item.field} · {designerProperties[item.property]}
          <input
            aria-label={`待应用 ${item.field} ${designerProperties[item.property]}`}
            value={item.value}
            maxLength={5000}
            autoComplete="off"
            onChange={(event) => onEdit(index, event.target.value)}
          />
        </label>
      ))}
      <button type="button" onClick={onApply}>
        应用属性草稿
      </button>
      <button type="button" onClick={onDiscard}>
        丢弃属性草稿
      </button>
    </section>
  );
}
