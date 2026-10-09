'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/posts/posts.module.css';
import { PixelIcon } from './PixelIcon';
import { useTexts } from './TextsProvider';
import { apiFetch, csrfToken, errorText } from '@/lib/client';
import { MAX_ATTACHMENTS, POST_BODY_MAX, POST_TITLE_MAX } from '@/lib/validation';

type Tag = 'STREAM' | 'OFFSTREAM';

const TAGS: { value: Tag; label: string }[] = [
  { value: 'STREAM', label: 'tag.stream' },
  { value: 'OFFSTREAM', label: 'tag.offstream' },
];

export function PostForm({
  mode,
  postId,
  initial,
  maxImageMb,
  maxVideoMb,
}: {
  mode: 'create' | 'edit';
  postId?: string;
  initial?: { title: string; body: string; tag: Tag };
  maxImageMb: number;
  maxVideoMb: number;
}) {
  const router = useRouter();
  const t = useTexts();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [tag, setTag] = useState<Tag>(initial?.tag ?? 'OFFSTREAM');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = [...files, ...Array.from(list)].slice(0, MAX_ATTACHMENTS);

    for (const file of picked) {
      const isVideo = file.type.startsWith('video/');
      const limit = (isVideo ? maxVideoMb : maxImageMb) * 1024 * 1024;
      if (file.size > limit) {
        setError(
          `«${file.name}» больше лимита: картинки до ${maxImageMb} МБ, видео до ${maxVideoMb} МБ`,
        );
        return;
      }
    }

    setError(null);
    setFiles(picked);
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  /** Размеры видео знает только браузер: читаем их до отправки. */
  async function readSizes(list: File[]) {
    const sizes: { index: number; width: number; height: number }[] = [];

    await Promise.all(
      list.map(
        (file, index) =>
          new Promise<void>((resolve) => {
            if (!file.type.startsWith('video/')) {
              resolve();
              return;
            }
            const url = URL.createObjectURL(file);
            const probe = document.createElement('video');
            probe.preload = 'metadata';
            probe.onloadedmetadata = () => {
              if (probe.videoWidth && probe.videoHeight) {
                sizes.push({ index, width: probe.videoWidth, height: probe.videoHeight });
              }
              URL.revokeObjectURL(url);
              resolve();
            };
            probe.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            probe.src = url;
          }),
      ),
    );

    return sizes;
  }

  /** Создание идёт через XHR: нужен прогресс отправки, видео бывает тяжёлым. */
  function create(sizes: { index: number; width: number; height: number }[]) {
    return new Promise<string>((resolve, reject) => {
      const form = new FormData();
      form.set('title', title);
      form.set('body', body);
      form.set('tag', tag);
      form.set('sizes', JSON.stringify(sizes));
      for (const file of files) form.append('files', file);

      const request = new XMLHttpRequest();
      request.open('POST', '/api/posts');
      request.setRequestHeader('X-CSRF-Token', csrfToken());
      request.withCredentials = true;

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      request.onload = () => {
        try {
          const data = JSON.parse(request.responseText) as {
            ok?: boolean;
            id?: string;
            message?: string;
          };
          if (request.status >= 200 && request.status < 300 && data.ok && data.id) {
            resolve(data.id);
          } else {
            reject(new Error(data.message ?? 'Не удалось опубликовать'));
          }
        } catch {
          reject(new Error('Сервер ответил непонятно'));
        }
      };
      request.onerror = () => reject(new Error('Сеть недоступна'));
      request.send(form);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setProgress(0);

    try {
      if (mode === 'create') {
        const sizes = await readSizes(files);
        const id = await create(sizes);
        router.push(`/posts/${id}`);
        router.refresh();
      } else {
        await apiFetch(`/api/posts/${postId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, body, tag }),
        });
        router.push(`/posts/${postId}`);
        router.refresh();
      }
    } catch (submitError) {
      setError(errorText(submitError));
      setBusy(false);
    }
  }

  return (
    <form className={styles.formGrid} onSubmit={submit}>
      <label className="field">
        <span className="field__label">{t('postForm.titleLabel')}</span>
        <input
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={POST_TITLE_MAX}
          required
          placeholder={t('postForm.titlePlaceholder')}
        />
        <span className="field__hint">
          {title.length} / {POST_TITLE_MAX}
        </span>
      </label>

      <div className="field">
        <span className="field__label" id="tag-label">
          {t('postForm.tag')}
        </span>
        <div className={styles.tagPick} role="radiogroup" aria-labelledby="tag-label">
          {TAGS.map((item) => {
            const active = tag === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                className={`${styles.tagOption} ${active ? styles.tagOptionActive : ''}`}
                onClick={() => setTag(item.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    setTag(item.value === 'STREAM' ? 'OFFSTREAM' : 'STREAM');
                  }
                }}
              >
                <span className={styles.tagMark} aria-hidden="true">
                  {active ? <PixelIcon name="check" size={10} /> : null}
                </span>
                {t(item.label)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="field">
        <span className="field__label">{t('postForm.body')}</span>
        <textarea
          className="textarea"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={POST_BODY_MAX}
          required
          placeholder={t('postForm.bodyPlaceholder')}
        />
        <span className="field__hint">
          {body.length} / {POST_BODY_MAX} · поддерживается разметка Markdown
        </span>
      </label>

      {mode === 'create' && (
        <div className="field">
          <span className="field__label">{t('postForm.attachments')}</span>
          <div className={styles.row}>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              hidden
              onChange={(event) => pickFiles(event.target.files)}
            />
            <button
              type="button"
              className="btn btn--stone btn--sm"
              onClick={() => inputRef.current?.click()}
              disabled={files.length >= MAX_ATTACHMENTS}
            >
              {t('postForm.addFile')}
            </button>
            <span className="field__hint">
              до {MAX_ATTACHMENTS} файлов · фото до {maxImageMb} МБ · видео до {maxVideoMb} МБ
            </span>
          </div>

          {files.length > 0 && (
            <div className={styles.files}>
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className={styles.file}>
                  {file.type.startsWith('image/') && (
                    <img className={styles.filePreview} src={URL.createObjectURL(file)} alt="" />
                  )}
                  {file.name}
                  <div>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => removeFile(index)}
                    >
                      {t('postForm.remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && (
        <p className="faint">
          {t('postForm.locked')}
        </p>
      )}

      {busy && progress > 0 && (
        <div className={styles.progress} aria-label={`Отправлено ${progress}%`}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className={styles.row}>
        <button type="submit" className="btn btn--grass" disabled={busy}>
          {mode === 'create' ? t('postForm.publish') : t('postForm.save')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => router.back()}
          disabled={busy}
        >
          {t('postForm.cancel')}
        </button>
        {mode === 'edit' && (
          <span className="faint">{t('postForm.editedNote')}</span>
        )}
      </div>
    </form>
  );
}
