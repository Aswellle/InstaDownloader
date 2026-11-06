import { create } from 'zustand'
import type { TaskSnapshot } from '@shared/types'
import type { TaskEventMsg } from '../../../preload/index.d'

interface TaskState {
  tasks: TaskSnapshot[]
  expanded: boolean
  load: () => Promise<void>
  applyEvent: (ev: TaskEventMsg) => void
  setExpanded: (v: boolean) => void
  pause: (id: string) => void
  resume: (id: string) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  remove: (id: string) => void
}

function patchTask(list: TaskSnapshot[], id: string, patch: Partial<TaskSnapshot>): TaskSnapshot[] {
  return list.map((t) => (t.id === id ? { ...t, ...patch } : t))
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  expanded: true,

  load: async () => {
    const tasks = await window.instadown.getTasks()
    set({ tasks })
  },

  applyEvent: (ev) =>
    set((s) => {
      if (ev.kind === 'progress') {
        return {
          tasks: patchTask(s.tasks, ev.id, {
            progress: ev.progress ?? 0,
            speed: ev.speed ?? 0,
            downloaded: ev.downloaded ?? 0,
            total: ev.total ?? 0
          })
        }
      }
      if (ev.kind === 'created') {
        const exists = s.tasks.some((t) => t.id === ev.id)
        if (exists) return s
        return {
          tasks: [
            {
              id: ev.id,
              mediaId: null,
              url: '',
              author: '',
              type: 'image' as const,
              shortcode: '',
              indexNo: 0,
              status: ev.status!,
              progress: 0,
              speed: 0,
              downloaded: 0,
              total: 0,
              destPath: ev.destPath ?? '',
              error: null,
              createdAt: Date.now(),
              updatedAt: Date.now()
            },
            ...s.tasks
          ]
        }
      }
      if (ev.kind === 'removed') {
        return { tasks: s.tasks.filter((t) => t.id !== ev.id) }
      }
      const exists = s.tasks.some((t) => t.id === ev.id)
      if (!exists) {
        // 状态更新器必须是纯函数：不能在 updater 内触发副作用。
        // 未知任务的完整信息由一次异步拉取补齐（微任务，不在渲染期同步执行）。
        queueMicrotask(() => {
          void window.instadown.getTasks().then((tasks) => set({ tasks }))
        })
        return s
      }
      return {
        tasks: patchTask(s.tasks, ev.id, {
          status: ev.status,
          error: ev.error ?? undefined,
          // destPath 类型是 string：事件未携带时保留空串而不是 undefined，
          // 否则渲染层按 string 使用的代码（如取文件名）会崩
          destPath: ev.destPath ?? '',
          speed: ev.status === 'SUCCESS' || ev.status === 'FAILED' || ev.status === 'PAUSED' ? 0 : undefined
        })
      }
    }),

  setExpanded: (v) => set({ expanded: v }),

  pause: (id) => {
    set((s) => ({ tasks: patchTask(s.tasks, id, { status: 'PAUSED', speed: 0 }) }))
    void window.instadown.pauseTask(id)
  },
  resume: (id) => {
    set((s) => ({ tasks: patchTask(s.tasks, id, { status: 'WAITING' }) }))
    void window.instadown.resumeTask(id)
  },
  cancel: (id) => {
    set((s) => ({ tasks: patchTask(s.tasks, id, { status: 'CANCELED', speed: 0 }) }))
    void window.instadown.cancelTask(id)
  },
  retry: (id) => {
    set((s) => ({ tasks: patchTask(s.tasks, id, { status: 'WAITING', error: null, progress: 0 }) }))
    void window.instadown.retryTask(id)
  },
  remove: (id) => {
    void window.instadown.removeTask(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  }
}))
