/** The Backlog document mark, shared by Live work and generic task badges. */
export const BACKLOG_MARK = '<span class="backlog-mark" aria-hidden="true"></span>'

export const backlogMarkCss = `
  .backlog-mark {
    display: inline-block; width: 18px; height: 22px; flex: none;
    background: var(--backlog-mark-image) center / contain no-repeat;
  }
`
