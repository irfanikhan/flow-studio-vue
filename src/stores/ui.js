import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    createOpen: false,
    toast: '',
    past: [],
    future: [],
  }),
  actions: {
    /** Add a snapshot before a user edit and clear redo history. */
    record(workflow) {
      this.past.push(JSON.parse(JSON.stringify(workflow)))
      if (this.past.length > 30) this.past.shift()
      this.future = []
    },
    /** Restore the previous snapshot and retain the current state for redo. */
    undo(current) {
      if (!this.past.length) return null
      this.future.push(JSON.parse(JSON.stringify(current)))
      return this.past.pop()
    },
    /** Restore the next snapshot and retain the current state for undo. */
    redo(current) {
      if (!this.future.length) return null
      this.past.push(JSON.parse(JSON.stringify(current)))
      return this.future.pop()
    },
    /** Show a transient status message. */
    announce(message) {
      this.toast = message
    },
  },
})
