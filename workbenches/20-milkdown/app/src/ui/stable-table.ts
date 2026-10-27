import { TableNodeView, tableBlockView } from '@milkdown/kit/component/table-block';
import { tableSchema } from '@milkdown/kit/preset/gfm';
import { $view } from '@milkdown/kit/utils';

// Crepe 7.23.0 captures a transaction on cell pointerdown and dispatches it on
// the next frame. A keystroke can change the document first. Let ProseMirror
// position the text cursor synchronously; keep Crepe's controls and drag view.
class StableTableNodeView extends TableNodeView {
  override stopEvent(event: Event): boolean {
    if ((event.type === 'mousedown' || event.type === 'pointerdown') && event.target instanceof HTMLElement && this.contentDOM.contains(event.target) && event.target.closest('td,th') && !event.target.closest('button')) return false;
    return super.stopEvent(event);
  }
}
export const stableTableView = $view(tableSchema.node, ctx => (node, view, getPos) => new StableTableNodeView(ctx, node, view, getPos));
export { tableBlockView };
