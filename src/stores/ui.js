import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    createOpen: false,
    toast: '',
    past: [],
    future: [],
  }),
  actions: {
    /**
     * Add a snapshot before a user edit and clear redo history.
     *
     * @param {object[]} workflow - Current workflow nodes.
     * @returns {void}
     */
    record(workflow) {
      this.past.push(JSON.parse(JSON.stringify(workflow)))
      if (this.past.length > 30) {
        this.past.shift()
      }
      this.future = []
    },
    /**
     * Restore the previous snapshot and retain the current state for redo.
     *
     * @param {object[]} current - Current workflow nodes.
     * @returns {object[]|null} The prior workflow, if one exists.
     */
    undo(current) {
      if (!this.past.length) {
        return null
      }
      this.future.push(JSON.parse(JSON.stringify(current)))

      return this.past.pop()
    },
    /**
     * Restore the next snapshot and retain the current state for undo.
     *
     * @param {object[]} current - Current workflow nodes.
     * @returns {object[]|null} The next workflow, if one exists.
     */
    redo(current) {
      if (!this.future.length) {
        return null
      }
      this.past.push(JSON.parse(JSON.stringify(current)))

      return this.future.pop()
    },
    /**
     * Show a transient status message.
     *
     * @param {string} message - Message shown to the user.
     * @returns {void}
     */
    announce(message) {
      this.toast = message
    },
  },
})
