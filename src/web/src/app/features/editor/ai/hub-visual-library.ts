import { Injectable, signal } from '@angular/core';
import { APPROVED_HUB_DESIGN_CASES } from './hub-design-knowledge';

export type VisualReference = { id: string; title: string; source: 'native' | 'user'; description: string;
  principles: string[]; tags: string[]; image?: string; templateId?: string; createdAt?: string };
export const NATIVE_VISUAL_REFERENCES: VisualReference[] = APPROVED_HUB_DESIGN_CASES.map(record => ({
  id: record.source.toLowerCase(), title: record.source, source: 'native', templateId: `${record.source.toLowerCase()}-broadcast`,
  description: record.why.map(item => item.choice).join('; '), principles: record.why.map(item => `${item.choice}: ${item.effect}`), tags: record.tags,
}));

/** Rank annotations, not colours to copy. Selection never restricts what may be generated. */
export function selectVisualReferences(instruction: string, references: VisualReference[]) {
  const words = new Set(instruction.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  return references.map((reference, index) => ({ reference, index, relevance:
    [...new Set(`${reference.title} ${reference.description} ${reference.tags.join(' ')}`.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])]
      .filter(word => words.has(word)).length }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index).slice(0, 2).map(item => item.reference);
}
export function visualReferenceContext(references: VisualReference[]) {
  return references.map(({ id, title, source, description, principles }) => ({ id, title, source,
    description, principles, usage: 'Human-annotated craftsmanship evidence. These images were NOT seen by the text generator. Transfer useful relationships, never impose their palette, branding or composition.' }));
}

@Injectable({ providedIn: 'root' })
export class HubVisualLibrary {
  readonly entries = signal<VisualReference[]>(NATIVE_VISUAL_REFERENCES);
  readonly message = signal('');
  readonly ready = this.load();
  private async database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ai-hub-visual-references', 1);
      let expired = false;
      const timer = setTimeout(() => { expired = true; reject(new Error('Reference storage did not respond in time.')); }, 5000);
      const fail = (error: unknown) => { expired = true; clearTimeout(timer); reject(error); };
      request.onupgradeneeded = () => request.result.createObjectStore('references', { keyPath: 'id' });
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Reference storage is blocked by another tab.'));
      request.onsuccess = () => { clearTimeout(timer); if (expired) request.result.close(); else resolve(request.result); };
    });
  }
  private async load() {
    try {
      const db = await this.database();
      try {
        const stored = await new Promise<VisualReference[]>((resolve, reject) => {
          const request = db.transaction('references').objectStore('references').getAll();
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        this.entries.set([...NATIVE_VISUAL_REFERENCES, ...stored.filter(item => item.source === 'user' && item.image?.startsWith('data:image/'))]);
      } finally { db.close(); }
    } catch { this.message.set('Reference storage is unavailable. Added references will last for this tab only.'); }
  }
  async add(file: File, notes: string) {
    await this.ready;
    if (!notes.trim()) throw new Error('Describe what works in the reference before adding it.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('Use a PNG, JPEG or WebP image up to 12 MB.');
    const url = URL.createObjectURL(file); let timer: ReturnType<typeof setTimeout> | undefined;
    let image: string;
    try {
      const bitmap = new Image(); bitmap.src = url;
      await Promise.race([bitmap.decode(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Could not decode this image in time.')), 8000); })]);
      const canvas = document.createElement('canvas'), scale = Math.min(1, 1600 / bitmap.width, 1000 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Image processing is unavailable.');
      context.fillStyle = '#111'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      image = canvas.toDataURL('image/jpeg', .9);
    } finally { if (timer) clearTimeout(timer); URL.revokeObjectURL(url); }
    const entry: VisualReference = { id: `user-${crypto.randomUUID()}`, title: file.name, source: 'user', description: notes.trim(),
      principles: [notes.trim()], tags: [], image, createdAt: new Date().toISOString() };
    await this.persist(entry);
    this.entries.update(entries => [...entries, entry]);
  }
  async remove(id: string) {
    if (!this.entries().some(entry => entry.id === id && entry.source === 'user')) return;
    await this.persist(undefined, id);
    this.entries.update(entries => entries.filter(entry => entry.id !== id));
  }
  private async persist(entry?: VisualReference, remove?: string) {
    try {
      const db = await this.database();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction('references', 'readwrite');
          const store = transaction.objectStore('references'); if (entry) store.put(entry); else store.delete(remove!);
          transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
        });
        this.message.set('Reference library saved locally. No model training or upload was performed.');
      } finally { db.close(); }
    } catch { this.message.set('Could not persist this change. It is available for this tab only.'); }
  }
}
