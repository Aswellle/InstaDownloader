import { useCallback } from 'react'
import { toast } from 'sonner'
import { toastError } from '@/lib/toast-error'
import type { MediaItem } from '@shared/types'
import { useTaskStore } from '@/stores/tasks'
import { useLibraryStore } from '@/stores/library'
import { i18nT } from '@/i18n'
import { errorMessage } from '@/lib/app-error'

export function useContextMenuActions() {
  const downloadItems = useCallback(async (targets: MediaItem[]) => {
    if (targets.length === 0) return
    const view = useLibraryStore.getState().view
    let author = 'instagram'
    let shortcode = ''
    if (view.mode === 'post') {
      author = view.collection.author.username || 'instagram'
      shortcode = view.collection.source.shortcode ?? ''
    } else if (view.mode === 'profile') {
      author = view.page.user.username
    }
    const payload = targets.map((m, i) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      thumbUrl: m.thumb_url ?? null,
      author,
      shortcode,
      indexNo: shortcode ? i + 1 : 1,
      takenAt: m.taken_at ?? null,
      width: m.width ?? null,
      height: m.height ?? null,
      duration: m.duration ?? null
    }))
    try {
      const { taskIds } = await window.instadown.addDownload(payload)
      toast.success(i18nT('download.queued', { n: taskIds.length }))
    } catch (e) {
      toastError(i18nT('common.errorDetail', { prefix: i18nT('download.queueFailed'), detail: errorMessage(e) }))
    }
  }, [])

  const onCopyLink = useCallback(async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url)
      toast.success(i18nT('grid.linkCopied'))
    } catch {
      toastError(i18nT('grid.copyFailed'))
    }
  }, [])

  const onDownloadItem = useCallback(
    (item: MediaItem) => {
      void downloadItems([item])
    },
    [downloadItems]
  )

  const onOpenInBrowser = useCallback((item: MediaItem) => {
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }, [])

  const onRevealFile = useCallback((item: MediaItem) => {
    const task = useTaskStore
      .getState()
      .tasks.find((t) => t.mediaId === item.id && t.status === 'SUCCESS')
    if (task?.destPath) {
      void window.instadown.revealFile(task.destPath)
    } else {
      toastError(i18nT('grid.noFilePath'))
    }
  }, [])

  return { onCopyLink, onDownloadItem, onOpenInBrowser, onRevealFile }
}
