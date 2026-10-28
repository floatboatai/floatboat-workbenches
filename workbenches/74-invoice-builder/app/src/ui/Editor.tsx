import type {
  InvoiceData,
  Party,
  Line,
  ImageAsset,
} from "../contracts/document";
import { MAX_ITEMS, imageUrl } from "../contracts/document";
type Setter = (change: (d: InvoiceData) => InvoiceData) => void;
function Field({
  label,
  value,
  onChange,
  max = 160,
  multi = false,
  decimal = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multi?: boolean;
  decimal?: boolean;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multi ? (
        <textarea
          name={label}
          aria-label={label}
          value={value}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : (
        <input
          name={label}
          aria-label={label}
          autoComplete="off"
          type={type}
          inputMode={decimal ? "decimal" : undefined}
          value={value}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
function PartyFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Party;
  onChange: (v: Party) => void;
}) {
  return (
    <section className="editor-section">
      <h2>{title}</h2>
      <Field
        label={title + "名称"}
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
      />
      <Field
        label={title + "地址"}
        value={value.address}
        max={500}
        multi
        onChange={(address) => onChange({ ...value, address })}
      />
      <div className="field-pair">
        <Field
          label={title + "邮箱"}
          value={value.email}
          onChange={(email) => onChange({ ...value, email })}
        />
        <Field
          label={title + "电话"}
          max={80}
          value={value.phone}
          onChange={(phone) => onChange({ ...value, phone })}
        />
      </div>
      <Field
        label={title + "登记信息"}
        max={120}
        value={value.registration}
        onChange={(registration) => onChange({ ...value, registration })}
      />
    </section>
  );
}
function ImageField({
  title,
  asset,
  onAttach,
  onRemove,
  busy,
}: {
  title: string;
  asset: ImageAsset | null;
  onAttach: (f: File) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="image-field">
      <span>{title}</span>
      {asset ? (
        <>
          <img src={imageUrl(asset)} width={88} height={64} alt={title} />
          <small>{asset.name}</small>
          <button
            type="button"
            onClick={() => {
              if (confirm("移除" + title + "？")) onRemove();
            }}
          >
            移除{title}
          </button>
        </>
      ) : (
        <p>PNG / JPEG · 150 KiB以内</p>
      )}
      <label className="file-button">
        {busy ? "正在读取…" : "选择" + title}
        <input
          aria-label={"上传" + title}
          disabled={busy}
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onAttach(file);
          }}
        />
      </label>
    </div>
  );
}
export function Editor({
  data,
  setData,
  section,
  assetBusy,
  attach,
}: {
  data: InvoiceData;
  setData: Setter;
  section: string;
  assetBusy: boolean;
  attach: (slot: "logo" | "signature", file: File) => void;
}) {
  const set = (key: keyof InvoiceData, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));
  const line = (id: string, key: keyof Line, value: string) =>
    setData((d) => ({
      ...d,
      items: d.items.map((l) => (l.id === id ? { ...l, [key]: value } : l)),
    }));
  return (
    <div className="editor-content">
      {section === "document" ? (
        <>
          <section className="editor-section">
            <h2>单据资料</h2>
            <div className="field-pair">
              <label className="field">
                <span>单据类型</span>
                <select
                  aria-label="单据类型"
                  value={data.kind}
                  onChange={(e) => set("kind", e.target.value)}
                >
                  <option value="quotation">报价单</option>
                  <option value="invoice">商业发票</option>
                </select>
              </label>
              <Field
                label="单据编号"
                max={80}
                value={data.number}
                onChange={(v) => set("number", v)}
              />
            </div>
            <div className="field-pair">
              <Field
                label="出具日期"
                type="date"
                value={data.issued}
                onChange={(v) => set("issued", v)}
              />
              <Field
                label="到期日期"
                type="date"
                value={data.due}
                onChange={(v) => set("due", v)}
              />
            </div>
          </section>
          <PartyFields
            title="出具方"
            value={data.issuer}
            onChange={(v) => set("issuer", v)}
          />
          <PartyFields
            title="客户"
            value={data.customer}
            onChange={(v) => set("customer", v)}
          />
        </>
      ) : null}
      {section === "items" ? (
        <>
          <section className="editor-section">
            <div className="section-heading">
              <div>
                <h2>项目明细</h2>
                <p>
                  {data.items.length} / {MAX_ITEMS} 项
                </p>
              </div>
              <button
                onClick={() =>
                  setData((d) =>
                    d.items.length < MAX_ITEMS
                      ? {
                          ...d,
                          items: [
                            ...d.items,
                            {
                              id: crypto.randomUUID(),
                              description: "",
                              unit: "项",
                              quantity: "1",
                              price: "0",
                            },
                          ],
                        }
                      : d,
                  )
                }
                disabled={data.items.length >= MAX_ITEMS}
              >
                ＋ 添加明细
              </button>
            </div>
            <label className="field">
              <span>单据币种</span>
              <select
                aria-label="单据币种"
                value={data.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {["CNY", "USD", "EUR", "JPY"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {data.items.map((l, i) => (
              <div className="line-editor" key={l.id}>
                <div className="line-heading">
                  <strong>{String(i + 1).padStart(2, "0")}</strong>
                  <button
                    aria-label={"移除明细 " + (i + 1)}
                    onClick={() => {
                      if (confirm("移除此条明细？"))
                        setData((d) => ({
                          ...d,
                          items: d.items.filter((x) => x.id !== l.id),
                        }));
                    }}
                  >
                    移除
                  </button>
                </div>
                <Field
                  label={"明细 " + (i + 1) + " 项目"}
                  multi
                  max={2000}
                  value={l.description}
                  onChange={(v) => line(l.id, "description", v)}
                />
                <div className="line-numbers">
                  <Field
                    label={"明细 " + (i + 1) + " 数量"}
                    decimal
                    max={32}
                    value={l.quantity}
                    onChange={(v) => line(l.id, "quantity", v)}
                  />
                  <Field
                    label={"明细 " + (i + 1) + " 单位"}
                    max={24}
                    value={l.unit}
                    onChange={(v) => line(l.id, "unit", v)}
                  />
                  <Field
                    label={"明细 " + (i + 1) + " 单价"}
                    decimal
                    max={32}
                    value={l.price}
                    onChange={(v) => line(l.id, "price", v)}
                  />
                </div>
              </div>
            ))}
          </section>
          <section className="editor-section">
            <h2>折扣与税费</h2>
            <div className="field-pair">
              <label className="field">
                <span>折扣方式</span>
                <select
                  aria-label="折扣方式"
                  value={data.discountMode}
                  onChange={(e) => set("discountMode", e.target.value)}
                >
                  <option value="none">不使用</option>
                  <option value="percentage">百分比</option>
                  <option value="fixed">固定金额</option>
                </select>
              </label>
              <Field
                label="折扣值"
                decimal
                max={32}
                value={data.discount}
                onChange={(v) => set("discount", v)}
              />
            </div>
            <div className="field-pair">
              <label className="field">
                <span>税费方式</span>
                <select
                  aria-label="税费方式"
                  value={data.taxMode}
                  onChange={(e) => set("taxMode", e.target.value)}
                >
                  <option value="none">不计税</option>
                  <option value="exclusive">另加税费</option>
                  <option value="inclusive">已含税费</option>
                </select>
              </label>
              <Field
                label="税率 %"
                decimal
                max={32}
                value={data.taxRate}
                onChange={(v) => set("taxRate", v)}
              />
            </div>
            <Field
              label="运费"
              decimal
              max={32}
              value={data.shipping}
              onChange={(v) => set("shipping", v)}
            />
          </section>
        </>
      ) : null}
      {section === "notes" ? (
        <>
          <section className="editor-section">
            <h2>收款与说明</h2>
            <Field
              label="已付金额"
              decimal
              max={32}
              value={data.paid}
              onChange={(v) => set("paid", v)}
            />
            {data.kind === "quotation" ? (
              <p className="hint">报价阶段的已付金额保持为0。</p>
            ) : null}
            <Field
              label="收款信息"
              multi
              max={2000}
              value={data.bank}
              onChange={(v) => set("bank", v)}
            />
            <Field
              label="客户说明"
              multi
              max={12000}
              value={data.notes}
              onChange={(v) => set("notes", v)}
            />
            <Field
              label="条款"
              multi
              max={12000}
              value={data.terms}
              onChange={(v) => set("terms", v)}
            />
          </section>
          <section className="editor-section">
            <h2>签章</h2>
            <ImageField
              title="签名图片"
              asset={data.signature}
              busy={assetBusy}
              onAttach={(file) => attach("signature", file)}
              onRemove={() => set("signature", null)}
            />
          </section>
        </>
      ) : null}
      {section === "layout" ? (
        <>
          <section className="editor-section">
            <h2>纸张与版式</h2>
            <label className="field">
              <span>版式</span>
              <select
                aria-label="版式"
                value={data.layout}
                onChange={(e) => set("layout", e.target.value)}
              >
                <option value="classic">双栏信函</option>
                <option value="letterhead">抬头信纸</option>
              </select>
            </label>
            <div className="field-pair">
              <label className="field">
                <span>纸张</span>
                <select
                  aria-label="纸张"
                  value={data.pageSize}
                  onChange={(e) => set("pageSize", e.target.value)}
                >
                  <option value="A4">A4</option>
                  <option value="LETTER">Letter</option>
                </select>
              </label>
              <label className="field">
                <span>文字密度</span>
                <select
                  aria-label="文字密度"
                  value={data.fontSize}
                  onChange={(e) => set("fontSize", e.target.value)}
                >
                  <option value="small">紧凑</option>
                  <option value="medium">标准</option>
                  <option value="large">舒展</option>
                </select>
              </label>
            </div>
            <div className="field-pair">
              <label className="field">
                <span>表头样式</span>
                <select
                  aria-label="表头样式"
                  value={data.headerStyle}
                  onChange={(e) => set("headerStyle", e.target.value)}
                >
                  <option value="dark">深色</option>
                  <option value="light">浅色</option>
                  <option value="outline">描边</option>
                </select>
              </label>
              <Field
                label="主题颜色"
                type="color"
                max={7}
                value={data.accent}
                onChange={(v) => set("accent", v)}
              />
            </div>
          </section>
          <section className="editor-section">
            <h2>品牌标记</h2>
            <ImageField
              title="品牌图片"
              asset={data.logo}
              busy={assetBusy}
              onAttach={(file) => attach("logo", file)}
              onRemove={() => set("logo", null)}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
