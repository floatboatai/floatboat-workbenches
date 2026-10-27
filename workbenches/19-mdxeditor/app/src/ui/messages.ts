import type { Translation } from '@mdxeditor/editor';
const labels: Record<string, string> = {
  'contentArea.editableMarkdown': 'Markdown 正文编辑器',
  'toolbar.undo': '撤销 {{shortcut}}', 'toolbar.redo': '重做 {{shortcut}}', 'toolbar.bold': '加粗', 'toolbar.removeBold': '取消加粗', 'toolbar.italic': '斜体', 'toolbar.removeItalic': '取消斜体', 'toolbar.underline': '下划线', 'toolbar.removeUnderline': '取消下划线', 'toolbar.strikethrough': '删除线', 'toolbar.removeStrikethrough': '取消删除线',
  'toolbar.bulletedList': '无序列表', 'toolbar.numberedList': '有序列表', 'toolbar.checkList': '任务列表', 'toolbar.toggleGroup': '格式选项', 'toolbar.table': '插入表格', 'toolbar.codeBlock': '插入代码块', 'toolbar.inlineCode': '行内代码', 'toolbar.removeInlineCode': '取消行内代码', 'toolbar.link': '创建链接', 'toolbar.thematicBreak': '插入分隔线',
  'toolbar.blockTypes.paragraph': '正文', 'toolbar.blockTypes.quote': '引用', 'toolbar.blockTypes.heading': '{{level}} 级标题', 'toolbar.blockTypeSelect.selectBlockTypeTooltip': '段落样式', 'toolbar.blockTypeSelect.placeholder': '段落样式',
  'codeBlock.selectLanguage': '代码语言', 'codeBlock.language': '代码语言', 'codeBlock.inlineLanguage': '语言', 'codeblock.delete': '删除代码块',
  'table.deleteTable': '删除表格', 'table.columnMenu': '列操作', 'table.rowMenu': '行操作', 'table.textAlignment': '对齐方式', 'table.alignLeft': '左对齐', 'table.alignCenter': '居中', 'table.alignRight': '右对齐', 'table.insertColumnLeft': '在左侧插入列', 'table.insertColumnRight': '在右侧插入列', 'table.deleteColumn': '删除此列', 'table.insertRowAbove': '在上方插入行', 'table.insertRowBelow': '在下方插入行', 'table.deleteRow': '删除此行',
  'createLink.url': '链接地址', 'createLink.urlPlaceholder': '粘贴 https 链接…', 'createLink.text': '链接文字', 'createLink.textTooltip': '显示的链接文字', 'createLink.saveTooltip': '设置链接', 'createLink.cancelTooltip': '取消修改', 'dialogControls.save': '确定', 'dialogControls.cancel': '取消', 'dialog.close': '关闭', 'linkPreview.edit': '编辑链接', 'linkPreview.copyToClipboard': '复制链接', 'linkPreview.copied': '已复制', 'linkPreview.remove': '移除链接',
};
export const translateEditor: Translation = (key, fallback, values) => {
  let text = labels[key] ?? fallback;
  for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll('{{' + name + '}}', String(value));
  return text;
};
