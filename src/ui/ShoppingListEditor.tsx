import type { ShoppingItem } from '../core';

/**
 * 购物清单编辑器：玩家自由增删「名称 + 数量」。
 * 工具不校验价格、库存或购买条件；清单也不代表已经买成。
 */
export function ShoppingListEditor({
  items,
  onChange,
}: {
  items: ShoppingItem[];
  onChange: (next: ShoppingItem[]) => void;
}) {
  return (
    <div className="shop-list-editor">
      <span className="state-name">购物清单（名称与数量，可自由增删）</span>
      {items.map((item, index) => (
        <div className="shop-list-row" key={index}>
          <input
            type="text"
            data-field="shop-item-name"
            value={item.name}
            placeholder="物品名称"
            onChange={(event) =>
              onChange(
                items.map((entry, i) =>
                  i === index ? { ...entry, name: event.target.value } : entry,
                ),
              )
            }
          />
          <input
            type="text"
            data-field="shop-item-quantity"
            value={item.quantity ?? ''}
            placeholder="数量"
            onChange={(event) =>
              onChange(
                items.map((entry, i) =>
                  i === index ? { ...entry, quantity: event.target.value } : entry,
                ),
              )
            }
          />
          <button
            type="button"
            className="ghost"
            data-action="remove-shop-item"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ghost"
        data-action="add-shop-item"
        onClick={() => onChange([...items, { name: '', quantity: '' }])}
      >
        ＋ 添加清单项
      </button>
      <p className="hint">工具不校验价格、库存或购买条件。</p>
    </div>
  );
}
