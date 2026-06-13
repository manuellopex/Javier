/** Minimal markdown → HTML for chat bubbles (bold, italics, code, lists, links). */
export function renderMarkdown(text: string): string {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const blocks = escaped.split(/```/);
  const html = blocks
    .map((block, i) => {
      if (i % 2 === 1) {
        // code fence content
        const body = block.replace(/^[a-zA-Z]*\n/, '');
        return `<pre><code>${body}</code></pre>`;
      }
      return block
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline">$1</a>')
        .split('\n\n')
        .map((para) => {
          const lines = para.split('\n');
          const isList = lines.every((l) => /^\s*[-•*]\s/.test(l) || l.trim() === '');
          const isOrdered = lines.every((l) => /^\s*\d+[.)]\s/.test(l) || l.trim() === '');
          if (isList && lines.some((l) => l.trim())) {
            const items = lines
              .filter((l) => l.trim())
              .map((l) => `<li>${l.replace(/^\s*[-•*]\s/, '')}</li>`)
              .join('');
            return `<ul>${items}</ul>`;
          }
          if (isOrdered && lines.some((l) => l.trim())) {
            const items = lines
              .filter((l) => l.trim())
              .map((l) => `<li>${l.replace(/^\s*\d+[.)]\s/, '')}</li>`)
              .join('');
            return `<ol>${items}</ol>`;
          }
          return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
        })
        .join('');
    })
    .join('');

  return html;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDueDate(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: '', overdue: false };
  const date = new Date(iso);
  const now = new Date();
  const overdue = date.getTime() < now.getTime();
  const label = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: date.getHours() || date.getMinutes() ? '2-digit' : undefined,
    minute: date.getHours() || date.getMinutes() ? '2-digit' : undefined,
  });
  return { label, overdue };
}
